const Tournament = require('../models/Tournament');
const Team = require('../models/Team');
const Match = require('../models/Match');
const tendencyAnalytics = require('../services/tendencyAnalytics');

// Wicket weight used to blend a bowler's contribution into the same scale as a
// batsman's runs when tie-breaking "man of the tournament" (see computeManOfTheTournament
// below). 20 runs-per-wicket is a common rough equivalence used in fantasy-cricket-style
// scoring; it's a judgment call, not a standard, and only matters for breaking ties.
const WICKET_TIEBREAK_WEIGHT = 20;

// Award-eligible wicket types for a bowler - mirrors NON_BOWLER_WICKET_TYPES in
// tendencyAnalytics.js (run outs/retirements aren't credited to the bowler).
const NON_BOWLER_WICKET_TYPES = ['run out', 'retired hurt', 'retired out'];

/**
 * Man of the Tournament heuristic: the player with the most Match.manOfTheMatch
 * awards among this tournament's Completed matches (ties broken by combined
 * runs + wickets*20 across those matches). If no match in the tournament has a
 * manOfTheMatch set, falls back to the player with the single highest combined
 * runs + wickets*20 score. This is a deliberate simplification - not an official
 * award formula - chosen because manOfTheMatch is already tracked per match and
 * needs no new data collection; the combined score exists purely to break ties
 * and to provide a fallback when no manOfTheMatch data exists at all.
 */
async function computeManOfTheTournament(tournamentId) {
  const matches = await Match.find({
    tournament: tournamentId,
    status: 'Completed'
  }).select('innings manOfTheMatch');

  if (matches.length === 0) return null;

  const momCounts = new Map(); // playerId -> number of manOfTheMatch awards
  const comboScore = new Map(); // playerId -> runs scored + wickets * WICKET_TIEBREAK_WEIGHT

  const addScore = (id, amount) => {
    comboScore.set(id, (comboScore.get(id) || 0) + amount);
  };

  matches.forEach((match) => {
    if (match.manOfTheMatch) {
      const id = match.manOfTheMatch.toString();
      momCounts.set(id, (momCounts.get(id) || 0) + 1);
    }

    match.innings.forEach((innings) => {
      innings.balls.forEach((ball) => {
        if (ball.batsmanId) {
          addScore(ball.batsmanId.toString(), ball.runs || 0);
        }
        if (ball.bowlerId && ball.isWicket && !NON_BOWLER_WICKET_TYPES.includes(ball.wicketType)) {
          addScore(ball.bowlerId.toString(), WICKET_TIEBREAK_WEIGHT);
        }
      });
    });
  });

  if (momCounts.size === 0) {
    // No manOfTheMatch awards recorded anywhere in this tournament - fall back to
    // the player with the highest combined runs + wickets*20 score.
    let bestId = null;
    let bestScore = -1;
    comboScore.forEach((score, id) => {
      if (score > bestScore) {
        bestScore = score;
        bestId = id;
      }
    });
    return bestId;
  }

  const maxCount = Math.max(...momCounts.values());
  const topPlayers = [...momCounts.entries()]
    .filter(([, count]) => count === maxCount)
    .map(([id]) => id);

  if (topPlayers.length === 1) return topPlayers[0];

  let bestId = topPlayers[0];
  let bestScore = comboScore.get(bestId) || 0;
  topPlayers.slice(1).forEach((id) => {
    const score = comboScore.get(id) || 0;
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  });
  return bestId;
}

// @desc    Create a new tournament
// @route   POST /api/tournaments
// @access  Private
exports.createTournament = async (req, res) => {
  try {
    const {
      name,
      description,
      format,
      matchType,
      venue,
      startDate,
      endDate,
      registrationDeadline,
      maxTeams,
      prizePool,
      rules
    } = req.body;

    if (!name || !venue || !startDate || !endDate || !registrationDeadline) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    const tournament = await Tournament.create({
      name,
      description,
      organizer: req.user.id,
      format: format || 'League',
      matchType: matchType || 'T20',
      status: 'Draft',
      venue,
      startDate,
      endDate,
      registrationDeadline,
      maxTeams: maxTeams || 8,
      prizePool: prizePool || {},
      rules: rules || {}
    });

    await tournament.populate('organizer');

    res.status(201).json({
      success: true,
      tournament
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all tournaments
// @route   GET /api/tournaments
// @access  Public
exports.getAllTournaments = async (req, res) => {
  try {
    const { status, format, sortBy = 'startDate', order = -1 } = req.query;

    let query = {};
    if (status) query.status = status;
    if (format) query.format = format;

    const tournaments = await Tournament.find(query)
      .populate('organizer')
      .populate('teams')
      .populate('standings.team')
      .populate('awards.winner')
      .populate('awards.runnerUp')
      .populate('awards.thirdPlace')
      .populate({ path: 'awards.manOfTheTournament', populate: { path: 'user', select: 'name' } })
      .populate({ path: 'awards.bestBatsman', populate: { path: 'user', select: 'name' } })
      .populate({ path: 'awards.bestBowler', populate: { path: 'user', select: 'name' } })
      .sort({ [sortBy]: parseInt(order) });

    res.status(200).json({
      success: true,
      count: tournaments.length,
      tournaments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get tournament by ID
// @route   GET /api/tournaments/:id
// @access  Public
exports.getTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .populate('organizer')
      .populate('teams')
      .populate('matches')
      .populate('standings.team')
      .populate('awards.winner')
      .populate('awards.runnerUp')
      .populate('awards.thirdPlace')
      .populate({ path: 'awards.manOfTheTournament', populate: { path: 'user', select: 'name' } })
      .populate({ path: 'awards.bestBatsman', populate: { path: 'user', select: 'name' } })
      .populate({ path: 'awards.bestBowler', populate: { path: 'user', select: 'name' } });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    res.status(200).json({
      success: true,
      tournament
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update tournament
// @route   PUT /api/tournaments/:id
// @access  Private
exports.updateTournament = async (req, res) => {
  try {
    let tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    if (tournament.organizer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this tournament'
      });
    }

    const { name, description, status, prizePool, rules, houseRules } = req.body;

    if (name) tournament.name = name;
    if (description) tournament.description = description;
    if (status) tournament.status = status;
    if (prizePool) tournament.prizePool = prizePool;
    if (rules) tournament.rules = rules;
    if (houseRules !== undefined) tournament.houseRules = houseRules;

    tournament = await tournament.save();
    await tournament.populate('organizer');

    res.status(200).json({
      success: true,
      tournament
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Register team in tournament
// @route   POST /api/tournaments/:id/register-team
// @access  Private
exports.registerTeam = async (req, res) => {
  try {
    const { teamId } = req.body;

    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    if (!tournament.isRegistrationOpen()) {
      return res.status(400).json({
        success: false,
        message: 'Tournament registration is not open'
      });
    }

    if (tournament.teams.includes(teamId)) {
      return res.status(400).json({
        success: false,
        message: 'Team already registered'
      });
    }

    tournament.teams.push(teamId);

    // Add team to standings
    tournament.standings.push({
      team: teamId,
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      noResult: 0,
      points: 0,
      netRunRate: 0
    });

    await tournament.save();
    await tournament.populate('teams');

    res.status(200).json({
      success: true,
      message: 'Team registered successfully',
      tournament
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get tournament standings
// @route   GET /api/tournaments/:id/standings
// @access  Public
exports.getTournamentStandings = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .populate('standings.team');

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    const leaderboard = tournament.getLeaderboard();

    res.status(200).json({
      success: true,
      standings: leaderboard
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get tournament matches
// @route   GET /api/tournaments/:id/matches
// @access  Public
exports.getTournamentMatches = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .populate({
        path: 'matches',
        populate: ['team1', 'team2']
      });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    res.status(200).json({
      success: true,
      count: tournament.matches.length,
      matches: tournament.matches
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Auto-generate the match schedule for a tournament
// @route   POST /api/tournaments/:id/generate-fixtures
// @access  Private (organizer only)
exports.generateFixtures = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id).populate('teams');

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    if (tournament.organizer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to generate fixtures for this tournament'
      });
    }

    if (tournament.teams.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least 2 teams must be registered before fixtures can be generated'
      });
    }

    if (tournament.matches.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Fixtures have already been generated for this tournament'
      });
    }

    // Map the tournament's own format to a fixture-generation strategy,
    // unless the caller explicitly overrides it in the request body.
    const formatMap = {
      'Round-Robin': 'round-robin',
      'League': 'round-robin',
      'Group': 'round-robin',
      'Knockout': 'knockout'
    };
    const format = req.body.format || formatMap[tournament.format] || 'round-robin';

    const teams = tournament.teams;
    const pairings = [];

    if (format === 'knockout') {
      // NOTE: This only generates Round 1. A knockout bracket's later rounds
      // depend on who wins each earlier match, which isn't known at
      // generation time — so we deliberately stop after pairing up the
      // registered teams once. Once Round 1 results are in, the organizer
      // creates Round 2+ matches manually (or re-runs a future "next round"
      // feature, which is out of scope here).
      for (let i = 0; i + 1 < teams.length; i += 2) {
        pairings.push([teams[i], teams[i + 1]]);
      }
      // If there's an odd number of teams, the last team gets a bye for
      // this round — no match is created for them.
    } else {
      // Round-robin: every unique pair of registered teams plays exactly
      // once. This is a flat list of pairings, not day-by-day scheduling.
      for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
          pairings.push([teams[i], teams[j]]);
        }
      }
    }

    if (pairings.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Not enough teams to generate any fixtures'
      });
    }

    // Spread scheduled dates evenly between the tournament's start and end
    // dates. Simple even spacing — no attempt to avoid multiple matches
    // landing on the same day.
    const start = new Date(tournament.startDate).getTime();
    const end = new Date(tournament.endDate).getTime();
    const span = end - start;

    const createdMatchIds = [];
    for (let i = 0; i < pairings.length; i++) {
      const [team1, team2] = pairings[i];
      const scheduledDate = pairings.length === 1
        ? new Date(start)
        : new Date(start + (span * i) / (pairings.length - 1));

      const match = await Match.create({
        title: `${team1.name} vs ${team2.name}`,
        team1: team1._id,
        team2: team2._id,
        matchType: tournament.matchType,
        venue: tournament.venue,
        pitchType: 'unknown',
        scheduledDate,
        createdBy: req.user.id,
        tournament: tournament._id,
        innings: [
          { team: team1._id, runs: 0, wickets: 0, overs: 0, balls: [] },
          { team: team2._id, runs: 0, wickets: 0, overs: 0, balls: [] }
        ]
      });

      tournament.matches.push(match._id);
      createdMatchIds.push(match._id);
    }

    await tournament.save();

    const matches = await Match.find({ _id: { $in: createdMatchIds } })
      .populate('team1')
      .populate('team2');
    // Preserve generation order (pairing order / scheduled date order)
    // rather than whatever order Match.find happens to return.
    const matchesById = new Map(matches.map((m) => [m._id.toString(), m]));
    const orderedMatches = createdMatchIds.map((id) => matchesById.get(id.toString()));

    res.status(201).json({
      success: true,
      count: orderedMatches.length,
      matches: orderedMatches
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get tournament statistics
// @route   GET /api/tournaments/:id/statistics
// @access  Public
exports.getTournamentStats = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    res.status(200).json({
      success: true,
      statistics: {
        name: tournament.name,
        format: tournament.format,
        status: tournament.status,
        totalTeams: tournament.teams.length,
        maxTeams: tournament.maxTeams,
        ...tournament.statistics,
        standings: tournament.getLeaderboard()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Compute and save tournament awards (winner, runner-up, third place,
//          man of the tournament, best batsman, best bowler)
// @route   POST /api/tournaments/:id/compute-awards
// @access  Private (organizer only)
exports.computeAwards = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    if (tournament.organizer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to compute awards for this tournament'
      });
    }

    if (tournament.status !== 'Completed') {
      return res.status(400).json({
        success: false,
        message: 'Awards can only be computed once the tournament status is Completed'
      });
    }

    // Winner / runner-up / third place come straight from the points table -
    // getLeaderboard() is already sorted best-first by points then NRR.
    const leaderboard = tournament.getLeaderboard();
    tournament.awards.winner = leaderboard[0]?.team || null;
    tournament.awards.runnerUp = leaderboard[1]?.team || null;
    tournament.awards.thirdPlace = tournament.teams.length >= 3 ? (leaderboard[2]?.team || null) : null;

    // Best batsman: highest career average among this tournament's matches, requiring
    // at least 1 completed innings with the bat and > 0 runs (mirrors the minimum-sample
    // convention already used by the global getBattingLeaderboard). Best bowler: lowest
    // career average, requiring at least 1 wicket (mirrors getBowlingLeaderboard). Both
    // leaderboards return [] rather than throwing when a tournament has no qualifying
    // data, so these safely resolve to null instead of crashing.
    const [battingLeaders, bowlingLeaders] = await Promise.all([
      tendencyAnalytics.getTournamentBattingLeaderboard(tournament._id, 1),
      tendencyAnalytics.getTournamentBowlingLeaderboard(tournament._id, 1)
    ]);
    tournament.awards.bestBatsman = battingLeaders[0]?._id || null;
    tournament.awards.bestBowler = bowlingLeaders[0]?._id || null;

    tournament.awards.manOfTheTournament = await computeManOfTheTournament(tournament._id);

    await tournament.save();

    const populated = await Tournament.findById(tournament._id)
      .populate('organizer')
      .populate('teams')
      .populate('standings.team')
      .populate('awards.winner')
      .populate('awards.runnerUp')
      .populate('awards.thirdPlace')
      .populate({ path: 'awards.manOfTheTournament', populate: { path: 'user', select: 'name' } })
      .populate({ path: 'awards.bestBatsman', populate: { path: 'user', select: 'name' } })
      .populate({ path: 'awards.bestBowler', populate: { path: 'user', select: 'name' } });

    res.status(200).json({
      success: true,
      message: 'Tournament awards computed successfully',
      tournament: populated
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete tournament
// @route   DELETE /api/tournaments/:id
// @access  Private
exports.deleteTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    if (tournament.organizer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this tournament'
      });
    }

    await Tournament.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Tournament deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

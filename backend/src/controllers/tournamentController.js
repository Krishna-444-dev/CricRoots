const Tournament = require('../models/Tournament');
const Team = require('../models/Team');
const Match = require('../models/Match');
const League = require('../models/League');
const Player = require('../models/Player');
const tendencyAnalytics = require('../services/tendencyAnalytics');

async function toPlayerSummary(playerId) {
  const player = await Player.findById(playerId).populate('user', 'name');
  if (!player) return null;
  return { _id: player._id, name: player.user?.name ?? 'Unknown', specialization: player.specialization };
}

// Splits `items` into `count` evenly sized chunks (base size floor(n/count), the first
// n % count chunks getting one extra item - e.g. 20 items / 2 chunks = 10/10; 21/2 = 11/10),
// each named via `nameFn(index)`. Shared by assignDivisions (splitting a tournament's teams
// into divisions) and assignGroups (splitting a division's - or a whole tournament's - teams
// into groups), so the two levels use identical, deterministic splitting logic.
function splitEvenly(items, count, nameFn) {
  const n = items.length;
  const base = Math.floor(n / count);
  const remainder = n % count;
  const chunks = [];
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    const size = base + (i < remainder ? 1 : 0);
    chunks.push({ name: nameFn(i), items: items.slice(cursor, cursor + size) });
    cursor += size;
  }
  return chunks;
}

// Group names cycle A, B, C, ... Z; beyond 26 groups (not a realistic case here) falls back
// to a numbered name rather than producing garbage characters.
function groupName(i) {
  return i < 26 ? `Group ${String.fromCharCode(65 + i)}` : `Group ${i + 1}`;
}

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
async function computeManOfTheTournament(tournamentId, divisionName = null) {
  const matches = await Match.find({
    tournament: tournamentId,
    status: 'Completed',
    division: divisionName
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
      rules,
      leagueId
    } = req.body;

    if (!name || !venue || !startDate || !endDate || !registrationDeadline) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    let league = null;
    if (leagueId) {
      league = await League.findById(leagueId);
      if (!league) {
        return res.status(404).json({
          success: false,
          message: 'League not found'
        });
      }
    }

    const tournament = await Tournament.create({
      name,
      description,
      organizer: req.user.id,
      league: league ? league._id : null,
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
      .populate('divisions.teams')
      .populate('divisions.groups.teams')
      .populate('divisions.awards.winner')
      .populate('divisions.awards.runnerUp')
      .populate('divisions.awards.thirdPlace')
      .populate({ path: 'divisions.awards.manOfTheTournament', populate: { path: 'user', select: 'name' } })
      .populate({ path: 'divisions.awards.bestBatsman', populate: { path: 'user', select: 'name' } })
      .populate({ path: 'divisions.awards.bestBowler', populate: { path: 'user', select: 'name' } })
      .sort({ [sortBy]: parseInt(order) });

    // tournament.statistics.completedMatches is a stored field nothing ever wrote to (always
    // 0) - one cheap aggregation across every tournament's Completed matches, rather than an
    // N+1 count query per tournament in this list.
    const completedCounts = await Match.aggregate([
      { $match: { status: 'Completed', tournament: { $in: tournaments.map((t) => t._id) } } },
      { $group: { _id: '$tournament', count: { $sum: 1 } } }
    ]);
    const completedByTournament = new Map(completedCounts.map((c) => [c._id.toString(), c.count]));
    const tournamentsWithLiveCounts = tournaments.map((t) => {
      const obj = t.toObject();
      obj.statistics = {
        ...obj.statistics,
        totalMatches: t.matches.length,
        completedMatches: completedByTournament.get(t._id.toString()) || 0
      };
      return obj;
    });

    res.status(200).json({
      success: true,
      count: tournaments.length,
      tournaments: tournamentsWithLiveCounts
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
      .populate({ path: 'awards.bestBowler', populate: { path: 'user', select: 'name' } })
      .populate('divisions.teams')
      .populate('divisions.groups.teams')
      .populate('divisions.awards.winner')
      .populate('divisions.awards.runnerUp')
      .populate('divisions.awards.thirdPlace')
      .populate({ path: 'divisions.awards.manOfTheTournament', populate: { path: 'user', select: 'name' } })
      .populate({ path: 'divisions.awards.bestBatsman', populate: { path: 'user', select: 'name' } })
      .populate({ path: 'divisions.awards.bestBowler', populate: { path: 'user', select: 'name' } });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Same live-count fix as getAllTournaments - matches is already populated above, so this
    // is free (no extra query).
    const tournamentObj = tournament.toObject();
    tournamentObj.statistics = {
      ...tournamentObj.statistics,
      totalMatches: tournament.matches.length,
      completedMatches: tournament.matches.filter((m) => m.status === 'Completed').length
    };

    res.status(200).json({
      success: true,
      tournament: tournamentObj
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

// @desc    Add a document to this tournament's document library (league rules, registration
//          guide, captain guide, nomination sheet, etc.) - req.file is populated by
//          uploadTournamentDocument (see routes/tournamentRoutes.js, which wraps it the same
//          callback-checked way groupRoutes.js does for attachments); `category` is a free-text
//          label from the request body.
// @route   POST /api/tournaments/:id/documents
// @access  Private (organizer only)
exports.addTournamentDocument = async (req, res) => {
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
        message: 'Not authorized to upload a document for this tournament'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    tournament.documents.push({
      url: `/uploads/tournament-documents/${req.file.filename}`,
      fileName: req.file.originalname,
      category: (req.body.category || 'General').toString().trim().slice(0, 100) || 'General',
      uploadedAt: new Date()
    });
    await tournament.save();

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

// @desc    Remove one document from this tournament's document library
// @route   DELETE /api/tournaments/:id/documents/:documentId
// @access  Private (organizer only)
exports.removeTournamentDocument = async (req, res) => {
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
        message: 'Not authorized to remove this document'
      });
    }

    const { documentId } = req.params;
    const exists = tournament.documents.some((doc) => doc._id.toString() === documentId);
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    tournament.documents = tournament.documents.filter((doc) => doc._id.toString() !== documentId);
    await tournament.save();

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

// @desc    Get one division's (or, for a tournament with no divisions, the whole tournament's)
//          registered teams with full rosters populated - captain/viceCaptain/players, each
//          with their linked user's name (mirrors teamController.js's PLAYER_POPULATE pattern)
//          and profilePicture. Powers the Teams tab, scoped by the same division-pill selector
//          the Standings/Bracket/Awards tabs already use.
// @route   GET /api/tournaments/:id/teams
// @access  Public
exports.getTournamentTeams = async (req, res) => {
  try {
    const { division: divisionName } = req.query;
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    let teamIds;
    if (tournament.divisions && tournament.divisions.length > 0) {
      if (!divisionName) {
        return res.status(400).json({
          success: false,
          message: 'This tournament uses divisions - pass `division` to select which one'
        });
      }
      const division = tournament.divisions.find((d) => d.name === divisionName);
      if (!division) {
        return res.status(404).json({
          success: false,
          message: `Division "${divisionName}" not found`
        });
      }
      teamIds = division.teams;
    } else {
      teamIds = tournament.teams;
    }

    const userPopulate = { path: 'user', select: 'name' };
    const teams = await Team.find({ _id: { $in: teamIds } })
      .populate({ path: 'captain', populate: userPopulate })
      .populate({ path: 'viceCaptain', populate: userPopulate })
      .populate({ path: 'players', populate: userPopulate });

    res.status(200).json({
      success: true,
      division: divisionName || null,
      count: teams.length,
      teams
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

// Computes ranked per-group standings from real match data - shared by the flat-groups case
// (divisionName: null) and each division's own groups (divisionName: that division's name).
// Matches are filtered by division as well as group, since group names ("Group A", "Group B")
// are only unique *within* a division, not across the whole tournament - two divisions each
// independently generate their own "Group A".
async function computeGroupedStandings(tournamentId, groups, rules, divisionName) {
  const matches = await Match.find({
    tournament: tournamentId,
    status: { $in: ['Completed', 'Cancelled'] },
    group: { $ne: null },
    division: divisionName
  });

  // One Team lookup covering every group, rather than one per group.
  const allTeamIds = [...new Set(groups.flatMap((group) => group.teams.map((teamId) => teamId.toString())))];
  const teamDocs = await Team.find({ _id: { $in: allTeamIds } });
  const teamById = new Map(teamDocs.map((t) => [t._id.toString(), t]));

  return groups.map((group) => {
    const groupMatches = matches.filter((m) => m.group === group.name);
    const table = Tournament.buildStandingsTable(groupMatches, group.teams, rules);
    const ranked = Tournament.rankStandings(table).map((row) => ({
      ...row,
      team: teamById.get(row.team.toString()) || row.team
    }));
    return { name: group.name, standings: ranked };
  });
}

// @desc    Get tournament standings - one flat points table, OR one points table per group
//          (when the tournament has groups assigned), OR one points table per group per
//          division (when the tournament has divisions - each division's groups are entirely
//          independent of any other division's).
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

    if (tournament.divisions && tournament.divisions.length > 0) {
      const divisions = await Promise.all(
        tournament.divisions.map(async (division) => ({
          name: division.name,
          groups: await computeGroupedStandings(tournament._id, division.groups, tournament.rules, division.name)
        }))
      );
      return res.status(200).json({ success: true, divisions });
    }

    if (tournament.groups && tournament.groups.length > 0) {
      const groups = await computeGroupedStandings(tournament._id, tournament.groups, tournament.rules, null);
      return res.status(200).json({ success: true, groups });
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

// @desc    Split a tournament's registered teams into evenly sized, named divisions ahead of
//          assign-groups/generate-fixtures - each division then runs as a fully independent
//          competition (own groups, standings, knockout bracket, awards). Splits
//          `tournament.teams` in their existing (registration) order - deliberately not
//          shuffled, so this is deterministic and reproducible if ever re-run before groups
//          exist. Mutually exclusive with the flat `groups` a non-divisioned tournament uses.
// @route   POST /api/tournaments/:id/assign-divisions
// @access  Private (organizer only)
exports.assignDivisions = async (req, res) => {
  try {
    const { divisionCount, divisionNames } = req.body;

    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }
    if (tournament.organizer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to assign divisions for this tournament' });
    }
    if (tournament.matches.length > 0) {
      return res.status(400).json({ success: false, message: 'Divisions must be assigned before fixtures are generated for this tournament' });
    }
    if (tournament.groups && tournament.groups.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'This tournament already uses flat groups - a tournament uses either groups or divisions, not both'
      });
    }

    let names;
    if (Array.isArray(divisionNames) && divisionNames.length > 0) {
      names = divisionNames.map(String);
    } else {
      const count = parseInt(divisionCount, 10);
      if (!count || count < 1) {
        return res.status(400).json({ success: false, message: 'Provide divisionCount (a positive integer) or divisionNames (a non-empty array)' });
      }
      names = Array.from({ length: count }, (_, i) => `Division ${i + 1}`);
    }

    if (tournament.teams.length < names.length) {
      return res.status(400).json({
        success: false,
        message: `Not enough registered teams (${tournament.teams.length}) to form ${names.length} divisions`
      });
    }

    const chunks = splitEvenly(tournament.teams, names.length, (i) => names[i]);
    tournament.divisions = chunks.map(({ name, items }) => ({ name, teams: items, groups: [], awards: {} }));

    await tournament.save();
    await tournament.populate('teams');
    await tournament.populate('divisions.teams');

    res.status(200).json({ success: true, tournament });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Split a tournament's (or, if `division` is given, one division's) registered teams
//          into evenly sized, named groups ahead of fixture generation. Splits teams in their
//          existing (registration) order - deliberately not shuffled, so this is deterministic
//          and reproducible if ever re-run before fixtures exist.
// @route   POST /api/tournaments/:id/assign-groups
// @access  Private (organizer only)
exports.assignGroups = async (req, res) => {
  try {
    const { groupCount, division: divisionName } = req.body;

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
        message: 'Not authorized to assign groups for this tournament'
      });
    }

    if (tournament.matches.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Groups must be assigned before fixtures are generated for this tournament'
      });
    }

    const count = parseInt(groupCount, 10);
    if (!count || count < 1) {
      return res.status(400).json({
        success: false,
        message: 'groupCount must be a positive integer'
      });
    }

    // Division-scoped: split that division's own teams, storing the result on the division
    // sub-document rather than the tournament-level `groups` field.
    if (divisionName) {
      const division = tournament.divisions.find((d) => d.name === divisionName);
      if (!division) {
        return res.status(404).json({ success: false, message: `Division "${divisionName}" not found` });
      }
      if (division.teams.length < count) {
        return res.status(400).json({
          success: false,
          message: `Not enough teams in ${divisionName} (${division.teams.length}) to form ${count} groups`
        });
      }
      const chunks = splitEvenly(division.teams, count, groupName);
      division.groups = chunks.map(({ name, items }) => ({ name, teams: items }));

      await tournament.save();
      await tournament.populate('teams');
      await tournament.populate('divisions.teams');
      await tournament.populate('divisions.groups.teams');

      return res.status(200).json({ success: true, tournament });
    }

    if (tournament.divisions && tournament.divisions.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'This tournament uses divisions - pass `division` to assign groups within a specific division'
      });
    }

    if (tournament.teams.length < count) {
      return res.status(400).json({
        success: false,
        message: `Not enough registered teams (${tournament.teams.length}) to form ${count} groups`
      });
    }

    const chunks = splitEvenly(tournament.teams, count, groupName);
    tournament.groups = chunks.map(({ name, items }) => ({ name, teams: items }));

    await tournament.save();
    await tournament.populate('teams');
    await tournament.populate('groups.teams');

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
    const tournament = await Tournament.findById(req.params.id)
      .populate('teams')
      .populate('groups.teams')
      .populate('divisions.teams')
      .populate('divisions.groups.teams');

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

    // Each pairing carries its own division/group/round tag so all three branches below can
    // feed the same match-creation loop.
    const pairings = [];

    if (tournament.divisions && tournament.divisions.length > 0) {
      // Divisions have been assigned (see assignDivisions) - every division must have its own
      // groups too (see assignGroups with a `division`) before fixtures can be generated, since
      // there's no sensible flat-round-robin fallback once a tournament has committed to
      // divisions.
      const divisionsWithoutGroups = tournament.divisions.filter((d) => !d.groups || d.groups.length === 0);
      if (divisionsWithoutGroups.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Assign groups within every division first - missing for: ${divisionsWithoutGroups.map((d) => d.name).join(', ')}`
        });
      }
      tournament.divisions.forEach((division) => {
        division.groups.forEach((group) => {
          const groupTeams = group.teams;
          for (let i = 0; i < groupTeams.length; i++) {
            for (let j = i + 1; j < groupTeams.length; j++) {
              pairings.push({
                team1: groupTeams[i],
                team2: groupTeams[j],
                division: division.name,
                group: group.name,
                round: 'Group'
              });
            }
          }
        });
      });
    } else if (tournament.groups && tournament.groups.length > 0) {
      // Groups have been assigned (see assignGroups) - generate a full round-robin
      // independently within each group (every unique pair of that group's teams plays
      // exactly once), tagged with that group's name and round: 'Group'. The tournament's
      // `format` field is irrelevant once groups exist - a group stage is always round-robin.
      tournament.groups.forEach((group) => {
        const groupTeams = group.teams;
        for (let i = 0; i < groupTeams.length; i++) {
          for (let j = i + 1; j < groupTeams.length; j++) {
            pairings.push({ team1: groupTeams[i], team2: groupTeams[j], group: group.name, round: 'Group' });
          }
        }
      });
    } else {
      // No groups - 100% of the original behavior, just expressed as tagged pairings so it
      // can share the match-creation loop below. `group` is always null and `round` is always
      // 'Group' here, which are exactly the schema defaults a pre-groups Match would have had.

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

      if (format === 'knockout') {
        // NOTE: This only generates Round 1. A knockout bracket's later rounds
        // depend on who wins each earlier match, which isn't known at
        // generation time — so we deliberately stop after pairing up the
        // registered teams once. Once Round 1 results are in, the organizer
        // creates Round 2+ matches manually (or re-runs a future "next round"
        // feature, which is out of scope here).
        for (let i = 0; i + 1 < teams.length; i += 2) {
          pairings.push({ team1: teams[i], team2: teams[i + 1], group: null, round: 'Group' });
        }
        // If there's an odd number of teams, the last team gets a bye for
        // this round — no match is created for them.
      } else {
        // Round-robin: every unique pair of registered teams plays exactly
        // once. This is a flat list of pairings, not day-by-day scheduling.
        for (let i = 0; i < teams.length; i++) {
          for (let j = i + 1; j < teams.length; j++) {
            pairings.push({ team1: teams[i], team2: teams[j], group: null, round: 'Group' });
          }
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
      const { team1, team2, division, group, round } = pairings[i];
      const scheduledDate = pairings.length === 1
        ? new Date(start)
        : new Date(start + (span * i) / (pairings.length - 1));

      const match = await Match.create({
        title: division ? `${division}: ${team1.name} vs ${team2.name}` : `${team1.name} vs ${team2.name}`,
        team1: team1._id,
        team2: team2._id,
        matchType: tournament.matchType,
        venue: tournament.venue,
        pitchType: 'unknown',
        scheduledDate,
        createdBy: req.user.id,
        tournament: tournament._id,
        division: division || null,
        group,
        round,
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

// Builds the standard cross-group Quarterfinal seeding for exactly 2 groups of N qualifiers
// each (group ranks 1..N per group, e.g. A1..A4 and B1..B4 for N=4):
//   QF1: A1 vs B4   QF2: A2 vs B3   QF3: B1 vs A4   QF4: B2 vs A3
// This is the one bracket shape this endpoint guarantees is correct; >2 groups falls back to
// a simpler "rank 1 vs rank N, rank 2 vs rank N-1, ..." cross-seed across the combined pool,
// which is reasonable but not a claimed standard for that case.
function seedQuarterfinals(groupsRanked, qualifiersPerGroup) {
  const pairs = [];
  if (groupsRanked.length === 2) {
    const [A, B] = groupsRanked;
    pairs.push([A[0], B[3] ?? B[B.length - 1]]);
    pairs.push([A[1], B[2] ?? B[B.length - 1]]);
    pairs.push([B[0], A[3] ?? A[A.length - 1]]);
    pairs.push([B[1], A[2] ?? A[A.length - 1]]);
    return pairs;
  }
  const pool = groupsRanked.flat();
  for (let i = 0; i < Math.floor(pool.length / 2); i++) {
    pairs.push([pool[i], pool[pool.length - 1 - i]]);
  }
  return pairs;
}

// Creates one knockout Match document, mirroring createMatch's own innings-initialization and
// required-field shape exactly so these matches behave identically to any other once created.
async function createKnockoutMatch({ tournament, team1, team2, round, req, matchNumber, division }) {
  const scheduledDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // a week out, organizer can reschedule
  const titlePrefix = division ? `${tournament.name} - ${division}` : tournament.name;
  const match = await Match.create({
    title: `${titlePrefix} - ${round} ${matchNumber || ''}`.trim(),
    team1: team1._id || team1,
    team2: team2._id || team2,
    matchType: tournament.matchType,
    venue: tournament.venue,
    totalOvers: tournament.rules?.overs || 20,
    scheduledDate,
    createdBy: req.user.id,
    tournament: tournament._id,
    division: division || null,
    group: null,
    round,
    innings: [
      { team: team1._id || team1, runs: 0, wickets: 0, overs: 0, balls: [] },
      { team: team2._id || team2, runs: 0, wickets: 0, overs: 0, balls: [] }
    ]
  });
  tournament.matches.push(match._id);
  return match;
}

// @desc    Seed the knockout bracket from each group's current standings - the top
//          `qualifiersPerGroup` teams per group advance, cross-seeded (see seedQuarterfinals).
//          Only supports going straight to Quarterfinals from group standings; later rounds
//          are generated one at a time by advanceKnockoutRound as results come in. When the
//          tournament has divisions, `division` in the body selects which one to seed - each
//          division's knockout stage is generated and advanced entirely independently.
// @route   POST /api/tournaments/:id/generate-knockout-stage
// @access  Private (organizer only)
exports.generateKnockoutStage = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .populate('groups.teams')
      .populate('divisions.groups.teams');

    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }
    if (tournament.organizer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to generate the knockout stage for this tournament' });
    }

    const divisionName = req.body.division || null;
    let groups;
    if (tournament.divisions && tournament.divisions.length > 0) {
      if (!divisionName) {
        return res.status(400).json({ success: false, message: 'This tournament uses divisions - pass `division` to select which one' });
      }
      const division = tournament.divisions.find((d) => d.name === divisionName);
      if (!division) {
        return res.status(404).json({ success: false, message: `Division "${divisionName}" not found` });
      }
      if (!division.groups || division.groups.length === 0) {
        return res.status(400).json({ success: false, message: `${divisionName} has no groups assigned` });
      }
      groups = division.groups;
    } else {
      if (!tournament.groups || tournament.groups.length === 0) {
        return res.status(400).json({ success: false, message: 'This tournament has no groups assigned' });
      }
      groups = tournament.groups;
    }

    const existingKnockout = await Match.exists({ tournament: tournament._id, division: divisionName, round: 'Quarterfinal' });
    if (existingKnockout) {
      return res.status(400).json({
        success: false,
        message: divisionName
          ? `The knockout stage has already been generated for ${divisionName}`
          : 'The knockout stage has already been generated for this tournament'
      });
    }

    const qualifiersPerGroup = parseInt(req.body.qualifiersPerGroup, 10) || 4;

    const groupsRanked = [];
    for (const group of groups) {
      if (group.teams.length < qualifiersPerGroup) {
        return res.status(400).json({
          success: false,
          message: `${group.name} has only ${group.teams.length} teams, fewer than qualifiersPerGroup (${qualifiersPerGroup})`
        });
      }
      const matches = await Match.find({
        tournament: tournament._id,
        division: divisionName,
        group: group.name,
        status: { $in: ['Completed', 'Cancelled'] }
      });
      const table = Tournament.buildStandingsTable(matches, group.teams, tournament.rules);
      const ranked = Tournament.rankStandings(table).slice(0, qualifiersPerGroup);
      groupsRanked.push(ranked.map((row) => row.team));
    }

    const pairs = seedQuarterfinals(groupsRanked, qualifiersPerGroup);
    const created = [];
    for (let i = 0; i < pairs.length; i++) {
      const [team1, team2] = pairs[i];
      created.push(await createKnockoutMatch({ tournament, team1, team2, round: 'Quarterfinal', req, matchNumber: i + 1, division: divisionName }));
    }

    await tournament.save();
    const populated = await Match.find({ _id: { $in: created.map((m) => m._id) } }).populate('team1').populate('team2');

    res.status(201).json({ success: true, division: divisionName, round: 'Quarterfinal', matches: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Once every match in the current furthest-generated knockout round (for the given
//          `division`, if the tournament has divisions) is Completed, derive winners and
//          create the next round (Quarterfinal -> Semifinal -> Final), or if the Final itself
//          is what just completed, set the winner/runnerUp - on the division's own `awards`
//          sub-document if this tournament has divisions, else the tournament's top-level
//          `awards` - and mark the tournament Completed once every division (or, without
//          divisions, the tournament itself) has finished. Winner derivation matches
//          updateMatch's own auto-derived-result logic exactly (higher innings total wins); an
//          exact tie deterministically advances team1 rather than erroring, since a knockout
//          match can't stay unresolved for bracket-advancement purposes and a genuine
//          dead-even tie is vanishingly rare.
// @route   POST /api/tournaments/:id/advance-knockout-round
// @access  Private (organizer only)
exports.advanceKnockoutRound = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }
    if (tournament.organizer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to advance the knockout stage for this tournament' });
    }

    const hasDivisions = tournament.divisions && tournament.divisions.length > 0;
    const divisionName = req.body.division || null;
    if (hasDivisions && !divisionName) {
      return res.status(400).json({ success: false, message: 'This tournament uses divisions - pass `division` to select which one' });
    }
    let division = null;
    if (hasDivisions) {
      division = tournament.divisions.find((d) => d.name === divisionName);
      if (!division) {
        return res.status(404).json({ success: false, message: `Division "${divisionName}" not found` });
      }
    }

    const ROUND_ORDER = ['Quarterfinal', 'Semifinal', 'Final'];
    let currentRound = null;
    for (const round of ROUND_ORDER) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await Match.exists({ tournament: tournament._id, division: divisionName, round });
      if (exists) currentRound = round;
    }
    if (!currentRound) {
      return res.status(400).json({ success: false, message: 'Generate the knockout stage first' });
    }

    const roundMatches = await Match.find({ tournament: tournament._id, division: divisionName, round: currentRound }).sort({ createdAt: 1 });
    const incomplete = roundMatches.filter((m) => m.status !== 'Completed');
    if (incomplete.length > 0) {
      return res.status(400).json({
        success: false,
        message: `${currentRound} still has ${incomplete.length} match(es) not marked Completed`
      });
    }

    const winnerOf = (match) => {
      const runs1 = match.innings[0]?.runs || 0;
      const runs2 = match.innings[1]?.runs || 0;
      return runs1 >= runs2 ? match.team1 : match.team2; // ties deterministically favor team1 - see doc comment above
    };
    const loserOf = (match) => {
      const winner = winnerOf(match);
      return winner.toString() === match.team1.toString() ? match.team2 : match.team1;
    };

    if (currentRound === 'Quarterfinal') {
      if (roundMatches.length !== 4) {
        return res.status(400).json({ success: false, message: `Expected 4 Quarterfinal matches, found ${roundMatches.length}` });
      }
      const winners = roundMatches.map(winnerOf);
      const sf1 = await createKnockoutMatch({ tournament, team1: winners[0], team2: winners[1], round: 'Semifinal', req, matchNumber: 1, division: divisionName });
      const sf2 = await createKnockoutMatch({ tournament, team1: winners[2], team2: winners[3], round: 'Semifinal', req, matchNumber: 2, division: divisionName });
      await tournament.save();
      const populated = await Match.find({ _id: { $in: [sf1._id, sf2._id] } }).populate('team1').populate('team2');
      return res.status(201).json({ success: true, division: divisionName, round: 'Semifinal', matches: populated });
    }

    if (currentRound === 'Semifinal') {
      if (roundMatches.length !== 2) {
        return res.status(400).json({ success: false, message: `Expected 2 Semifinal matches, found ${roundMatches.length}` });
      }
      const winners = roundMatches.map(winnerOf);
      const final = await createKnockoutMatch({ tournament, team1: winners[0], team2: winners[1], round: 'Final', req, division: divisionName });
      await tournament.save();
      const populated = await Match.findById(final._id).populate('team1').populate('team2');
      return res.status(201).json({ success: true, division: divisionName, round: 'Final', matches: [populated] });
    }

    // currentRound === 'Final'
    const final = roundMatches[0];
    if (division) {
      division.awards.winner = winnerOf(final);
      division.awards.runnerUp = loserOf(final);
      // The whole tournament only moves to Completed once every division has crowned a
      // winner - a still-running Division 2 shouldn't make Division 1's early finish look
      // like the entire tournament is done.
      if (tournament.divisions.every((d) => d.awards.winner)) {
        tournament.status = 'Completed';
      }
    } else {
      tournament.awards.winner = winnerOf(final);
      tournament.awards.runnerUp = loserOf(final);
      tournament.status = 'Completed';
    }
    await tournament.save();
    const populated = await Tournament.findById(tournament._id)
      .populate('awards.winner')
      .populate('awards.runnerUp')
      .populate('divisions.awards.winner')
      .populate('divisions.awards.runnerUp');
    return res.status(200).json({ success: true, division: divisionName, round: 'Completed', tournament: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

    // Computed live from the tournament's own Completed matches - tournament.statistics
    // itself is a stored sub-document nothing in this codebase ever wrote to, so it always
    // stayed at its schema defaults (all zeros) regardless of how many matches were played.
    const liveStats = await tendencyAnalytics.getTournamentMatchStatistics(tournament._id);

    res.status(200).json({
      success: true,
      statistics: {
        name: tournament.name,
        format: tournament.format,
        status: tournament.status,
        totalTeams: tournament.teams.length,
        maxTeams: tournament.maxTeams,
        totalMatches: tournament.matches.length,
        ...liveStats,
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

    if (tournament.divisions && tournament.divisions.length > 0) {
      // Each division gets its own best batsman/bowler/MVP, scoped to just that division's
      // matches. Winner/runner-up aren't derived here at all - advanceKnockoutRound already
      // sets them from the division's actual Final result once it finishes (a divisioned
      // tournament is expected to always run a real knockout stage, unlike a flat tournament,
      // which can skip straight from group standings to awards with no bracket at all).
      for (const division of tournament.divisions) {
        // eslint-disable-next-line no-await-in-loop
        const [battingLeaders, bowlingLeaders] = await Promise.all([
          tendencyAnalytics.getTournamentBattingLeaderboard(tournament._id, 1, division.name),
          tendencyAnalytics.getTournamentBowlingLeaderboard(tournament._id, 1, division.name)
        ]);
        division.awards.bestBatsman = battingLeaders[0]?._id || null;
        division.awards.bestBowler = bowlingLeaders[0]?._id || null;
        // eslint-disable-next-line no-await-in-loop
        division.awards.manOfTheTournament = await computeManOfTheTournament(tournament._id, division.name);
      }
    } else {
      // Winner/runner-up come straight from the points table for a pure round-robin/League
      // tournament with no knockout stage - but if this tournament went through
      // advanceKnockoutRound, that already set awards.winner/runnerUp from the actual Final
      // result, which is the real answer and must not be overwritten by whoever merely topped
      // the group-stage points table (a group leader can still lose in the knockout rounds).
      // getLeaderboard() is already sorted best-first by points then NRR.
      if (!tournament.awards.winner) {
        const leaderboard = tournament.getLeaderboard();
        tournament.awards.winner = leaderboard[0]?.team || null;
        tournament.awards.runnerUp = leaderboard[1]?.team || null;
        tournament.awards.thirdPlace = tournament.teams.length >= 3 ? (leaderboard[2]?.team || null) : null;
      }

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
    }

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
      .populate({ path: 'awards.bestBowler', populate: { path: 'user', select: 'name' } })
      .populate('divisions.teams')
      .populate('divisions.awards.winner')
      .populate('divisions.awards.runnerUp')
      .populate('divisions.awards.thirdPlace')
      .populate({ path: 'divisions.awards.manOfTheTournament', populate: { path: 'user', select: 'name' } })
      .populate({ path: 'divisions.awards.bestBatsman', populate: { path: 'user', select: 'name' } })
      .populate({ path: 'divisions.awards.bestBowler', populate: { path: 'user', select: 'name' } });

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

// @desc    Top run-scorers, wicket-takers, and fielders for this tournament (batsmen/bowlers
//          ranked by average, the same convention computeAwards's bestBatsman/bestBowler
//          already use; fielders ranked by total dismissals) - this just surfaces the top N
//          instead of only the single #1 pick. Also includes a combined, points-based
//          "Top Performer of Series" ranking (topPerformers) - see getTournamentTopPerformers.
//          Powers the "Top Performers" section alongside the tournament's awards. Pass
//          `division` to scope it to one division's own matches, for a tournament that has
//          divisions.
// @route   GET /api/tournaments/:id/leaderboard
// @access  Public
exports.getTournamentLeaderboard = async (req, res) => {
  try {
    const { limit = 20, division } = req.query;
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    const divisionName = division || null;
    const [battingRows, bowlingRows, fieldingRows, topPerformerRows] = await Promise.all([
      tendencyAnalytics.getTournamentBattingLeaderboard(tournament._id, parseInt(limit), divisionName),
      tendencyAnalytics.getTournamentBowlingLeaderboard(tournament._id, parseInt(limit), divisionName),
      tendencyAnalytics.getTournamentFieldingLeaderboard(tournament._id, parseInt(limit), divisionName),
      tendencyAnalytics.getTournamentTopPerformers(tournament._id, parseInt(limit), divisionName)
    ]);

    const batsmen = (
      await Promise.all(
        battingRows.map(async (r) => {
          const player = await toPlayerSummary(r._id);
          if (!player) return null;
          return {
            player,
            matches: r.matches,
            runs: r.runs,
            highestScore: r.highestScore,
            average: Math.round(r.average * 100) / 100,
            strikeRate: Math.round(r.strikeRate * 100) / 100
          };
        })
      )
    ).filter(Boolean);

    const bowlers = (
      await Promise.all(
        bowlingRows.map(async (r) => {
          const player = await toPlayerSummary(r._id);
          if (!player) return null;
          return {
            player,
            matches: r.matches,
            wickets: r.wickets,
            average: Math.round(r.average * 100) / 100,
            economyRate: Math.round(r.economyRate * 100) / 100
          };
        })
      )
    ).filter(Boolean);

    const fielding = (
      await Promise.all(
        fieldingRows.map(async (r) => {
          const player = await toPlayerSummary(r._id);
          if (!player) return null;
          return {
            player,
            matches: r.matches,
            catches: r.catches,
            runOuts: r.runOuts,
            stumpings: r.stumpings,
            dismissals: r.dismissals
          };
        })
      )
    ).filter(Boolean);

    const topPerformers = (
      await Promise.all(
        topPerformerRows.map(async (r) => {
          const player = await toPlayerSummary(r._id);
          if (!player) return null;
          return { player, points: r.points };
        })
      )
    ).filter(Boolean);

    res.status(200).json({
      success: true,
      batsmen,
      bowlers,
      fielding,
      topPerformers
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

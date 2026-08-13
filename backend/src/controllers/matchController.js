const Match = require('../models/Match');
const Team = require('../models/Team');
const Player = require('../models/Player');
const Tournament = require('../models/Tournament');
const AIService = require('../utils/aiService');
const { getMatchCharts } = require('../services/matchCharts');
const { computeMatchMVP } = require('../services/mvpCalculator');
const { generateCommentary } = require('../services/commentaryGenerator');
const { getKeyMoments } = require('../services/keyMoments');
const { settlePredictions } = require('../services/predictionSettler');
const { generateMatchArticle } = require('../services/matchArticleGenerator');
const { getMatchPerformanceReport } = require('../services/tendencyAnalytics');
const { resourcePercent, revisedTarget } = require('../services/rainRuleCalculator');

// Populate helper for manOfTheMatch: the field only stores a Player ref, but
// display needs the player's user's name - mirrors the nested Player->User
// populate pattern used for tournament awards in tournamentController.js.
const MAN_OF_THE_MATCH_POPULATE = { path: 'manOfTheMatch', populate: { path: 'user', select: 'name' } };

// A Live match sits in its first innings until the second one actually has balls -
// `status === 'Live'` alone can't tell those apart, so use whichever innings has been
// bowled at, defaulting to the first when neither has (freshly started match).
function currentInningsIndex(match) {
  return match.innings[1]?.balls?.length > 0 ? 1 : 0;
}

// Who's allowed to score/manage a match: the organizer who created it, an appointed umpire,
// or anyone actually rostered on either playing team - previously only createdBy could, which
// meant a single person had to score an entire match alone with no way to hand off. Umpire
// appointment itself stays creator-only (see addUmpire/removeUmpire) so this pool can't grow
// itself; being on it doesn't include the power to add more officials.
async function canManageMatch(match, userId) {
  if (match.createdBy.toString() === userId) return true;
  if ((match.umpires || []).some((u) => u.toString() === userId)) return true;

  const playerProfile = await Player.findOne({ user: userId });
  if (!playerProfile) return false;

  const [team1, team2] = await Promise.all([
    Team.findById(match.team1).select('players'),
    Team.findById(match.team2).select('players'),
  ]);
  const playerId = playerProfile._id.toString();
  const inTeam1 = team1?.players?.some((p) => p.toString() === playerId);
  const inTeam2 = team2?.players?.some((p) => p.toString() === playerId);
  return Boolean(inTeam1 || inTeam2);
}

// @desc    Create a new match
// @route   POST /api/matches
// @access  Private
exports.createMatch = async (req, res) => {
  try {
    const { title, team1Id, team2Id, matchType, venue, scheduledDate, pitchType, tournamentId, totalOvers } = req.body;

    if (!title || !team1Id || !team2Id || !venue || !scheduledDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    const team1 = await Team.findById(team1Id);
    const team2 = await Team.findById(team2Id);

    if (!team1 || !team2) {
      return res.status(404).json({
        success: false,
        message: 'One or both teams not found'
      });
    }

    let tournament = null;
    if (tournamentId) {
      tournament = await Tournament.findById(tournamentId);
      if (!tournament) {
        return res.status(404).json({
          success: false,
          message: 'Tournament not found'
        });
      }
    }

    // No implicit per-matchType over count is enforced anywhere else in this codebase (club
    // "T20" games don't always mean exactly 20 overs, and 'Friendly'/'Test' have no fixed
    // count) - only used as a fallback default when the creator doesn't specify totalOvers
    // explicitly, primarily so the rain-rule calculator always has a real reference to
    // normalize against.
    const DEFAULT_OVERS_BY_TYPE = { T20: 20, ODI: 50, Test: 90, Friendly: 20 };
    const resolvedTotalOvers = totalOvers || DEFAULT_OVERS_BY_TYPE[matchType] || 20;

    const match = await Match.create({
      title,
      team1: team1Id,
      team2: team2Id,
      matchType: matchType || 'T20',
      venue,
      pitchType: pitchType || 'unknown',
      scheduledDate,
      totalOvers: resolvedTotalOvers,
      createdBy: req.user.id,
      tournament: tournament ? tournament._id : null,
      innings: [
        { team: team1Id, runs: 0, wickets: 0, overs: 0, balls: [] },
        { team: team2Id, runs: 0, wickets: 0, overs: 0, balls: [] }
      ]
    });

    if (tournament) {
      tournament.matches.push(match._id);
      await tournament.save();
    }

    await match.populate('team1');
    await match.populate('team2');
    await match.populate('createdBy');

    // Emit match created event
    req.io.emit('match-created', {
      matchId: match._id,
      match,
      timestamp: new Date()
    });

    res.status(201).json({
      success: true,
      match
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all matches
// @route   GET /api/matches
// @access  Public
exports.getAllMatches = async (req, res) => {
  try {
    const matches = await Match.find()
      .populate('team1')
      .populate('team2')
      .populate(MAN_OF_THE_MATCH_POPULATE)
      .populate({ path: 'umpires', select: 'name' })
      .sort({ scheduledDate: -1 });

    res.status(200).json({
      success: true,
      count: matches.length,
      matches
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get match by ID
// @route   GET /api/matches/:id
// @access  Public
exports.getMatch = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate('team1')
      .populate('team2')
      .populate(MAN_OF_THE_MATCH_POPULATE)
      .populate('createdBy')
      .populate({ path: 'umpires', select: 'name' });

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    res.status(200).json({
      success: true,
      match
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update match status
// @route   PUT /api/matches/:id
// @access  Private
exports.updateMatch = async (req, res) => {
  try {
    let match = await Match.findById(req.params.id);

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    if (!(await canManageMatch(match, req.user.id))) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this match'
      });
    }

    const { status, toss, result, manOfTheMatch } = req.body;
    if (status) match.status = status;
    if (toss) match.toss = toss;
    if (result) match.result = result;
    if (manOfTheMatch) match.manOfTheMatch = manOfTheMatch;

    // Auto-derive the result from the innings totals when a match is marked
    // Completed without an explicit result being supplied.
    if (status === 'Completed' && !result) {
      const runs1 = match.innings[0]?.runs || 0;
      const runs2 = match.innings[1]?.runs || 0;
      if (runs1 === runs2) {
        match.result = { winningTeam: null, margin: 'tie', marginValue: 0 };
      } else if (runs1 > runs2) {
        match.result = { winningTeam: match.team1, margin: 'runs', marginValue: runs1 - runs2 };
      } else {
        match.result = { winningTeam: match.team2, margin: 'runs', marginValue: runs2 - runs1 };
      }
    }

    // Auto-compute Man of the Match from ball-by-ball data when a match is
    // marked Completed without an explicit manOfTheMatch being supplied -
    // same pattern as the auto-derived result above. Organizers can still
    // override by passing manOfTheMatch explicitly in the request body.
    if (status === 'Completed' && !manOfTheMatch) {
      match.manOfTheMatch = computeMatchMVP(match);
    }

    match = await match.save();
    await match.populate('team1');
    await match.populate('team2');
    await match.populate(MAN_OF_THE_MATCH_POPULATE);

    // Refresh the tournament's points table if this match belongs to one
    // and just moved into a state that counts toward standings.
    if (match.tournament && ['Completed', 'Cancelled'].includes(match.status)) {
      const tournament = await Tournament.findById(match.tournament);
      if (tournament) {
        await tournament.updateStandings();
        await tournament.save();
      }
    }

    // Settle the free points-based prediction game once a result exists - runs after save so
    // predictions never see a partially-committed match.result.
    if (match.status === 'Completed' && match.result) {
      await settlePredictions(match);
    }

    // Auto-generate a tournament news article spotlighting the match's standout performance
    // (century, five-wicket haul, etc). Wrapped so a bug here can never fail match completion
    // itself - this is a nice-to-have layered on top, not core to recording a result.
    if (match.status === 'Completed' && match.tournament) {
      try {
        const tournament = await Tournament.findById(match.tournament);
        if (tournament) {
          await generateMatchArticle(match, tournament);
        }
      } catch (articleError) {
        console.error('Match article generation failed:', articleError.message);
      }
    }

    // Emit match status change event
    req.socketManager.emitMatchStatusChange(match._id, match.status);

    res.status(200).json({
      success: true,
      match
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Record a ball in match with WebSocket and AI insights
// @route   POST /api/matches/:id/record-ball
// @access  Private
exports.recordBall = async (req, res) => {
  try {
    const {
      inningsIndex, ballNumber, batsmanId, bowlerId, runs, isWicket, wicketType,
      isExtra, extraType,
      line, length, shotType, shotZone, fielderId, fielderPosition,
      batsmanName, bowlerName, fielderName
    } = req.body;

    let match = await Match.findById(req.params.id);

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    if (!(await canManageMatch(match, req.user.id))) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this match'
      });
    }

    if (inningsIndex < 0 || inningsIndex >= match.innings.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid innings index'
      });
    }

    // Add ball to innings
    const ball = {
      ballNumber,
      batsmanId,
      bowlerId,
      runs: runs || 0,
      isWicket: isWicket || false,
      wicketType: wicketType || null,
      isExtra: isExtra || false,
      extraType: extraType || 'none',
      line: line || 'unknown',
      length: length || 'unknown',
      shotType: shotType || null,
      shotZone: shotZone || null,
      fielderId: fielderId || null,
      fielderPosition: fielderPosition || null
    };

    // Auto-generated commentary - names come from the client (already in state at the
    // moment a ball is scored) rather than a server-side lookup, to avoid adding DB
    // round-trips between this read and the save() below.
    ball.commentary = generateCommentary(ball, { batsmanName, bowlerName, fielderName });

    match.innings[inningsIndex].balls.push(ball);
    match.innings[inningsIndex].runs += runs || 0;
    if (isWicket) {
      match.innings[inningsIndex].wickets += 1;
    }

    // Calculate overs (6 legal balls = 1 over; wides/no-balls don't count toward the over)
    const legalBalls = match.innings[inningsIndex].balls.filter(
      b => !(b.isExtra && ['wide', 'no-ball'].includes(b.extraType))
    ).length;
    match.innings[inningsIndex].overs = Math.floor(legalBalls / 6) + (legalBalls % 6) / 10;

    match = await match.save();
    await match.populate('team1');
    await match.populate('team2');

    // Prepare match state for AI
    const matchState = {
      oversRemaining: 20 - (match.innings[inningsIndex].overs || 0),
      wicketsDown: match.innings[inningsIndex].wickets,
      currentRunRate: match.innings[inningsIndex].runs / (match.innings[inningsIndex].overs || 1),
      targetScore: match.innings[0]?.runs || 150,
      oppositionStrength: 7,
      pitchType: 1
    };

    // Emit ball recorded event via WebSocket
    req.socketManager.emitBallRecorded(match._id, ball, matchState);

    // Emit wicket event if applicable
    if (isWicket) {
      req.socketManager.emitWicket(match._id, {
        ballNumber,
        batsmanId,
        bowlerId,
        wicketType,
        currentWickets: match.innings[inningsIndex].wickets
      });
    }

    res.status(200).json({
      success: true,
      message: 'Ball recorded successfully',
      match
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Apply a rain/stoppage interruption, reducing innings[1] (the chasing team)'s
//          overs and computing a revised target - see rainRuleCalculator.js for the
//          calculation and its real accuracy/scope caveats (an approximation, not the
//          licensed official DLS algorithm; only covers the single most common scenario of
//          team 1 having completed their full original allocation and team 2's overs being
//          reduced, not arbitrary multi-interruption chains).
// @route   POST /api/matches/:id/apply-interruption
// @access  Private (match owner only)
exports.applyInterruption = async (req, res) => {
  try {
    const { revisedOvers } = req.body;

    if (!revisedOvers || revisedOvers <= 0) {
      return res.status(400).json({ success: false, message: 'revisedOvers must be a positive number' });
    }

    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }
    if (!(await canManageMatch(match, req.user.id))) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this match' });
    }
    if (match.innings.length < 2 || !match.innings[0] || match.innings[0].runs === undefined) {
      return res.status(400).json({ success: false, message: 'First innings must exist before applying an interruption to the chase' });
    }

    const chase = match.innings[1];
    const oversBowled = chase.overs || 0;
    const wicketsLost = chase.wickets || 0;

    if (revisedOvers <= oversBowled) {
      return res.status(400).json({ success: false, message: `Revised overs (${revisedOvers}) must be greater than overs already bowled (${oversBowled})` });
    }

    const oversRemainingAfterReduction = revisedOvers - oversBowled;
    const resourcePercentRemaining = resourcePercent(oversRemainingAfterReduction, wicketsLost, match.totalOvers);
    const { parScore, target } = revisedTarget(match.innings[0].runs, 100, resourcePercentRemaining);

    match.interruption = {
      revisedOvers,
      oversBowledAtInterruption: oversBowled,
      wicketsLostAtInterruption: wicketsLost,
      resourcePercentRemaining: Math.round(resourcePercentRemaining * 100) / 100,
      parScore,
      target,
      appliedAt: new Date()
    };
    await match.save();

    req.io.emit('match-interruption', { matchId: match._id, interruption: match.interruption });

    res.status(200).json({ success: true, match, interruption: match.interruption });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get match scorecard with AI insights
// @route   GET /api/matches/:id/scorecard
// @access  Public
exports.getScorecard = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate('team1')
      .populate('team2')
      .populate(MAN_OF_THE_MATCH_POPULATE);

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    const scorecard = {
      matchTitle: match.title,
      matchType: match.matchType,
      status: match.status,
      venue: match.venue,
      scheduledDate: match.scheduledDate,
      team1: {
        name: match.team1.name,
        runs: match.innings[0]?.runs || 0,
        wickets: match.innings[0]?.wickets || 0,
        overs: match.innings[0]?.overs || 0
      },
      team2: {
        name: match.team2.name,
        runs: match.innings[1]?.runs || 0,
        wickets: match.innings[1]?.wickets || 0,
        overs: match.innings[1]?.overs || 0
      },
      result: match.result,
      manOfTheMatch: match.manOfTheMatch
    };

    // Get AI insights for current match state
    const inningsIdx = currentInningsIndex(match);
    const aiInsights = await AIService.getTacticalAdvice({
      oversRemaining: 20 - (match.innings[inningsIdx]?.overs || 0),
      wicketsDown: match.innings[inningsIdx]?.wickets || 0,
      currentRunRate: match.innings[inningsIdx]?.runs / (match.innings[inningsIdx]?.overs || 1) || 0,
      targetScore: match.innings[0]?.runs || 150,
      oppositionStrength: 7,
      pitchType: 1
    });

    res.status(200).json({
      success: true,
      scorecard,
      aiInsights: aiInsights.success ? aiInsights : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get Manhattan/Worm chart data (runs per over + cumulative total per over) for both innings
// @route   GET /api/matches/:id/charts
// @access  Public
exports.getMatchCharts = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate('team1')
      .populate('team2');

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    const teamsByInningsIndex = [match.team1, match.team2];
    const innings = getMatchCharts(match).map((entry, index) => ({
      ...entry,
      team: teamsByInningsIndex[index]
    }));

    res.status(200).json({
      success: true,
      innings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get the deliveries with the biggest win-probability swings in the chase (WPA-style
//          "key moments"), auto-highlighting a completed or in-progress run chase.
// @route   GET /api/matches/:id/key-moments
// @access  Public
exports.getKeyMomentsForMatch = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    const result = await getKeyMoments(match);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Post-match performance report for a single player in a single match:
//          this match's batting/bowling figures, a comparison against career
//          averages, a recent-form trend across the last 5 matches, any new
//          personal bests / achievement badges this match satisfies, and - the
//          differentiated part - whether each dismissal this match came from a
//          zone the hierarchical matchup-shrinkage engine (getMatchupPlan) had
//          already flagged as high-risk for this batter against that bowler.
//          Computed fully on demand, nothing pre-computed/stored - matches every
//          other analytics endpoint in this codebase.
// @route   GET /api/matches/:matchId/performance-report/:playerId
// @access  Public
exports.getPlayerPerformanceReport = async (req, res) => {
  try {
    const { matchId, playerId } = req.params;
    const report = await getMatchPerformanceReport(matchId, playerId);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Match or player not found' });
    }

    res.status(200).json({ success: true, ...report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get AI tactical insights for a match
// @route   GET /api/matches/:id/ai-insights
// @access  Public
exports.getAIInsights = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    // Determine which innings is currently active
    const innings = match.innings[currentInningsIndex(match)];

    const aiInsights = await AIService.getTacticalAdvice({
      oversRemaining: 20 - (innings?.overs || 0),
      wicketsDown: innings?.wickets || 0,
      currentRunRate: innings?.runs / (innings?.overs || 1) || 0,
      targetScore: match.innings[0]?.runs || 150,
      oppositionStrength: 7,
      pitchType: 1
    });

    if (!aiInsights.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get AI insights'
      });
    }

    res.status(200).json({
      success: true,
      aiInsights
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete match
// @route   DELETE /api/matches/:id
// @access  Private
exports.deleteMatch = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    if (match.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this match'
      });
    }

    await Match.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Match deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Appoint an umpire for a match - grants them the same scoring/status-management
//          rights as the match creator (see canManageMatch above), without giving them the
//          ability to appoint further umpires or delete the match.
// @route   POST /api/matches/:id/umpires
// @access  Private (match creator only)
exports.addUmpire = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Please provide a userId' });
    }

    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }
    if (match.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the match creator can appoint umpires' });
    }
    if (match.createdBy.toString() === userId) {
      return res.status(400).json({ success: false, message: 'The match creator already has full scoring access' });
    }
    if ((match.umpires || []).some((u) => u.toString() === userId)) {
      return res.status(400).json({ success: false, message: 'This person is already an umpire for this match' });
    }

    match.umpires.push(userId);
    await match.save();
    await match.populate({ path: 'umpires', select: 'name' });

    res.status(200).json({ success: true, umpires: match.umpires });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Remove an umpire from a match
// @route   DELETE /api/matches/:id/umpires/:userId
// @access  Private (match creator only)
exports.removeUmpire = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }
    if (match.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the match creator can remove umpires' });
    }

    match.umpires = (match.umpires || []).filter((u) => u.toString() !== req.params.userId);
    await match.save();
    await match.populate({ path: 'umpires', select: 'name' });

    res.status(200).json({ success: true, umpires: match.umpires });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

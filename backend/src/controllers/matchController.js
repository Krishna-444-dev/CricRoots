const Match = require('../models/Match');
const Team = require('../models/Team');
const Tournament = require('../models/Tournament');
const AIService = require('../utils/aiService');
const { getMatchCharts } = require('../services/matchCharts');
const { computeMatchMVP } = require('../services/mvpCalculator');
const { generateCommentary } = require('../services/commentaryGenerator');
const { getKeyMoments } = require('../services/keyMoments');
const { settlePredictions } = require('../services/predictionSettler');

// Populate helper for manOfTheMatch: the field only stores a Player ref, but
// display needs the player's user's name - mirrors the nested Player->User
// populate pattern used for tournament awards in tournamentController.js.
const MAN_OF_THE_MATCH_POPULATE = { path: 'manOfTheMatch', populate: { path: 'user', select: 'name' } };

// @desc    Create a new match
// @route   POST /api/matches
// @access  Private
exports.createMatch = async (req, res) => {
  try {
    const { title, team1Id, team2Id, matchType, venue, scheduledDate, pitchType, tournamentId } = req.body;

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

    const match = await Match.create({
      title,
      team1: team1Id,
      team2: team2Id,
      matchType: matchType || 'T20',
      venue,
      pitchType: pitchType || 'unknown',
      scheduledDate,
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
      .populate('createdBy');

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

    if (match.createdBy.toString() !== req.user.id) {
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

    if (match.createdBy.toString() !== req.user.id) {
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
    const currentInningsIndex = match.status === 'Live' ? 1 : 0;
    const aiInsights = await AIService.getTacticalAdvice({
      oversRemaining: 20 - (match.innings[currentInningsIndex]?.overs || 0),
      wicketsDown: match.innings[currentInningsIndex]?.wickets || 0,
      currentRunRate: match.innings[currentInningsIndex]?.runs / (match.innings[currentInningsIndex]?.overs || 1) || 0,
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
    const currentInningsIndex = match.status === 'Live' ? 1 : 0;
    const innings = match.innings[currentInningsIndex];

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

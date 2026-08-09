const Match = require('../models/Match');
const Team = require('../models/Team');
const AIService = require('../utils/aiService');

// @desc    Create a new match
// @route   POST /api/matches
// @access  Private
exports.createMatch = async (req, res) => {
  try {
    const { title, team1Id, team2Id, matchType, venue, scheduledDate } = req.body;

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

    const match = await Match.create({
      title,
      team1: team1Id,
      team2: team2Id,
      matchType: matchType || 'T20',
      venue,
      scheduledDate,
      createdBy: req.user.id,
      innings: [
        { team: team1Id, runs: 0, wickets: 0, overs: 0, balls: [] },
        { team: team2Id, runs: 0, wickets: 0, overs: 0, balls: [] }
      ]
    });

    await match.populate('team1');
    await match.populate('team2');
    await match.populate('createdBy');

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
      .populate('manOfTheMatch')
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
      .populate('manOfTheMatch')
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

    match = await match.save();
    await match.populate('team1');
    await match.populate('team2');
    await match.populate('manOfTheMatch');

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

// @desc    Record a ball in match with AI insights
// @route   POST /api/matches/:id/record-ball
// @access  Private
exports.recordBall = async (req, res) => {
  try {
    const { inningsIndex, ballNumber, batsmanId, bowlerId, runs, isWicket, wicketType } = req.body;

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
      wicketType: wicketType || null
    };

    match.innings[inningsIndex].balls.push(ball);
    match.innings[inningsIndex].runs += runs || 0;
    if (isWicket) {
      match.innings[inningsIndex].wickets += 1;
    }

    // Calculate overs (6 balls = 1 over)
    const totalBalls = match.innings[inningsIndex].balls.length;
    match.innings[inningsIndex].overs = Math.floor(totalBalls / 6) + (totalBalls % 6) / 10;

    match = await match.save();
    await match.populate('team1');
    await match.populate('team2');

    // Get AI insights for the current situation
    const aiInsights = await AIService.getTacticalAdvice({
      oversRemaining: 20 - (match.innings[inningsIndex].overs || 0),
      wicketsDown: match.innings[inningsIndex].wickets,
      currentRunRate: match.innings[inningsIndex].runs / (match.innings[inningsIndex].overs || 1),
      targetScore: match.innings[0]?.runs || 150,
      oppositionStrength: 7,
      pitchType: 1
    });

    res.status(200).json({
      success: true,
      message: 'Ball recorded successfully',
      match,
      aiInsights: aiInsights.success ? aiInsights : null
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
      .populate('manOfTheMatch');

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

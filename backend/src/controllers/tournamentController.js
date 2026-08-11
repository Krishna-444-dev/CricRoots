const Tournament = require('../models/Tournament');
const Team = require('../models/Team');
const Match = require('../models/Match');

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
      .populate('awards.manOfTheTournament');

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

    const { name, description, status, prizePool, rules } = req.body;

    if (name) tournament.name = name;
    if (description) tournament.description = description;
    if (status) tournament.status = status;
    if (prizePool) tournament.prizePool = prizePool;
    if (rules) tournament.rules = rules;

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

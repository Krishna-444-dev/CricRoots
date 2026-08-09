const Player = require('../models/Player');
const User = require('../models/User');

// @desc    Register a player
// @route   POST /api/players/register
// @access  Private
exports.registerPlayer = async (req, res) => {
  try {
    const { specialization, battingStyle, bowlingStyle } = req.body;

    // Validate input
    if (!specialization || !battingStyle) {
      return res.status(400).json({
        success: false,
        message: 'Please provide specialization and batting style'
      });
    }

    // Check if player already exists for this user
    let player = await Player.findOne({ user: req.user.id });
    if (player) {
      return res.status(400).json({
        success: false,
        message: 'Player profile already exists for this user'
      });
    }

    // Create player
    player = await Player.create({
      user: req.user.id,
      specialization,
      battingStyle,
      bowlingStyle: bowlingStyle || 'None'
    });

    // Populate user information
    await player.populate('user');

    res.status(201).json({
      success: true,
      player
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get player profile
// @route   GET /api/players/:id
// @access  Public
exports.getPlayer = async (req, res) => {
  try {
    const player = await Player.findById(req.params.id)
      .populate('user')
      .populate('teams');

    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found'
      });
    }

    res.status(200).json({
      success: true,
      player
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all players
// @route   GET /api/players
// @access  Public
exports.getAllPlayers = async (req, res) => {
  try {
    const players = await Player.find()
      .populate('user')
      .populate('teams');

    res.status(200).json({
      success: true,
      count: players.length,
      players
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update player profile
// @route   PUT /api/players/:id
// @access  Private
exports.updatePlayer = async (req, res) => {
  try {
    let player = await Player.findById(req.params.id);

    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found'
      });
    }

    // Check if user owns this player profile
    if (player.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this player profile'
      });
    }

    // Update fields
    const { specialization, battingStyle, bowlingStyle } = req.body;
    if (specialization) player.specialization = specialization;
    if (battingStyle) player.battingStyle = battingStyle;
    if (bowlingStyle) player.bowlingStyle = bowlingStyle;

    player = await player.save();

    res.status(200).json({
      success: true,
      player
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get current user's player profile
// @route   GET /api/players/me/profile
// @access  Private
exports.getMyProfile = async (req, res) => {
  try {
    const player = await Player.findOne({ user: req.user.id })
      .populate('user')
      .populate('teams');

    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player profile not found'
      });
    }

    res.status(200).json({
      success: true,
      player
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

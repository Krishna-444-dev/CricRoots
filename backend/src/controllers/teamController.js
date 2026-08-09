const Team = require('../models/Team');
const Player = require('../models/Player');

// @desc    Create a new team
// @route   POST /api/teams
// @access  Private
exports.createTeam = async (req, res) => {
  try {
    const { name, description, city } = req.body;

    // Validate input
    if (!name || !city) {
      return res.status(400).json({
        success: false,
        message: 'Please provide team name and city'
      });
    }

    // Get player profile for captain
    const playerProfile = await Player.findOne({ user: req.user.id });
    if (!playerProfile) {
      return res.status(400).json({
        success: false,
        message: 'Please complete your player profile first'
      });
    }

    // Create team
    const team = await Team.create({
      name,
      captain: playerProfile._id,
      description,
      city,
      players: [playerProfile._id]
    });

    // Populate captain information
    await team.populate('captain');
    await team.populate('players');

    res.status(201).json({
      success: true,
      team
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all teams
// @route   GET /api/teams
// @access  Public
exports.getAllTeams = async (req, res) => {
  try {
    const teams = await Team.find()
      .populate('captain')
      .populate('players');

    res.status(200).json({
      success: true,
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

// @desc    Get team by ID
// @route   GET /api/teams/:id
// @access  Public
exports.getTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('captain')
      .populate('players');

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    res.status(200).json({
      success: true,
      team
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update team
// @route   PUT /api/teams/:id
// @access  Private
exports.updateTeam = async (req, res) => {
  try {
    let team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user is team captain
    const playerProfile = await Player.findOne({ user: req.user.id });
    if (!playerProfile || team.captain.toString() !== playerProfile._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this team'
      });
    }

    // Update fields
    const { name, description, city } = req.body;
    if (name) team.name = name;
    if (description) team.description = description;
    if (city) team.city = city;

    team = await team.save();
    await team.populate('captain');
    await team.populate('players');

    res.status(200).json({
      success: true,
      team
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Add player to team
// @route   POST /api/teams/:id/add-player
// @access  Private
exports.addPlayerToTeam = async (req, res) => {
  try {
    const { playerId } = req.body;

    if (!playerId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide player ID'
      });
    }

    let team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user is team captain
    const playerProfile = await Player.findOne({ user: req.user.id });
    if (!playerProfile || team.captain.toString() !== playerProfile._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to add players to this team'
      });
    }

    // Check if player exists
    const player = await Player.findById(playerId);
    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found'
      });
    }

    // Check if player already in team
    if (team.players.includes(playerId)) {
      return res.status(400).json({
        success: false,
        message: 'Player already in team'
      });
    }

    // Add player to team
    team.players.push(playerId);
    team = await team.save();

    // Add team to player's teams
    player.teams.push(team._id);
    await player.save();

    await team.populate('captain');
    await team.populate('players');

    res.status(200).json({
      success: true,
      message: 'Player added to team',
      team
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Remove player from team
// @route   DELETE /api/teams/:id/remove-player/:playerId
// @access  Private
exports.removePlayerFromTeam = async (req, res) => {
  try {
    const { id, playerId } = req.params;

    let team = await Team.findById(id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user is team captain
    const playerProfile = await Player.findOne({ user: req.user.id });
    if (!playerProfile || team.captain.toString() !== playerProfile._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to remove players from this team'
      });
    }

    // Remove player from team
    team.players = team.players.filter(p => p.toString() !== playerId);
    team = await team.save();

    // Remove team from player's teams
    const player = await Player.findById(playerId);
    if (player) {
      player.teams = player.teams.filter(t => t.toString() !== id);
      await player.save();
    }

    await team.populate('captain');
    await team.populate('players');

    res.status(200).json({
      success: true,
      message: 'Player removed from team',
      team
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete team
// @route   DELETE /api/teams/:id
// @access  Private
exports.deleteTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user is team captain
    const playerProfile = await Player.findOne({ user: req.user.id });
    if (!playerProfile || team.captain.toString() !== playerProfile._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this team'
      });
    }

    // Remove team from all players
    await Player.updateMany(
      { teams: req.params.id },
      { $pull: { teams: req.params.id } }
    );

    await Team.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Team deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

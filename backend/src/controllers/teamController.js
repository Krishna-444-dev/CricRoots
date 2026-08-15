const Team = require('../models/Team');
const Player = require('../models/Player');

// team.captain/viceCaptain/coaches are unpopulated ObjectIds at the point these checks run today
// (every check below starts from a bare Team.findById with no .populate() first), but this
// unwraps ._id defensively in case a populated subdocument ever reaches it - matching the
// isMember pattern in groupController.js. A populated Mongoose subdocument's .toString() does
// NOT return its _id's hex string, only a bare ObjectId's does.
function refMatches(ref, playerId) {
  if (!ref) return false;
  const id = ref._id ? ref._id : ref;
  return id.toString() === playerId;
}

// Structural team ownership - only the captain can delete the team or reassign admin roles.
function isTeamCaptain(team, playerId) {
  return refMatches(team.captain, playerId);
}

// Day-to-day team management - captain, vice-captain, or any coach.
function isTeamAdmin(team, playerId) {
  if (isTeamCaptain(team, playerId)) return true;
  if (refMatches(team.viceCaptain, playerId)) return true;
  return (team.coaches || []).some((c) => refMatches(c, playerId));
}

// Nested populate so each Player's own `user` ref resolves to a real name instead of
// staying an unpopulated ObjectId - a bare .populate('captain') only goes one level deep.
const PLAYER_POPULATE = { path: 'user', select: 'name' };
const TEAM_POPULATE_FIELDS = [
  { path: 'captain', populate: PLAYER_POPULATE },
  { path: 'viceCaptain', populate: PLAYER_POPULATE },
  { path: 'coaches', populate: PLAYER_POPULATE },
  { path: 'players', populate: PLAYER_POPULATE },
];

async function populateTeam(team) {
  for (const field of TEAM_POPULATE_FIELDS) {
    await team.populate(field);
  }
  return team;
}

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
    await populateTeam(team);

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
    const teams = await Team.find().populate(TEAM_POPULATE_FIELDS);

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
    const team = await Team.findById(req.params.id).populate(TEAM_POPULATE_FIELDS);

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

    // Admin-level action: captain, vice-captain, or any coach may update team details.
    const playerProfile = await Player.findOne({ user: req.user.id });
    if (!playerProfile || !isTeamAdmin(team, playerProfile._id.toString())) {
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
    await populateTeam(team);

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

    // Admin-level action: captain, vice-captain, or any coach may add players.
    const playerProfile = await Player.findOne({ user: req.user.id });
    if (!playerProfile || !isTeamAdmin(team, playerProfile._id.toString())) {
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

    await populateTeam(team);

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

    // Admin-level action: captain, vice-captain, or any coach may remove players.
    const playerProfile = await Player.findOne({ user: req.user.id });
    if (!playerProfile || !isTeamAdmin(team, playerProfile._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to remove players from this team'
      });
    }

    // Remove player from team
    team.players = team.players.filter(p => p.toString() !== playerId);
    // A player leaving the roster can't remain vice-captain/coach - those roles imply roster
    // membership, and leaving stale refs would let a departed player keep admin rights.
    if (refMatches(team.viceCaptain, playerId)) team.viceCaptain = null;
    team.coaches = (team.coaches || []).filter(c => !refMatches(c, playerId));
    team = await team.save();

    // Remove team from player's teams
    const player = await Player.findById(playerId);
    if (player) {
      player.teams = player.teams.filter(t => t.toString() !== id);
      await player.save();
    }

    await populateTeam(team);

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

    // Captain-only: structural team ownership, not delegable to vice-captain/coaches.
    const playerProfile = await Player.findOne({ user: req.user.id });
    if (!playerProfile || !isTeamCaptain(team, playerProfile._id.toString())) {
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

// @desc    Set (or clear) the team's vice-captain - captain only, role assignment isn't
//          delegable to the vice-captain/coaches themselves.
// @route   PUT /api/teams/:id/vice-captain
// @access  Private (captain only)
exports.setViceCaptain = async (req, res) => {
  try {
    const { playerId } = req.body;

    let team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    const playerProfile = await Player.findOne({ user: req.user.id });
    if (!playerProfile || !isTeamCaptain(team, playerProfile._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Only the team captain can assign a vice-captain'
      });
    }

    if (playerId) {
      if (!team.players.some(p => p.toString() === playerId)) {
        return res.status(400).json({
          success: false,
          message: 'Player must be on the team roster to be vice-captain'
        });
      }
      team.viceCaptain = playerId;
    } else {
      team.viceCaptain = null;
    }

    team = await team.save();
    await populateTeam(team);

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

// @desc    Add a coach to the team - captain only
// @route   POST /api/teams/:id/coaches
// @access  Private (captain only)
exports.addCoach = async (req, res) => {
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

    const playerProfile = await Player.findOne({ user: req.user.id });
    if (!playerProfile || !isTeamCaptain(team, playerProfile._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Only the team captain can add coaches'
      });
    }

    if (!team.players.some(p => p.toString() === playerId)) {
      return res.status(400).json({
        success: false,
        message: 'Player must be on the team roster to be a coach'
      });
    }

    if (!team.coaches.some(c => c.toString() === playerId)) {
      team.coaches.push(playerId);
      team = await team.save();
    }

    await populateTeam(team);

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

// @desc    Remove a coach from the team - captain only
// @route   DELETE /api/teams/:id/coaches/:playerId
// @access  Private (captain only)
exports.removeCoach = async (req, res) => {
  try {
    const { id, playerId } = req.params;

    let team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    const playerProfile = await Player.findOne({ user: req.user.id });
    if (!playerProfile || !isTeamCaptain(team, playerProfile._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Only the team captain can remove coaches'
      });
    }

    team.coaches = (team.coaches || []).filter(c => c.toString() !== playerId);
    team = await team.save();
    await populateTeam(team);

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

// @desc    Teams the current user is actually rostered on (captain/vice-captain/coach are
//          always also in `players`, by construction - see createTeam/addPlayerToTeam above -
//          so a single `players` membership check covers every role). Same Player -> Team join
//          leagueController.js's getMyLeagues established this session for "what is this user
//          actually part of" - built for the Community page to scope poll-creation entry
//          points to teams the viewer can actually manage/vote in, rather than every team in
//          the system.
// @route   GET /api/teams/mine
// @access  Private
exports.getMyTeams = async (req, res) => {
  try {
    const playerProfile = await Player.findOne({ user: req.user.id }).select('_id');
    if (!playerProfile) {
      return res.status(200).json({ success: true, count: 0, teams: [] });
    }

    const teams = await Team.find({ players: playerProfile._id })
      .populate(TEAM_POPULATE_FIELDS)
      .sort({ name: 1 });

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

const League = require('../models/League');
const Tournament = require('../models/Tournament');
const Team = require('../models/Team');
const Player = require('../models/Player');

// @desc    Create a new league
// @route   POST /api/leagues
// @access  Private
exports.createLeague = async (req, res) => {
  try {
    const { name, description, logo, isPublic } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a league name'
      });
    }

    const league = await League.create({
      name,
      description,
      organizer: req.user.id,
      logo,
      isPublic: isPublic !== undefined ? isPublic : true
    });

    await league.populate('organizer');

    res.status(201).json({
      success: true,
      league
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all leagues, optionally filtered by name - the frontend only calls this once the
//          viewer actually searches (see getMyLeagues below for the leagues shown by default),
//          so an absent `search` deliberately still returns everything rather than nothing, for
//          any other caller of this same public endpoint that expects the old full-list behavior.
// @route   GET /api/leagues?search=<term>
// @access  Public
exports.getAllLeagues = async (req, res) => {
  try {
    const { search } = req.query;
    const query = search ? { name: { $regex: String(search).trim(), $options: 'i' } } : {};
    const leagues = await League.find(query).populate('organizer').sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: leagues.length,
      leagues
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Leagues the current user is actually involved in - organizing, or playing (rostered
//          on a team registered in one of that league's tournaments). This is what the leagues
//          page shows by default; every other league is only reachable via search (getAllLeagues
//          above), not shown eagerly.
// @route   GET /api/leagues/mine
// @access  Private
exports.getMyLeagues = async (req, res) => {
  try {
    const userId = req.user.id;

    const organizedLeagueIds = (await League.find({ organizer: userId }).select('_id')).map((l) => l._id.toString());

    let playedLeagueIds = [];
    const myPlayer = await Player.findOne({ user: userId }).select('_id');
    if (myPlayer) {
      const myTeamIds = (await Team.find({ players: myPlayer._id }).select('_id')).map((t) => t._id);
      if (myTeamIds.length > 0) {
        const tournaments = await Tournament.find({ teams: { $in: myTeamIds }, league: { $ne: null } }).select('league');
        playedLeagueIds = tournaments.map((t) => t.league.toString());
      }
    }

    const allIds = [...new Set([...organizedLeagueIds, ...playedLeagueIds])];
    const leagues = await League.find({ _id: { $in: allIds } }).populate('organizer').sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: leagues.length,
      leagues
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get league by ID, including its tournaments (avoids a second round trip)
// @route   GET /api/leagues/:id
// @access  Public
exports.getLeague = async (req, res) => {
  try {
    const league = await League.findById(req.params.id).populate('organizer');

    if (!league) {
      return res.status(404).json({
        success: false,
        message: 'League not found'
      });
    }

    const tournaments = await Tournament.find({ league: league._id })
      .populate('organizer')
      .sort({ startDate: -1 });

    res.status(200).json({
      success: true,
      league,
      tournaments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update league
// @route   PUT /api/leagues/:id
// @access  Private (organizer only)
exports.updateLeague = async (req, res) => {
  try {
    let league = await League.findById(req.params.id);

    if (!league) {
      return res.status(404).json({
        success: false,
        message: 'League not found'
      });
    }

    if (league.organizer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this league'
      });
    }

    const { name, description, logo, isPublic } = req.body;

    if (name) league.name = name;
    if (description !== undefined) league.description = description;
    if (logo !== undefined) league.logo = logo;
    if (isPublic !== undefined) league.isPublic = isPublic;

    league = await league.save();
    await league.populate('organizer');

    res.status(200).json({
      success: true,
      league
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete league
// @route   DELETE /api/leagues/:id
// @access  Private (organizer only)
exports.deleteLeague = async (req, res) => {
  try {
    const league = await League.findById(req.params.id);

    if (!league) {
      return res.status(404).json({
        success: false,
        message: 'League not found'
      });
    }

    if (league.organizer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this league'
      });
    }

    // Deleting a league must not delete or orphan its tournaments - each tournament stands on
    // its own (venue/dates/teams/matches all live on it directly), so it just loses its parent
    // pointer and reverts to being a standalone tournament rather than being destroyed.
    await Tournament.updateMany({ league: league._id }, { league: null });

    await League.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'League deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const League = require('../models/League');
const Tournament = require('../models/Tournament');

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

// @desc    Get all leagues
// @route   GET /api/leagues
// @access  Public
exports.getAllLeagues = async (req, res) => {
  try {
    const leagues = await League.find().populate('organizer').sort({ createdAt: -1 });

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

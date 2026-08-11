const NewsPost = require('../models/NewsPost');
const Player = require('../models/Player');
const Team = require('../models/Team');
const Tournament = require('../models/Tournament');

const ALLOWED_ROLES = ['organizer', 'admin'];

// @desc    Get all news posts - the public, browsable feed (everyone sees everything,
//          including tournament match reports - like a normal news site)
// @route   GET /api/news
// @access  Public
exports.getAllNews = async (req, res) => {
  try {
    const { category, tournament } = req.query;
    const query = {};
    if (category) query.category = category;
    if (tournament) query.tournament = tournament;

    const posts = await NewsPost.find(query)
      .populate('author', 'name')
      .populate('tournament', 'name')
      .populate({ path: 'heroPlayer', populate: { path: 'user', select: 'name' } })
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({ success: true, count: posts.length, posts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Personalized "for you" feed - general/global news plus match-report articles for
//          every tournament the requesting player is registered in (via team membership). This
//          is what makes "if a player is registered in a tournament, they should see news about
//          it" a real, dedicated experience rather than just something buried in the public feed.
// @route   GET /api/news/feed
// @access  Private
exports.getMyFeed = async (req, res) => {
  try {
    const player = await Player.findOne({ user: req.user.id });

    let tournamentIds = [];
    if (player) {
      const teams = await Team.find({ players: player._id }).select('_id');
      const teamIds = teams.map((t) => t._id);
      if (teamIds.length > 0) {
        const tournaments = await Tournament.find({ teams: { $in: teamIds } }).select('_id');
        tournamentIds = tournaments.map((t) => t._id);
      }
    }

    // General news (tournament: null) is part of everyone's feed regardless of registration;
    // tournament-specific articles only show up here for tournaments the player is actually in.
    const posts = await NewsPost.find({
      $or: [{ tournament: null }, { tournament: { $in: tournamentIds } }]
    })
      .populate('author', 'name')
      .populate('tournament', 'name')
      .populate({ path: 'heroPlayer', populate: { path: 'user', select: 'name' } })
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({ success: true, count: posts.length, posts, myTournaments: tournamentIds });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get a single news post
// @route   GET /api/news/:id
// @access  Public
exports.getNewsPost = async (req, res) => {
  try {
    const post = await NewsPost.findById(req.params.id)
      .populate('author', 'name')
      .populate('tournament', 'name')
      .populate({ path: 'heroPlayer', populate: { path: 'user', select: 'name' } });
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    res.status(200).json({ success: true, post });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a news post
// @route   POST /api/news
// @access  Private (organizer/admin only)
exports.createNewsPost = async (req, res) => {
  try {
    if (!ALLOWED_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only organizers and admins can publish news' });
    }

    const { title, category, body } = req.body;
    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'Please provide title and body' });
    }

    let post = await NewsPost.create({ title, category, body, author: req.user.id });
    await post.populate('author', 'name');

    res.status(201).json({ success: true, post });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a news post (author only)
// @route   DELETE /api/news/:id
// @access  Private
exports.deleteNewsPost = async (req, res) => {
  try {
    const post = await NewsPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    if (post.author.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this post' });
    }
    await NewsPost.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Post deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

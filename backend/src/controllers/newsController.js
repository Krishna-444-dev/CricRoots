const NewsPost = require('../models/NewsPost');

const ALLOWED_ROLES = ['organizer', 'admin'];

// @desc    Get all news posts
// @route   GET /api/news
// @access  Public
exports.getAllNews = async (req, res) => {
  try {
    const { category } = req.query;
    const query = category ? { category } : {};

    const posts = await NewsPost.find(query)
      .populate('author', 'name')
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({ success: true, count: posts.length, posts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get a single news post
// @route   GET /api/news/:id
// @access  Public
exports.getNewsPost = async (req, res) => {
  try {
    const post = await NewsPost.findById(req.params.id).populate('author', 'name');
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

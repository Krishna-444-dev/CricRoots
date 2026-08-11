const Lesson = require('../models/Lesson');

// @desc    Get all lessons, optionally filtered by category/difficulty
// @route   GET /api/lessons
// @access  Public
exports.getAllLessons = async (req, res) => {
  try {
    const { category, difficulty } = req.query;
    const query = {};
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;

    const lessons = await Lesson.find(query)
      .populate('author', 'name')
      .select('-content')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: lessons.length, lessons });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get a single lesson with full content
// @route   GET /api/lessons/:id
// @access  Public
exports.getLesson = async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id).populate('author', 'name');
    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lesson not found' });
    }
    res.status(200).json({ success: true, lesson });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a lesson
// @route   POST /api/lessons
// @access  Private
exports.createLesson = async (req, res) => {
  try {
    const { title, category, difficulty, content } = req.body;
    if (!title || !category || !content) {
      return res.status(400).json({ success: false, message: 'Please provide title, category, and content' });
    }

    let lesson = await Lesson.create({ title, category, difficulty, content, author: req.user.id });
    await lesson.populate('author', 'name');

    res.status(201).json({ success: true, lesson });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a lesson (author only)
// @route   DELETE /api/lessons/:id
// @access  Private
exports.deleteLesson = async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lesson not found' });
    }
    if (lesson.author.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this lesson' });
    }
    await Lesson.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Lesson deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const Lesson = require('../models/Lesson');
const Player = require('../models/Player');
const tendencyAnalytics = require('../services/tendencyAnalytics');

// Same threshold insightsController uses before trusting a player's own tagged-ball data over
// generic advice - keeps the two personalization features (bowling plans, this) consistent.
const MIN_BALLS_FOR_WEAKNESS = 6;
// Ignore a line/length bucket with too few balls in it - one unlucky dismissal off 2 balls
// shouldn't drive a whole lesson recommendation.
const MIN_BUCKET_BALLS = 2;

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
    const { title, category, difficulty, content, tags } = req.body;
    if (!title || !category || !content) {
      return res.status(400).json({ success: false, message: 'Please provide title, category, and content' });
    }

    let lesson = await Lesson.create({
      title,
      category,
      difficulty,
      content,
      tags: Array.isArray(tags) ? tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean) : [],
      author: req.user.id
    });
    await lesson.populate('author', 'name');

    res.status(201).json({ success: true, lesson });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Personalized lesson recommendations, based on the requesting player's own weak
//          line/length buckets (same shrinkage-style own-data-vs-pool-data-vs-generic pattern
//          insightsController uses for shot advice/bowling plans - see resolveSource there).
//          Batsmen/all-rounders/wicketkeepers get recommendations from their own dismissal
//          buckets (getBatsmanLineLengthBreakdown); bowlers/all-rounders from their own most
//          expensive buckets (getBowlerLineLengthEffectiveness). Always returns *something* -
//          a generic beginner-friendly set when there's no player profile or no tagged-ball data
//          yet, never an empty screen.
// @route   GET /api/lessons/for-me
// @access  Private
exports.getPersonalizedLessons = async (req, res) => {
  try {
    const player = await Player.findOne({ user: req.user.id });

    const weaknessTags = [];
    const reasons = [];
    let source = 'generic';

    if (player) {
      const wantsBatting = ['Batsman', 'All-rounder', 'Wicket-keeper'].includes(player.specialization);
      const wantsBowling = ['Bowler', 'All-rounder'].includes(player.specialization);

      if (wantsBatting) {
        const breakdown = await tendencyAnalytics.getBatsmanLineLengthBreakdown(player._id);
        if (breakdown.totalBalls >= MIN_BALLS_FOR_WEAKNESS) {
          const weakest = breakdown.buckets
            .filter((b) => b.balls >= MIN_BUCKET_BALLS)
            .sort((a, b) => b.dismissalRate - a.dismissalRate)[0];
          if (weakest && weakest.dismissalRate > 0) {
            weaknessTags.push(weakest.line, weakest.length);
            reasons.push(`you're dismissed ${weakest.dismissalRate}% of the time against ${weakest.length.replace(/-/g, ' ')} bowling on ${weakest.line.replace(/-/g, ' ')}`);
            source = 'own-data';
          }
        }
      }

      if (wantsBowling) {
        const effectiveness = await tendencyAnalytics.getBowlerLineLengthEffectiveness(player._id);
        if (effectiveness.totalBalls >= MIN_BALLS_FOR_WEAKNESS) {
          const weakest = effectiveness.buckets
            .filter((b) => b.balls >= MIN_BUCKET_BALLS)
            .sort((a, b) => b.economy - a.economy)[0];
          if (weakest && weakest.economy > 0) {
            weaknessTags.push(weakest.line, weakest.length);
            reasons.push(`your economy is ${weakest.economy} when you bowl ${weakest.length.replace(/-/g, ' ')} on ${weakest.line.replace(/-/g, ' ')}`);
            source = 'own-data';
          }
        }
      }
    }

    let lessons = [];
    if (weaknessTags.length > 0) {
      lessons = await Lesson.find({ tags: { $in: weaknessTags } })
        .populate('author', 'name')
        .select('-content')
        .sort({ createdAt: -1 })
        .limit(10);
    }

    // Pad with generic recent lessons if the tag match came up short (or there was nothing to
    // match against) - a personalized feed with 1 result and an otherwise-empty screen is worse
    // than a personalized top pick plus a sensible general list underneath it.
    if (lessons.length < 5) {
      const excludeIds = lessons.map((l) => l._id);
      const fallbackCategory = player?.specialization === 'Bowler' ? 'bowling' : player?.specialization === 'Wicket-keeper' ? 'fielding' : 'batting';
      const padding = await Lesson.find({ _id: { $nin: excludeIds }, category: fallbackCategory })
        .populate('author', 'name')
        .select('-content')
        .sort({ createdAt: -1 })
        .limit(10 - lessons.length);
      lessons = [...lessons, ...padding];
    }

    res.status(200).json({
      success: true,
      source,
      reason: reasons.length > 0
        ? `Recommended because ${reasons.join(', and ')}.`
        : 'Not enough of your own tagged-ball data yet for personalized picks - here are some good lessons to start with.',
      lessons
    });
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

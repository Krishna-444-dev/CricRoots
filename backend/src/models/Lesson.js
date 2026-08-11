const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a title'],
      trim: true,
      maxlength: 150
    },
    category: {
      type: String,
      enum: ['batting', 'bowling', 'fielding', 'fitness', 'rules', 'strategy'],
      required: true
    },
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner'
    },
    content: {
      type: String,
      required: [true, 'Please add lesson content'],
      maxlength: 20000
    },
    // Free-text tags used to match lessons against a player's own weak line/length buckets for
    // personalized recommendations (see lessonController.getPersonalizedLessons). Not enum-
    // constrained - authors can tag with the same line/length vocabulary Match.js's ball schema
    // uses (e.g. 'short', 'bouncer', 'off-stump', 'yorker') for the best match quality, but
    // free-form tags like 'death-overs' or 'spin' are fine too and simply won't drive weakness
    // matching until that logic is extended to understand them.
    tags: {
      type: [String],
      default: []
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

lessonSchema.index({ category: 1, createdAt: -1 });

module.exports = mongoose.model('Lesson', lessonSchema);

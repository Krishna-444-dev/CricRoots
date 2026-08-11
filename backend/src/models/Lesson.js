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

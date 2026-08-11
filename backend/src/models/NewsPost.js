const mongoose = require('mongoose');

const newsPostSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a title'],
      trim: true,
      maxlength: 150
    },
    category: {
      type: String,
      enum: ['general', 'tournament-update', 'club-news', 'tips'],
      default: 'general'
    },
    body: {
      type: String,
      required: [true, 'Please add content'],
      maxlength: 10000
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

newsPostSchema.index({ createdAt: -1 });

module.exports = mongoose.model('NewsPost', newsPostSchema);

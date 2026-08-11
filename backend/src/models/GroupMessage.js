const mongoose = require('mongoose');

// One document per message in a group, discriminated by `type`. Kept as a single flexible
// schema rather than three separate models (text/poll/attachment) - a group's message feed needs
// to render all three interleaved in one chronological list, which is far simpler against one
// collection than merging three.
const pollOptionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 200 },
    votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  { _id: true }
);

const groupMessageSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: ['text', 'poll', 'image', 'video'],
      required: true
    },
    // type: 'text'
    text: {
      type: String,
      trim: true,
      maxlength: 2000
    },
    // type: 'poll'
    poll: {
      question: { type: String, trim: true, maxlength: 300 },
      allowMultiple: { type: Boolean, default: false },
      options: [pollOptionSchema]
    },
    // type: 'image' | 'video' - url is a relative path served by the backend's static uploads
    // route (see middleware/upload.js), kept relative rather than a full URL so switching to
    // cloud storage later only means changing how it's constructed at read time, not migrating
    // stored data.
    attachment: {
      url: String,
      mimeType: String,
      fileName: String,
      sizeBytes: Number
    }
  },
  {
    timestamps: true
  }
);

groupMessageSchema.index({ group: 1, createdAt: 1 });

module.exports = mongoose.model('GroupMessage', groupMessageSchema);

const mongoose = require('mongoose');

// Private 1:1 messages between two users - distinct from Message.js (team/tournament broadcast
// channels). Kept as a separate model rather than folding into Message: the query shape is
// fundamentally different (grouping by "the other participant" to build an inbox, vs a simple
// channel-id lookup) and DMs need a read/unread concept broadcast messages don't.
const directMessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      required: [true, 'Message text is required'],
      trim: true,
      maxlength: 2000
    },
    read: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Powers both directions of "thread with this specific user" lookups.
directMessageSchema.index({ sender: 1, recipient: 1, createdAt: 1 });
directMessageSchema.index({ recipient: 1, sender: 1, createdAt: 1 });
// Powers the unread-count badge.
directMessageSchema.index({ recipient: 1, read: 1 });

module.exports = mongoose.model('DirectMessage', directMessageSchema);

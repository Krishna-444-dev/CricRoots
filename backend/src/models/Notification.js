const mongoose = require('mongoose');

// In-app notification feed - fanned out to one document per recipient at creation time (see
// backend/src/services/notificationService.js), not computed on read. This app's data scale
// (hundreds of users, not millions) makes a per-recipient row the simplest correct approach;
// no push/email/SMS delivery exists yet, this is purely the bell-icon feed both frontends poll.
const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['match_live', 'match_completed', 'tournament_announcement'],
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    // Relative frontend path this notification should navigate to when clicked (e.g.
    // `/match/<id>` or `/tournaments?tournamentId=<id>`, matching each frontend's real routes -
    // not an absolute URL, since web and mobile resolve it against their own base/navigator).
    link: {
      type: String,
      default: ''
    },
    relatedMatch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
      default: null
    },
    relatedTournament: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      default: null
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

// Powers both "unread count for the bell badge" and "this user's notifications, newest first"
// without a collection scan, at this app's current scale - same reasoning as every other
// compound index in this codebase.
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);

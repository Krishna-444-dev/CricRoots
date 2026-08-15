const mongoose = require('mongoose');

// A single option on a poll - `votes` stores the voting users themselves (not just a count),
// which is enough at this app's data scale (small club/tournament rosters, not millions of
// votes) to both tally results AND answer "has this user already voted" without a second
// collection.
const pollOptionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true
    },
    votes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ]
  },
  { _id: true }
);

// Community-feed polls (CricHeroes-style) - scoped to exactly one of `team` or `tournament`,
// never both and never neither. Mirrors the shape of Notification.relatedMatch/
// relatedTournament (two optional, mutually-relevant refs), but enforced strictly here via the
// pre-validate hook below since a poll with no scope at all would have nowhere to be
// discovered from (no global poll feed exists, by design - see pollController.js).
const pollSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300
    },
    options: {
      type: [pollOptionSchema],
      validate: {
        validator: (opts) => Array.isArray(opts) && opts.length >= 2 && opts.length <= 6,
        message: 'A poll needs between 2 and 6 options'
      }
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null
    },
    tournament: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      default: null
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    isOpen: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

pollSchema.pre('validate', function pollExclusiveScope(next) {
  const hasTeam = Boolean(this.team);
  const hasTournament = Boolean(this.tournament);
  if (hasTeam === hasTournament) {
    return next(new Error('A poll must belong to exactly one of team or tournament'));
  }
  next();
});

// Powers "list polls for this team/tournament, newest first" without a collection scan, same
// reasoning as every other compound index in this codebase (see Notification.js).
pollSchema.index({ team: 1, createdAt: -1 });
pollSchema.index({ tournament: 1, createdAt: -1 });

module.exports = mongoose.model('Poll', pollSchema);

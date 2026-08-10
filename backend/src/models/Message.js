const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
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
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      required: [true, 'Message text is required'],
      trim: true,
      maxlength: 2000
    }
  },
  {
    timestamps: true
  }
);

// Exactly one of team/tournament must be set - a message belongs to one channel.
messageSchema.pre('validate', function (next) {
  const hasTeam = Boolean(this.team);
  const hasTournament = Boolean(this.tournament);
  if (hasTeam === hasTournament) {
    return next(new Error('Message must belong to exactly one of team or tournament'));
  }
  next();
});

messageSchema.index({ team: 1, createdAt: 1 });
messageSchema.index({ tournament: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);

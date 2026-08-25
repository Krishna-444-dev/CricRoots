const mongoose = require('mongoose');

// Points-based match prediction game - explicitly not real-money betting/wagering. Users guess
// the winning team (plus an optional Man-of-the-Match bonus guess) before a match starts, earn
// points when the match completes, and climb a leaderboard. No stake, no payout, no losses below
// zero - the closest legal equivalent of the "fantasy/prediction" engagement hook without the
// jurisdiction-by-jurisdiction gambling-licensing exposure real-money wagering would create.
const predictionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  match: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    required: true
  },
  predictedWinner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  predictedMotm: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'settled'],
    default: 'pending'
  },
  points: {
    type: Number,
    default: 0
  },
  wonOnWinner: {
    type: Boolean,
    default: false
  },
  wonOnMotm: {
    type: Boolean,
    default: false
  },
  // FORECAST HISTORY - unbackfillable.
  //
  // The unique (user, match) index below means re-predicting before lock UPDATES this document.
  // That is the right storage shape for the game, but it destroys the fact that the user changed
  // their mind, which is the interesting part: whether someone revises, in which direction, and how
  // close to lock is a signal about human confidence that no model has access to.
  //
  // Per D20, keep the observations. The current values stay in the top-level fields so nothing that
  // reads a Prediction has to change; each superseded forecast is appended here before being
  // overwritten. `revision` is the 1-based index of the forecast being superseded, so the live
  // top-level values are revision `revisions.length + 1`.
  revisions: [{
    predictedWinner: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    predictedMotm: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
    revision: Number,
    supersededAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// One prediction per user per match - re-predicting before lock updates the existing doc
// (see predictionController.submitPrediction) rather than creating duplicates.
predictionSchema.index({ user: 1, match: 1 }, { unique: true });

module.exports = mongoose.model('Prediction', predictionSchema);

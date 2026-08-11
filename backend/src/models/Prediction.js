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
  }
}, { timestamps: true });

// One prediction per user per match - re-predicting before lock updates the existing doc
// (see predictionController.submitPrediction) rather than creating duplicates.
predictionSchema.index({ user: 1, match: 1 }, { unique: true });

module.exports = mongoose.model('Prediction', predictionSchema);

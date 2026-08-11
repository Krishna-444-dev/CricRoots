const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a match title']
  },
  team1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  team2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  matchType: {
    type: String,
    enum: ['T20', 'ODI', 'Test', 'Friendly'],
    default: 'T20'
  },
  status: {
    type: String,
    enum: ['Scheduled', 'Live', 'Completed', 'Cancelled'],
    default: 'Scheduled'
  },
  venue: {
    type: String,
    required: true
  },
  pitchType: {
    type: String,
    enum: ['dry', 'green', 'flat', 'dusty', 'unknown'],
    default: 'unknown'
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  tournament: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    default: null
  },
  innings: [{
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    },
    runs: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    overs: { type: Number, default: 0 },
    balls: [{
      ballNumber: Number,
      batsmanId: mongoose.Schema.Types.ObjectId,
      bowlerId: mongoose.Schema.Types.ObjectId,
      runs: Number,
      isWicket: Boolean,
      wicketType: String, // bowled, caught, lbw, run out, etc.

      isExtra: { type: Boolean, default: false },
      extraType: {
        type: String,
        enum: ['none', 'wide', 'no-ball', 'bye', 'leg-bye', 'penalty'],
        default: 'none'
      },

      // Delivery tagging - optional, powers per-player tendency analysis
      line: {
        type: String,
        enum: ['wide-outside-off', 'outside-off', 'off-stump', 'middle-stump', 'leg-stump', 'down-leg', 'unknown'],
        default: 'unknown'
      },
      length: {
        type: String,
        enum: ['full-toss', 'yorker', 'full', 'good-length', 'short-of-good-length', 'short', 'bouncer', 'unknown'],
        default: 'unknown'
      },

      // Shot tagging - optional, batsman-relative (mirrored in UI for left-handers)
      // null is listed explicitly in each enum: Mongoose's enum validator checks the
      // *defaulted* value, not just what the caller sent, so default:null alone isn't enough.
      shotType: {
        type: String,
        enum: ['defensive', 'drive', 'cut', 'pull-hook', 'sweep', 'flick-glance', 'loft', 'reverse-scoop', 'edge', 'other', null],
        default: null
      },
      shotZone: {
        type: String,
        enum: ['fine-leg', 'square-leg', 'mid-wicket', 'mid-on', 'mid-off', 'cover', 'point', 'third-man', null],
        default: null
      },

      // Fielding tagging - used for catches/run-outs/stumpings
      fielderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
        default: null
      },
      fielderPosition: {
        type: String,
        enum: ['fine-leg', 'square-leg', 'mid-wicket', 'mid-on', 'mid-off', 'cover', 'point', 'third-man',
               'wicket-keeper', 'bowler', 'not-applicable', null],
        default: null
      }
    }]
  }],
  toss: {
    winningTeam: mongoose.Schema.Types.ObjectId,
    decision: String // bat or bowl
  },
  result: {
    winningTeam: mongoose.Schema.Types.ObjectId,
    margin: String, // runs or wickets
    marginValue: Number
  },
  manOfTheMatch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Match', matchSchema);

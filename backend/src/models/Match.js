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
  scheduledDate: {
    type: Date,
    required: true
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
      wicketType: String // bowled, caught, lbw, run out, etc.
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

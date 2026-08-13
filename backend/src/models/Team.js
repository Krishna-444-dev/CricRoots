const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a team name']
  },
  captain: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  },
  viceCaptain: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    default: null
  },
  coaches: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player'
  }],
  players: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player'
  }],
  description: {
    type: String,
    maxlength: 500
  },
  city: {
    type: String,
    required: true
  },
  stats: {
    matchesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 }
  },
  logo: {
    type: String,
    default: 'no-photo.jpg'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Team', teamSchema);

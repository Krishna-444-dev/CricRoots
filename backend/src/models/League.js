const mongoose = require('mongoose');

// Organizing body that runs multiple Tournaments (seasons/editions) over time - deliberately
// minimal (no venue/dates/teams of its own) since those already live on each Tournament; a
// League is just the umbrella a Tournament can optionally point back to (see Tournament.league).
const leagueSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    logo: String,
    isPublic: { type: Boolean, default: true }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('League', leagueSchema);

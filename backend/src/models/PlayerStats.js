const mongoose = require('mongoose');

const playerStatsSchema = new mongoose.Schema(
  {
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true,
      unique: true
    },
    // Batting Statistics
    batting: {
      matches: { type: Number, default: 0 },
      innings: { type: Number, default: 0 },
      runs: { type: Number, default: 0 },
      highestScore: { type: Number, default: 0 },
      average: { type: Number, default: 0 },
      strikeRate: { type: Number, default: 0 },
      centuries: { type: Number, default: 0 },
      halfCenturies: { type: Number, default: 0 },
      fours: { type: Number, default: 0 },
      sixes: { type: Number, default: 0 },
      ducks: { type: Number, default: 0 },
      notOuts: { type: Number, default: 0 }
    },
    // Bowling Statistics
    bowling: {
      matches: { type: Number, default: 0 },
      innings: { type: Number, default: 0 },
      balls: { type: Number, default: 0 },
      runs: { type: Number, default: 0 },
      wickets: { type: Number, default: 0 },
      average: { type: Number, default: 0 },
      economyRate: { type: Number, default: 0 },
      strikeRate: { type: Number, default: 0 },
      bestInnings: { type: String, default: '0/0' },
      fiveWicketHauls: { type: Number, default: 0 },
      fourWicketHauls: { type: Number, default: 0 }
    },
    // Fielding Statistics
    fielding: {
      matches: { type: Number, default: 0 },
      catches: { type: Number, default: 0 },
      runOuts: { type: Number, default: 0 },
      stumpings: { type: Number, default: 0 }
    },
    // Overall Statistics
    overall: {
      matches: { type: Number, default: 0 },
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      winPercentage: { type: Number, default: 0 },
      manOfTheMatch: { type: Number, default: 0 }
    },
    // Recent Form (last 5 matches)
    recentForm: [
      {
        matchId: mongoose.Schema.Types.ObjectId,
        date: Date,
        opponent: String,
        runs: Number,
        wickets: Number,
        rating: Number // 1-10 performance rating
      }
    ],
    // Rankings
    rankings: {
      batting: { type: Number, default: 0 },
      bowling: { type: Number, default: 0 },
      allRounder: { type: Number, default: 0 }
    },
    // Achievements
    achievements: [
      {
        title: String,
        description: String,
        date: Date,
        badge: String
      }
    ],
    // Performance Trends
    trends: {
      batsmanTrend: { type: Number, default: 0 }, // +/- percentage
      bowlerTrend: { type: Number, default: 0 }
    }
  },
  {
    timestamps: true
  }
);

// Calculate batting average
playerStatsSchema.methods.calculateBattingAverage = function () {
  const dismissals = this.batting.innings - this.batting.notOuts;
  if (dismissals === 0) return 0;
  this.batting.average = (this.batting.runs / dismissals).toFixed(2);
  return this.batting.average;
};

// Calculate bowling average
playerStatsSchema.methods.calculateBowlingAverage = function () {
  if (this.bowling.wickets === 0) return 0;
  this.bowling.average = (this.bowling.runs / this.bowling.wickets).toFixed(2);
  return this.bowling.average;
};

// Calculate economy rate
playerStatsSchema.methods.calculateEconomyRate = function () {
  if (this.bowling.balls === 0) return 0;
  const overs = this.bowling.balls / 6;
  this.bowling.economyRate = (this.bowling.runs / overs).toFixed(2);
  return this.bowling.economyRate;
};

// Calculate strike rate
playerStatsSchema.methods.calculateStrikeRate = function () {
  if (this.batting.runs === 0) return 0;
  this.batting.strikeRate = ((this.batting.runs / this.batting.balls) * 100).toFixed(2);
  return this.batting.strikeRate;
};

// Add match performance
playerStatsSchema.methods.addMatchPerformance = function (matchData) {
  // Update recent form
  this.recentForm.unshift({
    matchId: matchData.matchId,
    date: new Date(),
    opponent: matchData.opponent,
    runs: matchData.runs || 0,
    wickets: matchData.wickets || 0,
    rating: matchData.rating || 5
  });

  // Keep only last 5 matches
  if (this.recentForm.length > 5) {
    this.recentForm.pop();
  }

  // Update overall statistics
  this.overall.matches += 1;
  if (matchData.result === 'win') this.overall.wins += 1;
  if (matchData.result === 'loss') this.overall.losses += 1;
  this.overall.winPercentage = ((this.overall.wins / this.overall.matches) * 100).toFixed(2);

  if (matchData.manOfTheMatch) this.overall.manOfTheMatch += 1;
};

module.exports = mongoose.model('PlayerStats', playerStatsSchema);

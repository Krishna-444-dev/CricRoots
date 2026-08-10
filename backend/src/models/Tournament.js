const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema(
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
    format: {
      type: String,
      enum: ['League', 'Knockout', 'Group', 'Round-Robin'],
      default: 'League'
    },
    matchType: {
      type: String,
      enum: ['T20', 'T10', 'ODI', 'Test'],
      default: 'T20'
    },
    status: {
      type: String,
      enum: ['Draft', 'Registration', 'Ongoing', 'Completed', 'Cancelled'],
      default: 'Draft'
    },
    venue: {
      type: String,
      required: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    registrationDeadline: {
      type: Date,
      required: true
    },
    // Teams
    teams: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team'
      }
    ],
    maxTeams: {
      type: Number,
      default: 8
    },
    // Matches
    matches: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Match'
      }
    ],
    // Prize Pool
    prizePool: {
      total: { type: Number, default: 0 },
      firstPlace: { type: Number, default: 0 },
      secondPlace: { type: Number, default: 0 },
      thirdPlace: { type: Number, default: 0 }
    },
    // Standings/Points Table
    standings: [
      {
        team: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Team'
        },
        played: { type: Number, default: 0 },
        won: { type: Number, default: 0 },
        lost: { type: Number, default: 0 },
        tied: { type: Number, default: 0 },
        noResult: { type: Number, default: 0 },
        points: { type: Number, default: 0 },
        netRunRate: { type: Number, default: 0 },
        runsFor: { type: Number, default: 0 },
        runsAgainst: { type: Number, default: 0 }
      }
    ],
    // Tournament Rules
    rules: {
      overs: { type: Number, default: 20 },
      powerplayOvers: { type: Number, default: 6 },
      pointsForWin: { type: Number, default: 2 },
      pointsForTie: { type: Number, default: 1 },
      pointsForNoResult: { type: Number, default: 1 },
      bonusPointThreshold: { type: Number, default: 0 }
    },
    // Tournament Statistics
    statistics: {
      totalMatches: { type: Number, default: 0 },
      completedMatches: { type: Number, default: 0 },
      totalRuns: { type: Number, default: 0 },
      totalWickets: { type: Number, default: 0 },
      highestScore: { type: Number, default: 0 },
      lowestScore: { type: Number, default: 0 },
      highestIndividualScore: { type: Number, default: 0 },
      bestBowlingFigures: { type: String, default: '0/0' }
    },
    // Awards
    awards: {
      winner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team'
      },
      runnerUp: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team'
      },
      thirdPlace: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team'
      },
      manOfTheTournament: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player'
      },
      bestBatsman: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player'
      },
      bestBowler: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player'
      }
    },
    // Media
    logo: String,
    banner: String,
    // Settings
    isPublic: { type: Boolean, default: true },
    allowRegistration: { type: Boolean, default: true },
    requiresApproval: { type: Boolean, default: false }
  },
  {
    timestamps: true
  }
);

// Calculate standings
tournamentSchema.methods.updateStandings = async function () {
  // This would be called after each match to update the points table
  // Implementation would involve fetching match results and recalculating
};

// Get tournament leaderboard
tournamentSchema.methods.getLeaderboard = function () {
  return this.standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.netRunRate - a.netRunRate;
  });
};

// Check if registration is open
tournamentSchema.methods.isRegistrationOpen = function () {
  const now = new Date();
  return (
    this.status === 'Registration' &&
    now < this.registrationDeadline &&
    this.teams.length < this.maxTeams
  );
};

module.exports = mongoose.model('Tournament', tournamentSchema);

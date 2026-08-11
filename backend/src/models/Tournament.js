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

// Parses the "overs.balls" cricket notation (e.g. 11.3 = 11 overs 3 balls)
// back into a true decimal overs value for run-rate math.
function toDecimalOvers(oversNotation) {
  const whole = Math.floor(oversNotation);
  const balls = Math.round((oversNotation - whole) * 10);
  return whole + balls / 6;
}

// Recomputes the full points table from every Completed/Cancelled match
// linked to this tournament. Full recompute (rather than incremental
// updates on each match) keeps this idempotent and safe to call repeatedly.
tournamentSchema.methods.updateStandings = async function () {
  const Match = this.model('Match');
  const matches = await Match.find({
    tournament: this._id,
    status: { $in: ['Completed', 'Cancelled'] }
  });

  const statsByTeam = new Map();
  this.teams.forEach((teamId) => {
    statsByTeam.set(teamId.toString(), {
      team: teamId,
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      noResult: 0,
      points: 0,
      runsFor: 0,
      runsAgainst: 0,
      oversFor: 0,
      oversAgainst: 0
    });
  });

  matches.forEach((match) => {
    const s1 = statsByTeam.get(match.team1.toString());
    const s2 = statsByTeam.get(match.team2.toString());
    if (!s1 || !s2) return; // team not registered in this tournament's team list

    const runs1 = match.innings[0]?.runs || 0;
    const runs2 = match.innings[1]?.runs || 0;
    const overs1 = toDecimalOvers(match.innings[0]?.overs || 0);
    const overs2 = toDecimalOvers(match.innings[1]?.overs || 0);

    s1.played += 1;
    s2.played += 1;
    s1.runsFor += runs1; s1.runsAgainst += runs2; s1.oversFor += overs1; s1.oversAgainst += overs2;
    s2.runsFor += runs2; s2.runsAgainst += runs1; s2.oversFor += overs2; s2.oversAgainst += overs1;

    if (match.status === 'Cancelled') {
      s1.noResult += 1;
      s2.noResult += 1;
      s1.points += this.rules.pointsForNoResult;
      s2.points += this.rules.pointsForNoResult;
    } else if (runs1 === runs2) {
      s1.tied += 1;
      s2.tied += 1;
      s1.points += this.rules.pointsForTie;
      s2.points += this.rules.pointsForTie;
    } else if (runs1 > runs2) {
      s1.won += 1;
      s2.lost += 1;
      s1.points += this.rules.pointsForWin;
    } else {
      s2.won += 1;
      s1.lost += 1;
      s2.points += this.rules.pointsForWin;
    }
  });

  this.standings = Array.from(statsByTeam.values()).map((s) => ({
    team: s.team,
    played: s.played,
    won: s.won,
    lost: s.lost,
    tied: s.tied,
    noResult: s.noResult,
    points: s.points,
    netRunRate: Number(
      ((s.oversFor > 0 ? s.runsFor / s.oversFor : 0) -
        (s.oversAgainst > 0 ? s.runsAgainst / s.oversAgainst : 0)).toFixed(3)
    ),
    runsFor: s.runsFor,
    runsAgainst: s.runsAgainst
  }));
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

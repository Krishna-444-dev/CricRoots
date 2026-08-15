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
    // Free-text custom playing conditions the organizer sets (overs per side, boundary
    // rules, wide/no-ball variants, anything that differs from standard laws) - the
    // in-app assistant grounds tournament-specific rules questions in this text rather
    // than guessing, since every league customizes something. Separate from `rules`
    // below, which is only numeric points config (win/tie/no-result scoring).
    houseRules: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: ''
    },
    // Document library (PDF/Word) - league rules, registration guide, captain guide, nomination
    // sheet, etc. Purely human-readable downloads, not parsed for text, so they don't feed the
    // in-app assistant the way houseRules itself does (see backend/src/data and
    // assistantController.js). `category` is a free-text label the uploader supplies (e.g.
    // "House Rules", "Registration Guide") rather than a fixed enum, so organizers aren't boxed
    // into a predefined list. Generalized from an earlier single houseRulesDocument slot - no
    // tournament in the live DB had one set at migration time, so no data migration was needed.
    documents: [
      {
        url: { type: String, required: true },
        fileName: { type: String, required: true },
        category: { type: String, trim: true, default: 'General' },
        uploadedAt: { type: Date, default: Date.now }
      }
    ],
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    // Optional parent League (a season/edition belongs to a league; standalone tournaments
    // leave this null). See League.js.
    league: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'League',
      default: null
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
    // Group-stage assignment - populated by POST /:id/assign-groups, which splits `teams`
    // (in their existing registration order, deterministically - no shuffling) into evenly
    // sized named groups ahead of fixture generation. Empty for tournaments that don't use a
    // group stage (the pre-existing flat round-robin/knockout behavior stays keyed off that:
    // see generateFixtures/getTournamentStandings in tournamentController.js).
    groups: [
      {
        name: { type: String, required: true }, // e.g. "Group A", "Group B"
        teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }]
      }
    ],
    // Divisions - a second, optional level above `groups` (populated by POST
    // /:id/assign-divisions, which splits `teams` into named divisions before assign-groups
    // splits each division's own teams into groups). A tournament with divisions runs each
    // division as a fully independent competition sharing only the tournament's own
    // name/venue/dates/organizer - its own groups, standings, knockout bracket, and awards
    // (see the division-scoped branches in tournamentController.js). Matches this app's
    // "League -> Tournament -> Division" model on how real club leagues (e.g. CricClubs) run
    // simultaneous divisions under one championship banner. A tournament that never calls
    // assign-divisions keeps using the flat `groups` field above untouched - divisions are
    // additive, not a replacement.
    divisions: [
      {
        name: { type: String, required: true }, // e.g. "Division 1", "Elite"
        // This division's own teams (a subset of the tournament's `teams` above), set by
        // assign-divisions. Split further into `groups` below by a division-scoped call to
        // assign-groups - empty until then.
        teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
        groups: [
          {
            name: { type: String, required: true },
            teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }]
          }
        ],
        awards: {
          winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
          runnerUp: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
          thirdPlace: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
          manOfTheTournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
          bestBatsman: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
          bestBowler: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null }
        }
      }
    ],
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

// Builds a points table (unsorted - insertion order follows `teamRefs`) from a given list of
// matches and a given list of teams, using the given points-scoring rules. This is the exact
// same per-match points/runs/overs accumulation `updateStandings()` always used, pulled out
// into a standalone static so it can be reused for per-group standings and knockout-stage
// qualification (see getTournamentStandings/generateKnockoutStage in tournamentController.js)
// without duplicating - and risking drifting from - the math. `teamRefs` entries may be raw
// ObjectIds or populated Team documents; whatever shape each entry has is what comes back in
// the resulting row's `team` field, unchanged.
tournamentSchema.statics.buildStandingsTable = function (matches, teamRefs, rules) {
  const statsByTeam = new Map();
  teamRefs.forEach((teamRef) => {
    const id = (teamRef && teamRef._id ? teamRef._id : teamRef).toString();
    statsByTeam.set(id, {
      team: teamRef,
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
    if (!s1 || !s2) return; // team not in this table's team list

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
      s1.points += rules.pointsForNoResult;
      s2.points += rules.pointsForNoResult;
    } else if (runs1 === runs2) {
      s1.tied += 1;
      s2.tied += 1;
      s1.points += rules.pointsForTie;
      s2.points += rules.pointsForTie;
    } else if (runs1 > runs2) {
      s1.won += 1;
      s2.lost += 1;
      s1.points += rules.pointsForWin;
    } else {
      s2.won += 1;
      s1.lost += 1;
      s2.points += rules.pointsForWin;
    }
  });

  return Array.from(statsByTeam.values()).map((s) => ({
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

// Ranks a standings table (as returned by buildStandingsTable) best-first: points descending,
// net run rate descending on ties - the exact same tiebreak getLeaderboard() already applies.
// Returns a new array (does not mutate the input), unlike getLeaderboard()'s in-place sort.
tournamentSchema.statics.rankStandings = function (standings) {
  return [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.netRunRate - a.netRunRate;
  });
};

// Recomputes the full points table from every Completed/Cancelled match
// linked to this tournament. Full recompute (rather than incremental
// updates on each match) keeps this idempotent and safe to call repeatedly.
tournamentSchema.methods.updateStandings = async function () {
  const Match = this.model('Match');
  const matches = await Match.find({
    tournament: this._id,
    status: { $in: ['Completed', 'Cancelled'] },
    // Only group/round-robin-stage matches feed the points table - every match defaults to
    // round: 'Group' (see Match.js), so this is a no-op for tournaments with no knockout
    // stage. Without this filter, a completed Quarterfinal/Semifinal/Final would get folded
    // into the same flat table as group matches (extra "played"/points for whoever went
    // furthest), which is both not how a real points table works and corrupts
    // computeAwards's winner/runnerUp derivation for non-knockout-aware callers.
    round: 'Group',
    // Same reasoning, for divisions: this flat `standings` field is only meaningful for a
    // tournament with no divisions (every match defaults to division: null) - a divisioned
    // tournament's real standings live per-division in getTournamentStandings, computed fresh
    // from each division's own matches, not synced onto this field at all.
    division: null
  });

  this.standings = this.constructor.buildStandingsTable(matches, this.teams, this.rules);
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

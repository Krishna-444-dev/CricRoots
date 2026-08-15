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
  // Which of the tournament's groups this match belongs to (the group's `name`, e.g. "Group A") -
  // null for matches that aren't part of a group stage (no groups assigned, or a knockout match).
  group: {
    type: String,
    default: null
  },
  // Which of the tournament's divisions this match belongs to (the division's `name`) - null
  // for matches in a tournament with no divisions. See Tournament.js's `divisions` field.
  division: {
    type: String,
    default: null
  },
  // Which stage of the tournament this match is part of. Group-stage matches (including every
  // match in a tournament with no groups at all) default to 'Group'; knockout matches are
  // created with round explicitly set by generate-knockout-stage/advance-knockout-round in
  // tournamentController.js.
  round: {
    type: String,
    enum: ['Group', 'Quarterfinal', 'Semifinal', 'Final'],
    default: 'Group'
  },
  // The match's original overs-per-side allocation. Not derived from matchType (T20 doesn't
  // always mean exactly 20 at club level, and 'Friendly'/other formats have no implied
  // count) - explicit so the rain-rule calculator has a real reference to normalize against.
  totalOvers: {
    type: Number,
    default: 20
  },
  // Set when the second innings' overs get reduced mid-match (rain/other stoppage) - see
  // backend/src/services/rainRuleCalculator.js for the calculation and its real scope/
  // accuracy caveats. Deliberately only covers the single most common club-cricket case
  // (team 2's innings shortened, team 1 completed their full original allocation) - null
  // when no interruption has been applied.
  interruption: {
    type: {
      revisedOvers: Number,
      oversBowledAtInterruption: Number,
      wicketsLostAtInterruption: Number,
      resourcePercentRemaining: Number,
      parScore: Number,
      target: Number,
      appliedAt: Date
    },
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
    // Full snapshot of the scorer's client-side InningsData (current striker/non-striker/
    // bowler, per-player scorecards, partnerships, fall of wickets, extras breakdown) after
    // the most recently recorded ball - saved verbatim so a second device/scorer picking up
    // this match (previous scorer's phone died, handed off mid-over, etc.) can resume exactly
    // where the innings left off instead of re-deriving "who's on strike" from the ball log,
    // which is ambiguous (a non-striker who hasn't yet faced a ball this innings never
    // appears in it). Opaque to the schema on purpose - shape is owned by the frontend
    // (see web-app/components/scoring/BallByBallScoring.tsx's InningsData type).
    liveState: { type: mongoose.Schema.Types.Mixed, default: null },
    balls: [{
      ballNumber: Number,
      batsmanId: mongoose.Schema.Types.ObjectId,
      bowlerId: mongoose.Schema.Types.ObjectId,
      runs: Number,
      isWicket: Boolean,
      wicketType: String, // bowled, caught, lbw, run out, etc.

      // Auto-generated natural-language commentary for this ball - see
      // backend/src/services/commentaryGenerator.js
      commentary: { type: String, default: '' },

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
    winningTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    decision: String // 'bat' or 'bowl'
  },
  // Auto-generated recap shown on the match page once it's Completed (see
  // services/matchSummaryGenerator.js) - not user-editable, filled in once the first time the
  // match completes (matchController.updateMatch only generates it while empty).
  summary: { type: String, default: '' },
  // Longer, multi-paragraph narrative for the dedicated "Match Story" tab - see
  // services/matchStoryGenerator.js. Distinct from `summary` above (a 2-3 sentence blurb for the
  // Info tab card): this tells the actual story of how the match unfolded, phase by phase.
  // Array of paragraph strings so the frontend can render each as its own <p>/<Text> block
  // without re-splitting a single blob. Same fill-once-while-empty convention as `summary`.
  story: { type: [String], default: [] },
  // Match-specific reference documents (team sheets, ground rules addenda, dispute reports, ...)
  // - same shape/pattern as Tournament.documents, distinct from it since a document here is
  // scoped to one match, not the whole tournament.
  documents: [
    {
      url: { type: String, required: true },
      fileName: { type: String, required: true },
      category: { type: String, trim: true, default: 'General' },
      uploadedAt: { type: Date, default: Date.now }
    }
  ],
  // Match photos - CricClubs' Gallery tab. Same disk-upload pattern as `documents` above, but
  // these are browsed for their own sake rather than categorized reference material, so a
  // `caption` field instead of `fileName`/`category`.
  photos: [
    {
      url: { type: String, required: true },
      caption: { type: String, trim: true, default: '' },
      uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      uploadedAt: { type: Date, default: Date.now }
    }
  ],
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
  },
  // Officials appointed to run the match - distinct from createdBy (the organizer who set the
  // fixture up) and from either team's roster. Referenced by User, not Player, since umpiring
  // doesn't require a player profile. See canManageMatch() in matchController.js for how this
  // combines with createdBy/roster membership to decide who may record balls or change status.
  umpires: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Whoever currently holds the exclusive right to record balls - opening scoring up to
  // every rostered player plus umpires (see canManageMatch) means two people could otherwise
  // record conflicting balls at once. lastActiveAt drives a short expiry (see LOCK_TIMEOUT_MS
  // in matchController.js) rather than requiring an explicit release, so a scorer whose
  // session genuinely dies doesn't permanently lock everyone else out - the resume feature
  // (innings.liveState) exists specifically so someone else can then pick up cleanly.
  activeScorer: {
    type: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: String,
      lastActiveAt: Date
    },
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Match', matchSchema);

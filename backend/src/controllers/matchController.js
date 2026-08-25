const path = require('path');
const fs = require('fs');
const Match = require('../models/Match');
const Team = require('../models/Team');
const Player = require('../models/Player');
const User = require('../models/User');
const Tournament = require('../models/Tournament');
const { MATCH_PHOTO_DIR } = require('../middleware/upload');
const AIService = require('../utils/aiService');
const { currentChaseState } = require('../services/matchStateFeatures');
const { getMatchCharts } = require('../services/matchCharts');
const { computeMatchMVP, computeMatchMVPPoints } = require('../services/mvpCalculator');
const { generateCommentary } = require('../services/commentaryGenerator');
const { getKeyMoments } = require('../services/keyMoments');
const { settlePredictions } = require('../services/predictionSettler');
const { generateMatchArticle } = require('../services/matchArticleGenerator');
const { generateMatchSummary } = require('../services/matchSummaryGenerator');
const { generateMatchStory } = require('../services/matchStoryGenerator');
const { generatePostMatchTacticalReport } = require('../services/postMatchTacticalReport');
const { notifyMatchStatusChange } = require('../services/notificationService');
const { getMatchPerformanceReport, getBowlerLineLengthEffectiveness, getLiveMatchupPlan } = require('../services/tendencyAnalytics');
const { blendWithPrior } = require('../utils/statUtils');
const { resourcePercent, revisedTarget } = require('../services/rainRuleCalculator');

const MIN_BALLS_FOR_OWN_DATA = 6;

// How long a scoring lock stays valid without renewal before it's considered abandoned and
// up for grabs - long enough to absorb normal network blips between balls, short enough that
// a scorer whose session actually died doesn't lock the match for the rest of the innings.
const LOCK_TIMEOUT_MS = 2 * 60 * 1000;

function isLockFresh(activeScorer) {
  return !!activeScorer && !!activeScorer.lastActiveAt && (Date.now() - new Date(activeScorer.lastActiveAt).getTime()) < LOCK_TIMEOUT_MS;
}

// Populate helper for manOfTheMatch: the field only stores a Player ref, but
// display needs the player's user's name - mirrors the nested Player->User
// populate pattern used for tournament awards in tournamentController.js.
const MAN_OF_THE_MATCH_POPULATE = { path: 'manOfTheMatch', populate: { path: 'user', select: 'name' } };

// A Live match sits in its first innings until the second one actually has balls -
// `status === 'Live'` alone can't tell those apart, so use whichever innings has been
// bowled at, defaulting to the first when neither has (freshly started match).
function currentInningsIndex(match) {
  return match.innings[1]?.balls?.length > 0 ? 1 : 0;
}

// Powerplay length in overs (the first N overs of each innings, mirroring the single-block
// model already used by Tournament.rules.powerplayOvers - not the multi-block ODI system,
// which isn't modeled anywhere in this codebase). A tournament's own house rule wins when the
// match belongs to one (see cricketRulesSummary.md: "check the tournament's house rules...
// rather than assuming a fixed number"); otherwise falls back to a sensible default by
// format. Test cricket has no fielding-restriction powerplay at all.
const DEFAULT_POWERPLAY_OVERS_BY_TYPE = { T20: 6, ODI: 10 };
function getPowerplayOvers(match) {
  if (match.tournament && typeof match.tournament === 'object' && match.tournament.rules?.powerplayOvers != null) {
    return match.tournament.rules.powerplayOvers;
  }
  if (match.matchType === 'Test') return null;
  if (match.matchType in DEFAULT_POWERPLAY_OVERS_BY_TYPE) {
    return DEFAULT_POWERPLAY_OVERS_BY_TYPE[match.matchType];
  }
  // Friendly/other custom formats: no fixed convention, so scale roughly with T20's 6-in-20
  // ratio rather than applying a fixed 6, which could exceed a short match's total overs.
  return Math.max(1, Math.round((match.totalOvers || 20) * 0.3));
}

// Who's allowed to score/manage a match: the organizer who created it, an appointed umpire,
// or anyone actually rostered on either playing team - previously only createdBy could, which
// meant a single person had to score an entire match alone with no way to hand off. Umpire
// appointment itself stays creator-only (see addUmpire/removeUmpire) so this pool can't grow
// itself; being on it doesn't include the power to add more officials.
async function canManageMatch(match, userId) {
  if (match.createdBy.toString() === userId) return true;
  if ((match.umpires || []).some((u) => u.toString() === userId)) return true;

  const playerProfile = await Player.findOne({ user: userId });
  if (!playerProfile) return false;

  const [team1, team2] = await Promise.all([
    Team.findById(match.team1).select('players'),
    Team.findById(match.team2).select('players'),
  ]);
  const playerId = playerProfile._id.toString();
  const inTeam1 = team1?.players?.some((p) => p.toString() === playerId);
  const inTeam2 = team2?.players?.some((p) => p.toString() === playerId);
  return Boolean(inTeam1 || inTeam2);
}

// @desc    Create a new match
// @route   POST /api/matches
// @access  Private
exports.createMatch = async (req, res) => {
  try {
    const { title, team1Id, team2Id, matchType, venue, scheduledDate, pitchType, tournamentId, totalOvers } = req.body;

    if (!title || !team1Id || !team2Id || !venue || !scheduledDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    const team1 = await Team.findById(team1Id);
    const team2 = await Team.findById(team2Id);

    if (!team1 || !team2) {
      return res.status(404).json({
        success: false,
        message: 'One or both teams not found'
      });
    }

    let tournament = null;
    if (tournamentId) {
      tournament = await Tournament.findById(tournamentId);
      if (!tournament) {
        return res.status(404).json({
          success: false,
          message: 'Tournament not found'
        });
      }
    }

    // No implicit per-matchType over count is enforced anywhere else in this codebase (club
    // "T20" games don't always mean exactly 20 overs, and 'Friendly'/'Test' have no fixed
    // count) - only used as a fallback default when the creator doesn't specify totalOvers
    // explicitly, primarily so the rain-rule calculator always has a real reference to
    // normalize against.
    const DEFAULT_OVERS_BY_TYPE = { T20: 20, ODI: 50, Test: 90, Friendly: 20 };
    const resolvedTotalOvers = totalOvers || DEFAULT_OVERS_BY_TYPE[matchType] || 20;

    const match = await Match.create({
      title,
      team1: team1Id,
      team2: team2Id,
      matchType: matchType || 'T20',
      venue,
      pitchType: pitchType || 'unknown',
      scheduledDate,
      totalOvers: resolvedTotalOvers,
      createdBy: req.user.id,
      tournament: tournament ? tournament._id : null,
      innings: [
        { team: team1Id, runs: 0, wickets: 0, overs: 0, balls: [] },
        { team: team2Id, runs: 0, wickets: 0, overs: 0, balls: [] }
      ]
    });

    if (tournament) {
      tournament.matches.push(match._id);
      await tournament.save();
    }

    await match.populate('team1');
    await match.populate('team2');
    await match.populate('createdBy');

    // Emit match created event
    req.io.emit('match-created', {
      matchId: match._id,
      match,
      timestamp: new Date()
    });

    res.status(201).json({
      success: true,
      match
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all matches
// @route   GET /api/matches
// @access  Public
exports.getAllMatches = async (req, res) => {
  try {
    // Excludes innings.balls - a list view has no use for full ball-by-ball data (commentary,
    // per-delivery tagging, ...), and including it here was returning 50+MB for a few hundred
    // real matches, taking 10+ seconds and effectively hanging the Matches page. innings.runs/
    // wickets/overs are kept so the list can still show live/final scores per team.
    // Optional ?status= and ?limit= - both no-ops for any existing caller that omits them
    // (full unfiltered list, same as before), added for the home page's single-most-recent-
    // result hero, which has no business paging through the entire matches collection to
    // find one match.
    const { status, limit } = req.query;
    const query = status ? Match.find({ status }) : Match.find();
    let matches = query
      .select('-innings.balls')
      .populate('team1')
      .populate('team2')
      .populate(MAN_OF_THE_MATCH_POPULATE)
      .populate({ path: 'umpires', select: 'name' })
      .sort({ scheduledDate: -1 });
    if (limit) matches = matches.limit(Math.min(parseInt(limit, 10) || 0, 50));
    matches = await matches;

    res.status(200).json({
      success: true,
      count: matches.length,
      matches
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get match by ID
// @route   GET /api/matches/:id
// @access  Public
exports.getMatch = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate('team1')
      .populate('team2')
      .populate('toss.winningTeam')
      .populate(MAN_OF_THE_MATCH_POPULATE)
      .populate('createdBy')
      .populate({ path: 'umpires', select: 'name' })
      .populate({ path: 'tournament', select: 'rules' });

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    res.status(200).json({
      success: true,
      match,
      powerplayOvers: getPowerplayOvers(match)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update match status
// @route   PUT /api/matches/:id
// @access  Private
exports.updateMatch = async (req, res) => {
  try {
    let match = await Match.findById(req.params.id);

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    if (!(await canManageMatch(match, req.user.id))) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this match'
      });
    }

    const { status, toss, result, manOfTheMatch } = req.body;
    // Captured before mutation so the notification block below can tell an actual transition
    // into Live/Completed apart from a no-op re-save of a match that's already in that status.
    const previousStatus = match.status;
    if (status) match.status = status;
    if (toss) match.toss = toss;
    if (result) match.result = result;
    if (manOfTheMatch) {
      match.manOfTheMatch = manOfTheMatch;
      match.manOfTheMatchSource = 'human';
      match.manOfTheMatchSelectedBy = req.user?.id || null;
      match.manOfTheMatchSelectedAt = new Date();
    }

    // Auto-derive the result from the innings totals when a match is marked
    // Completed without an explicit result being supplied.
    if (status === 'Completed' && !result) {
      const runs1 = match.innings[0]?.runs || 0;
      const runs2 = match.innings[1]?.runs || 0;
      if (runs1 === runs2) {
        match.result = { winningTeam: null, margin: 'tie', marginValue: 0 };
      } else if (runs1 > runs2) {
        match.result = { winningTeam: match.team1, margin: 'runs', marginValue: runs1 - runs2 };
      } else {
        match.result = { winningTeam: match.team2, margin: 'runs', marginValue: runs2 - runs1 };
      }
    }

    // Man of the Match, with provenance.
    //
    // computeMatchMVP runs on EVERY completion, including when an organizer has supplied their own
    // pick - the algorithm's recommendation is recorded whether or not anyone disagreed with it.
    // Storing it only on disagreement would leave the agreement case unobservable, and agreement is
    // the denominator of any human-vs-model comparison. Once the match is saved neither case can be
    // reconstructed. See models/Match.js and documentation/evidence-provenance-backlog.md §1b.
    if (status === 'Completed') {
      match.manOfTheMatchComputed = computeMatchMVP(match);
      if (!manOfTheMatch) {
        match.manOfTheMatch = match.manOfTheMatchComputed;
        match.manOfTheMatchSource = 'algorithm';
      }
    }

    match = await match.save();
    await match.populate('team1');
    await match.populate('team2');
    await match.populate('toss.winningTeam');
    await match.populate(MAN_OF_THE_MATCH_POPULATE);

    // Auto-generate the match page's post-match recap (Info tab) - every completed match, not
    // just tournament ones (see matchSummaryGenerator.js for how this differs from the
    // tournament-only news article below). Wrapped the same defensive way: a bug here must never
    // fail match completion itself.
    if (match.status === 'Completed' && !match.summary) {
      try {
        match.summary = await generateMatchSummary(match);
        if (match.summary) await match.save();
      } catch (summaryError) {
        console.error('Match summary generation failed:', summaryError.message);
      }
    }

    // Auto-generate the longer, multi-paragraph "Match Story" tab content - same guarded,
    // fill-once-while-empty pattern as the short summary above. Kept as a separate hook (not
    // folded into the block above) since it's a materially heavier computation (partnerships +
    // phase breakdown + name resolution for both innings) and the two are independently useful -
    // a failure generating one shouldn't be conflated with the other in the logs.
    if (match.status === 'Completed' && match.story.length === 0) {
      try {
        match.story = await generateMatchStory(match);
        if (match.story.length > 0) await match.save();
      } catch (storyError) {
        console.error('Match story generation failed:', storyError.message);
      }
    }

    // Refresh the tournament's points table if this match belongs to one
    // and just moved into a state that counts toward standings.
    if (match.tournament && ['Completed', 'Cancelled'].includes(match.status)) {
      const tournament = await Tournament.findById(match.tournament);
      if (tournament) {
        await tournament.updateStandings();
        await tournament.save();
      }
    }

    // Settle the free points-based prediction game once a result exists - runs after save so
    // predictions never see a partially-committed match.result.
    if (match.status === 'Completed' && match.result) {
      await settlePredictions(match);
    }

    // Auto-generate a tournament news article spotlighting the match's standout performance
    // (century, five-wicket haul, etc). Wrapped so a bug here can never fail match completion
    // itself - this is a nice-to-have layered on top, not core to recording a result.
    if (match.status === 'Completed' && match.tournament) {
      try {
        const tournament = await Tournament.findById(match.tournament);
        if (tournament) {
          await generateMatchArticle(match, tournament);
        }
      } catch (articleError) {
        console.error('Match article generation failed:', articleError.message);
      }
    }

    // Notify every rostered player on either playing team when the match actually transitions
    // into Live or Completed (not on a no-op re-save of a match already in that status - see
    // `previousStatus` above). Wrapped the same defensive way as the other post-update side
    // effects in this function: a notification bug must never fail match completion itself.
    if (status && status !== previousStatus && ['Live', 'Completed'].includes(status)) {
      try {
        await notifyMatchStatusChange(match, status === 'Live' ? 'match_live' : 'match_completed');
      } catch (notifyError) {
        console.error('Match notification creation failed:', notifyError.message);
      }
    }

    // Emit match status change event
    req.socketManager.emitMatchStatusChange(match._id, match.status);

    res.status(200).json({
      success: true,
      match
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Record a ball in match with WebSocket and AI insights
// @route   POST /api/matches/:id/record-ball
// @access  Private
exports.recordBall = async (req, res) => {
  try {
    const {
      inningsIndex, ballNumber, batsmanId, bowlerId, runs, isWicket, wicketType,
      isExtra, extraType,
      line, length, shotType, shotZone, fielderId, fielderPosition,
      batsmanName, bowlerName, fielderName, liveState
    } = req.body;

    let match = await Match.findById(req.params.id);

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    if (!(await canManageMatch(match, req.user.id))) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this match'
      });
    }

    // Only whoever currently holds the scoring lock may actually record a ball - the score
    // page acquires this lock on load (POST .../scoring-lock) before showing the scoring UI,
    // so reaching here without holding it means either the lock expired mid-session or
    // someone else has since taken over.
    if (isLockFresh(match.activeScorer) && match.activeScorer.user.toString() !== req.user.id) {
      return res.status(423).json({
        success: false,
        message: `${match.activeScorer.name} is currently scoring this match`
      });
    }

    if (inningsIndex < 0 || inningsIndex >= match.innings.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid innings index'
      });
    }

    // Match state BEFORE this delivery, read before any of the mutations below. This is the
    // state the delivery was actually bowled in, and it is unbackfillable - see the field
    // comments in models/Match.js. Captured here rather than derived later because replaying an
    // innings only works for complete, uninterrupted innings.
    const inningsBefore = match.innings[inningsIndex];
    const legalBallsBefore = inningsBefore.balls.filter(
      (b) => !(b.isExtra && ['wide', 'no-ball'].includes(b.extraType))
    ).length;

    // Add ball to innings
    const ball = {
      ballNumber,
      batsmanId,
      bowlerId,
      runsBefore: inningsBefore.runs,
      wicketsBefore: inningsBefore.wickets,
      legalBallsBefore,
      runs: runs || 0,
      isWicket: isWicket || false,
      wicketType: wicketType || null,
      isExtra: isExtra || false,
      extraType: extraType || 'none',
      line: line || 'unknown',
      length: length || 'unknown',
      shotType: shotType || null,
      shotZone: shotZone || null,
      fielderId: fielderId || null,
      fielderPosition: fielderPosition || null
    };

    // Auto-generated commentary - names come from the client (already in state at the
    // moment a ball is scored) rather than a server-side lookup, to avoid adding DB
    // round-trips between this read and the save() below.
    ball.commentary = generateCommentary(ball, { batsmanName, bowlerName, fielderName });

    match.innings[inningsIndex].balls.push(ball);
    match.innings[inningsIndex].runs += runs || 0;
    if (isWicket) {
      match.innings[inningsIndex].wickets += 1;
    }

    // Calculate overs (6 legal balls = 1 over; wides/no-balls don't count toward the over)
    const legalBalls = match.innings[inningsIndex].balls.filter(
      b => !(b.isExtra && ['wide', 'no-ball'].includes(b.extraType))
    ).length;
    match.innings[inningsIndex].overs = Math.floor(legalBalls / 6) + (legalBalls % 6) / 10;

    if (liveState) {
      match.innings[inningsIndex].liveState = liveState;
      // Mixed-type paths inside a DocumentArray element aren't always picked up by Mongoose's
      // change detection on plain assignment - mark it explicitly so this doesn't silently
      // fail to persist.
      match.markModified(`innings.${inningsIndex}.liveState`);
    }

    // Recording a ball is itself activity - renew the lock so a scorer mid-over doesn't need
    // to rely solely on the separate heartbeat call to stay ahead of LOCK_TIMEOUT_MS.
    if (match.activeScorer && match.activeScorer.user.toString() === req.user.id) {
      match.activeScorer.lastActiveAt = new Date();
    }

    match = await match.save();
    await match.populate('team1');
    await match.populate('team2');

    // Chase-state features for the win-probability model, or null during the first innings.
    // See services/matchStateFeatures.js - this used to be constructed inline with `innings.overs`
    // (cricket notation) as a run-rate divisor and `innings[0].runs` as the target regardless of
    // which innings was in progress.
    const matchState = currentChaseState(match);

    // Emit ball recorded event via WebSocket. emitBallRecorded skips the AI push when matchState
    // is null rather than substituting defaults.
    req.socketManager.emitBallRecorded(match._id, ball, matchState);

    // Emit wicket event if applicable
    if (isWicket) {
      req.socketManager.emitWicket(match._id, {
        ballNumber,
        batsmanId,
        bowlerId,
        wicketType,
        currentWickets: match.innings[inningsIndex].wickets
      });
    }

    res.status(200).json({
      success: true,
      message: 'Ball recorded successfully',
      match
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Apply a rain/stoppage interruption, reducing innings[1] (the chasing team)'s
//          overs and computing a revised target - see rainRuleCalculator.js for the
//          calculation and its real accuracy/scope caveats (an approximation, not the
//          licensed official DLS algorithm; only covers the single most common scenario of
//          team 1 having completed their full original allocation and team 2's overs being
//          reduced, not arbitrary multi-interruption chains).
// @route   POST /api/matches/:id/apply-interruption
// @access  Private (match owner only)
exports.applyInterruption = async (req, res) => {
  try {
    const { revisedOvers } = req.body;

    if (!revisedOvers || revisedOvers <= 0) {
      return res.status(400).json({ success: false, message: 'revisedOvers must be a positive number' });
    }

    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }
    if (!(await canManageMatch(match, req.user.id))) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this match' });
    }
    if (match.innings.length < 2 || !match.innings[0] || match.innings[0].runs === undefined) {
      return res.status(400).json({ success: false, message: 'First innings must exist before applying an interruption to the chase' });
    }

    const chase = match.innings[1];
    const oversBowled = chase.overs || 0;
    const wicketsLost = chase.wickets || 0;

    if (revisedOvers <= oversBowled) {
      return res.status(400).json({ success: false, message: `Revised overs (${revisedOvers}) must be greater than overs already bowled (${oversBowled})` });
    }

    const oversRemainingAfterReduction = revisedOvers - oversBowled;
    const resourcePercentRemaining = resourcePercent(oversRemainingAfterReduction, wicketsLost, match.totalOvers);
    const { parScore, target } = revisedTarget(match.innings[0].runs, 100, resourcePercentRemaining);

    match.interruption = {
      revisedOvers,
      oversBowledAtInterruption: oversBowled,
      wicketsLostAtInterruption: wicketsLost,
      resourcePercentRemaining: Math.round(resourcePercentRemaining * 100) / 100,
      parScore,
      target,
      appliedAt: new Date()
    };
    await match.save();

    req.io.emit('match-interruption', { matchId: match._id, interruption: match.interruption });

    res.status(200).json({ success: true, match, interruption: match.interruption });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get match scorecard with AI insights
// @route   GET /api/matches/:id/scorecard
// @access  Public
exports.getScorecard = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate('team1')
      .populate('team2')
      .populate(MAN_OF_THE_MATCH_POPULATE);

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    const scorecard = {
      matchTitle: match.title,
      matchType: match.matchType,
      status: match.status,
      venue: match.venue,
      scheduledDate: match.scheduledDate,
      team1: {
        name: match.team1.name,
        runs: match.innings[0]?.runs || 0,
        wickets: match.innings[0]?.wickets || 0,
        overs: match.innings[0]?.overs || 0
      },
      team2: {
        name: match.team2.name,
        runs: match.innings[1]?.runs || 0,
        wickets: match.innings[1]?.wickets || 0,
        overs: match.innings[1]?.overs || 0
      },
      result: match.result,
      manOfTheMatch: match.manOfTheMatch
    };

    // AI insights only exist during a chase - the model is trained exclusively on second-innings
    // states (E2). No first-innings substitute is served.
    const chaseState = currentChaseState(match);
    const aiInsights = chaseState ? await AIService.getTacticalAdvice(chaseState) : null;

    res.status(200).json({
      success: true,
      scorecard,
      aiInsights: aiInsights && aiInsights.success ? aiInsights : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get Manhattan/Worm chart data (runs per over + cumulative total per over) for both innings
// @route   GET /api/matches/:id/charts
// @access  Public
exports.getMatchCharts = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate('team1')
      .populate('team2');

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    const teamsByInningsIndex = [match.team1, match.team2];
    const innings = getMatchCharts(match).map((entry, index) => ({
      ...entry,
      team: teamsByInningsIndex[index]
    }));

    res.status(200).json({
      success: true,
      innings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Full ranked MVP points breakdown for this match - every player who touched the ball,
//          sorted descending by the same computeMatchMVPPoints score manOfTheMatch is picked
//          from (the #1 entry here). Player names aren't resolved server-side: the match page
//          already builds its own playerId -> name map from GET /api/players (see
//          fetchPlayerDirectory in app/match/[id]/page.tsx), so this just returns raw ids.
// @route   GET /api/matches/:id/mvp
// @access  Public
exports.getMatchMVP = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id).select('innings').lean();

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    const mvp = [...computeMatchMVPPoints(match).entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([playerId, points]) => ({ playerId, points: Math.round(points * 100) / 100 }));

    res.status(200).json({
      success: true,
      mvp
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Post-match phase report (Powerplay/Middle/Death run rate comparison for both
//          teams) - the AI Insights tab's completed-match content, since the live tactical
//          advisor and the ball-level "key moments" below don't cover a phase-shape comparison.
// @route   GET /api/matches/:id/tactical-report
// @access  Public
exports.getPostMatchTacticalReport = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id).populate('team1 team2', 'name').lean();

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    const report = generatePostMatchTacticalReport(match);

    if (!report) {
      return res.status(400).json({
        success: false,
        message: 'Not enough recorded deliveries in both innings to build a phase report.'
      });
    }

    res.status(200).json({ success: true, report });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get the deliveries with the biggest win-probability swings in the chase (WPA-style
//          "key moments"), auto-highlighting a completed or in-progress run chase.
// @route   GET /api/matches/:id/key-moments
// @access  Public
exports.getKeyMomentsForMatch = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    const result = await getKeyMoments(match);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Post-match performance report for a single player in a single match:
//          this match's batting/bowling figures, a comparison against career
//          averages, a recent-form trend across the last 5 matches, any new
//          personal bests / achievement badges this match satisfies, and - the
//          differentiated part - whether each dismissal this match came from a
//          zone the hierarchical matchup-shrinkage engine (getMatchupPlan) had
//          already flagged as high-risk for this batter against that bowler.
//          Computed fully on demand, nothing pre-computed/stored - matches every
//          other analytics endpoint in this codebase.
// @route   GET /api/matches/:matchId/performance-report/:playerId
// @access  Public
exports.getPlayerPerformanceReport = async (req, res) => {
  try {
    const { matchId, playerId } = req.params;
    const report = await getMatchPerformanceReport(matchId, playerId);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Match or player not found' });
    }

    res.status(200).json({ success: true, ...report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get AI tactical insights for a match
// @route   GET /api/matches/:id/ai-insights
// @access  Public
exports.getAIInsights = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    // The win-probability model is a CHASE model - extractWinProbabilityData.js emits second-
    // innings rows only. Asking it about a first-innings state used to pass the batting side's own
    // live score as `targetScore`, which is not a state a chase can be in, and the resulting
    // number was rendered as a win probability. Return an explicit unavailability instead of a
    // plausible-looking number (E2).
    const chaseState = currentChaseState(match);
    if (!chaseState) {
      return res.status(200).json({
        success: true,
        available: false,
        reason: 'first-innings-model-does-not-exist',
        message: 'Win probability is only modelled for the second innings.'
      });
    }

    const aiInsights = await AIService.getTacticalAdvice(chaseState);

    if (!aiInsights.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get AI insights'
      });
    }

    res.status(200).json({
      success: true,
      available: true,
      aiInsights
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Recommend which bowler should bowl the next over, grounded in the bowling team's
//          real roster and this app's own matchup/tendency data - not a synthetic model.
//          Ranks candidates by: (1) how likely they are to dismiss the current striker,
//          blending historical matchup data with what's happened in this match so far
//          (tendencyAnalytics.getLiveMatchupPlan - the same hierarchical-shrinkage engine
//          used for scouting reports), (2) failing that, their overall economy rate, (3)
//          failing that, a generic specialization-based ordering. A bowler can't bowl two
//          overs back to back, so whoever bowled the innings' most recent over is excluded.
// @route   GET /api/matches/:id/next-bowler-recommendation
// @access  Public
exports.getNextBowlerRecommendation = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }

    const inningsIdx = currentInningsIndex(match);
    const innings = match.innings[inningsIdx];
    const liveState = innings?.liveState;
    const striker = liveState?.currentBatsmen?.[0];
    const lastBowler = liveState?.currentBowler;

    if (!striker) {
      return res.status(200).json({
        success: true,
        source: 'unavailable',
        message: 'No live scoring state for this innings yet - recommendations need at least one ball recorded through the scoring UI.'
      });
    }

    // The bowling team is whichever of the two playing teams isn't currently batting.
    const bowlingTeamId = innings.team.toString() === match.team1.toString() ? match.team2 : match.team1;
    const bowlingTeam = await Team.findById(bowlingTeamId).populate({
      path: 'players',
      populate: { path: 'user', select: 'name' }
    });
    if (!bowlingTeam) {
      return res.status(404).json({ success: false, message: 'Bowling team not found' });
    }

    // A player with bowlingStyle 'None' has declared they don't bowl at all - never worth
    // recommending regardless of what a data-sparse matchup read says, so this filter runs
    // before the matchup ranking rather than trying to have the ranking itself learn to
    // avoid them. Falls back to the full (minus last-bowler) roster only if literally
    // nobody on the team bowls, since *someone* still has to.
    const eligible = bowlingTeam.players.filter(
      (p) => (!lastBowler || p._id.toString() !== lastBowler.id) && p.bowlingStyle !== 'None'
    );
    const candidates = eligible.length > 0
      ? eligible
      : bowlingTeam.players.filter((p) => !lastBowler || p._id.toString() !== lastBowler.id);

    const poolStats = await getBowlerLineLengthEffectiveness(null);

    const evaluated = await Promise.all(candidates.map(async (player) => {
      const [ownStats, matchup] = await Promise.all([
        getBowlerLineLengthEffectiveness(player._id),
        getLiveMatchupPlan(req.params.id, striker.id, player._id.toString())
      ]);

      const hasEconomyData = ownStats.totalBalls >= MIN_BALLS_FOR_OWN_DATA;
      let blendedEconomy = null;
      if (hasEconomyData) {
        const blended = blendWithPrior(ownStats.economy, ownStats.totalBalls, poolStats.economy ?? ownStats.economy, poolStats.totalBalls);
        blendedEconomy = blended.value !== null ? Math.round(blended.value * 100) / 100 : null;
      }

      const actionableBuckets = (matchup?.buckets || []).filter((b) => b.todayAdjustedRate !== null);
      const bestBucket = actionableBuckets.length > 0
        ? actionableBuckets.reduce((best, b) => (b.todayAdjustedRate > best.todayAdjustedRate ? b : best))
        : null;

      return {
        playerId: player._id,
        name: player.user?.name ?? 'Unknown',
        specialization: player.specialization,
        bowlingStyle: player.bowlingStyle,
        hasMatchupData: !!bestBucket,
        dismissalRateVsStriker: bestBucket ? bestBucket.blendedDismissalRate : null,
        confidence: bestBucket ? bestBucket.confidence : null,
        hasEconomyData,
        economy: hasEconomyData ? ownStats.economy : null,
        blendedEconomy,
      };
    }));

    // Tiered ranking (not a single opaque composite score): candidates with an actual
    // matchup read on this striker come first, ranked by confidence first and dismissal
    // rate second - with only a handful of tagged balls anywhere in the database (typical
    // for a fresh club instance), a 100% rate from one ball is weaker evidence than a lower
    // rate backed by real sample size, and confidence already encodes that. Then candidates
    // with just a track-record economy figure; everyone else falls back to a generic
    // specialization-based order.
    const confidenceRank = { high: 0, medium: 1, low: 2, 'very-low': 3 };
    const specializationRank = { Bowler: 0, 'All-rounder': 1, 'Wicket-keeper': 2, Batsman: 3 };
    evaluated.sort((a, b) => {
      if (a.hasMatchupData !== b.hasMatchupData) return a.hasMatchupData ? -1 : 1;
      if (a.hasMatchupData) {
        const confDiff = (confidenceRank[a.confidence] ?? 9) - (confidenceRank[b.confidence] ?? 9);
        if (confDiff !== 0) return confDiff;
        return b.dismissalRateVsStriker - a.dismissalRateVsStriker;
      }
      if (a.hasEconomyData !== b.hasEconomyData) return a.hasEconomyData ? -1 : 1;
      if (a.hasEconomyData) return a.blendedEconomy - b.blendedEconomy;
      return (specializationRank[a.specialization] ?? 4) - (specializationRank[b.specialization] ?? 4);
    });

    const top = evaluated[0];
    let reason;
    if (!top) {
      reason = 'No eligible bowler found.';
    } else if (top.hasMatchupData) {
      const confidenceNote = top.confidence === 'low' || top.confidence === 'very-low'
        ? ' (based on very little tagged data so far - treat as a starting point, not a strong signal)'
        : '';
      reason = `${top.name} has the strongest read against ${striker.name} - an estimated ${top.dismissalRateVsStriker}% dismissal rate in their most effective line/length, blending historical data with what's happened in this match so far${confidenceNote}.`;
    } else if (top.hasEconomyData) {
      reason = `No tagged matchup data against ${striker.name} yet, so this falls back to overall economy - ${top.name} has conceded ${top.economy} runs/over across tracked deliveries.`;
    } else {
      reason = `No tracked data for anyone in this attack yet - ${top.name} is suggested by role (${top.specialization}). Assess by eye early in the spell.`;
    }

    res.status(200).json({
      success: true,
      striker: { id: striker.id, name: striker.name },
      recommendation: top ? { playerId: top.playerId, name: top.name, reason } : null,
      candidates: evaluated
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete match
// @route   DELETE /api/matches/:id
// @access  Private
exports.deleteMatch = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    if (match.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this match'
      });
    }

    await Match.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Match deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Appoint an umpire for a match - grants them the same scoring/status-management
//          rights as the match creator (see canManageMatch above), without giving them the
//          ability to appoint further umpires or delete the match.
// @route   POST /api/matches/:id/umpires
// @access  Private (match creator only)
exports.addUmpire = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Please provide a userId' });
    }

    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }
    if (match.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the match creator can appoint umpires' });
    }
    if (match.createdBy.toString() === userId) {
      return res.status(400).json({ success: false, message: 'The match creator already has full scoring access' });
    }
    if ((match.umpires || []).some((u) => u.toString() === userId)) {
      return res.status(400).json({ success: false, message: 'This person is already an umpire for this match' });
    }

    match.umpires.push(userId);
    await match.save();
    await match.populate({ path: 'umpires', select: 'name' });

    res.status(200).json({ success: true, umpires: match.umpires });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Remove an umpire from a match
// @route   DELETE /api/matches/:id/umpires/:userId
// @access  Private (match creator only)
exports.removeUmpire = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }
    if (match.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the match creator can remove umpires' });
    }

    match.umpires = (match.umpires || []).filter((u) => u.toString() !== req.params.userId);
    await match.save();
    await match.populate({ path: 'umpires', select: 'name' });

    res.status(200).json({ success: true, umpires: match.umpires });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Upload a match-specific reference document (team sheet, dispute report, ...) -
//          same category/upload pattern as Tournament.documents, distinct from it since a
//          document here is scoped to just this match.
// @route   POST /api/matches/:id/documents
// @access  Private (anyone canManageMatch permits - organizer, an appointed umpire, or a
//          rostered player on either team)
exports.addMatchDocument = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }
    if (!(await canManageMatch(match, req.user.id))) {
      return res.status(403).json({ success: false, message: 'Not authorized to upload a document for this match' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    match.documents.push({
      url: `/uploads/tournament-documents/${req.file.filename}`,
      fileName: req.file.originalname,
      category: (req.body.category || 'General').toString().trim().slice(0, 100) || 'General',
      uploadedAt: new Date()
    });
    await match.save();

    res.status(200).json({ success: true, documents: match.documents });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Remove a match document
// @route   DELETE /api/matches/:id/documents/:documentId
// @access  Private (anyone canManageMatch permits)
exports.removeMatchDocument = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }
    if (!(await canManageMatch(match, req.user.id))) {
      return res.status(403).json({ success: false, message: 'Not authorized to remove this document' });
    }

    const { documentId } = req.params;
    const exists = match.documents.some((doc) => doc._id.toString() === documentId);
    if (!exists) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    match.documents = match.documents.filter((doc) => doc._id.toString() !== documentId);
    await match.save();

    res.status(200).json({ success: true, documents: match.documents });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Upload a match photo for the Gallery tab - same upload pattern as addMatchDocument
//          above, distinct field since a photo is browsed for its own sake, not categorized.
// @route   POST /api/matches/:id/photos
// @access  Private (anyone canManageMatch permits - organizer, an appointed umpire, or a
//          rostered player on either team)
exports.addMatchPhoto = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }
    if (!(await canManageMatch(match, req.user.id))) {
      return res.status(403).json({ success: false, message: 'Not authorized to upload a photo for this match' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    match.photos.push({
      url: `/uploads/match-photos/${req.file.filename}`,
      caption: (req.body.caption || '').toString().trim().slice(0, 200),
      uploadedBy: req.user.id,
      uploadedAt: new Date()
    });
    await match.save();

    res.status(200).json({ success: true, photos: match.photos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Remove a match photo. Unlike removeMatchDocument (which leaves the underlying file
//          on disk - an existing, harmless-at-pilot-scale gap in this codebase), this also
//          best-effort unlinks the file: photos are deleted far more casually than reference
//          documents, so letting orphans accumulate here is a real disk-hygiene concern rather
//          than a theoretical one.
// @route   DELETE /api/matches/:id/photos/:photoId
// @access  Private (anyone canManageMatch permits)
exports.removeMatchPhoto = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }
    if (!(await canManageMatch(match, req.user.id))) {
      return res.status(403).json({ success: false, message: 'Not authorized to remove this photo' });
    }

    const { photoId } = req.params;
    const photo = match.photos.find((p) => p._id.toString() === photoId);
    if (!photo) {
      return res.status(404).json({ success: false, message: 'Photo not found' });
    }
    match.photos = match.photos.filter((p) => p._id.toString() !== photoId);
    await match.save();

    // Fire-and-forget: a missing file (already cleaned up, or predates this field) shouldn't
    // fail the API response - same swallow-errors approach groupMessageController.js uses.
    fs.unlink(path.join(MATCH_PHOTO_DIR, path.basename(photo.url)), () => {});

    res.status(200).json({ success: true, photos: match.photos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Claim (or renew) the exclusive right to score this match. The score page calls
//          this before showing the scoring UI and again periodically as a heartbeat while
//          it stays open - see LOCK_TIMEOUT_MS for how long a lock survives without renewal.
// @route   POST /api/matches/:id/scoring-lock
// @access  Private (anyone canManageMatch already permits)
exports.acquireScoringLock = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }
    if (!(await canManageMatch(match, req.user.id))) {
      return res.status(403).json({ success: false, message: 'Not authorized to score this match' });
    }

    const heldByOther = isLockFresh(match.activeScorer) && match.activeScorer.user.toString() !== req.user.id;
    if (heldByOther) {
      return res.status(409).json({
        success: false,
        message: `${match.activeScorer.name} is currently scoring this match`,
        activeScorer: { name: match.activeScorer.name, lastActiveAt: match.activeScorer.lastActiveAt }
      });
    }

    const user = await User.findById(req.user.id).select('name');
    match.activeScorer = { user: req.user.id, name: user?.name ?? 'Someone', lastActiveAt: new Date() };
    await match.save();

    res.status(200).json({ success: true, activeScorer: match.activeScorer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Release the scoring lock - called when a scorer explicitly finishes or navigates
//          away. Anyone who could acquire it can release it (current holder or the match
//          creator, as an escape hatch if a lock is stuck and nobody wants to wait out the
//          timeout), but nobody else.
// @route   DELETE /api/matches/:id/scoring-lock
// @access  Private
exports.releaseScoringLock = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }

    const isHolder = match.activeScorer && match.activeScorer.user.toString() === req.user.id;
    const isCreator = match.createdBy.toString() === req.user.id;
    if (match.activeScorer && !isHolder && !isCreator) {
      return res.status(403).json({ success: false, message: 'Only the current scorer or the match creator can release this lock' });
    }

    match.activeScorer = null;
    await match.save();

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

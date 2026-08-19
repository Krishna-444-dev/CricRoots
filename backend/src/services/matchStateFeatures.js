// The ONE definition of the win-probability model's input features.
//
// Why this file exists. The features were previously constructed in two places by two different
// conventions, and the mismatch shipped:
//
//   training  (extractWinProbabilityData.js)  current_run_rate = runs / (legalBalls / 6)
//   serving   (matchController.js x3)         current_run_rate = runs / innings.overs
//
// `innings.overs` is CRICKET NOTATION - matchController.js:470 stores 3 overs and 4 balls as
// `3.4`, not 3.667 - so it is not a valid divisor for a run rate. The extraction script said so
// explicitly in a comment and used the correct form; the serving sites used the wrong one anyway.
// Measured effect before the fix (ai-engine/results/pre-remediation/): 83.5% of served states are
// mid-over, where the two conventions disagree, and the deployed model's prediction moved by a
// mean of 0.126 in absolute probability.
//
// A comment did not prevent that. matchStateFeatures.test.js asserts it instead: every consumer -
// including the extraction script that generates the training data - imports from here, and the
// parity test proves the training path and the serving path produce bit-identical vectors.
//
// DOMAIN. The model is trained exclusively on second-innings (chase) states. Everything here
// returns null rather than a plausible-looking number when the match is not in a chase, so a
// caller cannot accidentally ask a chase model a first-innings question.

const NON_LEGAL_EXTRAS = ['wide', 'no-ball'];

// Fallback only - match.totalOvers is authoritative and set per match (see Match.js).
const OVERS_BY_MATCH_TYPE = { T20: 20, ODI: 50, Friendly: 20 };

function isLegalBall(ball) {
  return !(ball.isExtra && NON_LEGAL_EXTRAS.includes(ball.extraType));
}

/** True decimal overs. NOT the DB's `innings.overs` field, which is cricket notation. */
function toDecimalOvers(legalBalls) {
  return legalBalls / 6;
}

function resolveTotalOvers(match) {
  return match.totalOvers || OVERS_BY_MATCH_TYPE[match.matchType] || 20;
}

/**
 * The pure feature transformation. Every path that produces model input goes through this.
 *
 * @param {number} legalBalls - legal deliveries bowled in the chase so far
 * @param {number} runs       - chase runs so far
 * @param {number} wickets    - chase wickets lost so far
 * @param {number} target     - runs needed to WIN, i.e. first-innings runs + 1
 * @param {number} totalOvers - the match's overs-per-side allocation
 */
function chaseFeatures({ legalBalls, runs, wickets, target, totalOvers }) {
  const oversUsed = toDecimalOvers(legalBalls);
  return {
    oversRemaining: Math.max(0, totalOvers - oversUsed),
    wicketsDown: wickets,
    currentRunRate: oversUsed > 0 ? runs / oversUsed : 0,
    targetScore: target
  };
}

/**
 * Is this match in a chase right now? A chase exists once the second innings has a ball in it.
 *
 * innings[1] is always team2's innings under this codebase's fixed team1/team2 <-> innings[0]/[1]
 * convention, and the second innings is always the chase. Test matches have no single limited-overs
 * chase and are excluded.
 */
function isInChase(match) {
  if (!match || match.matchType === 'Test') return false;
  return (match.innings?.[1]?.balls?.length || 0) > 0;
}

/**
 * Current chase state as model features, or null if the match is not in a chase.
 *
 * Returning null is the point (E2). Callers previously passed `targetScore: innings[0].runs`
 * during the FIRST innings, which handed the chase model the batting side's own live score as its
 * target - a state that cannot occur in a chase, producing a number with no interpretation.
 */
function currentChaseState(match) {
  if (!isInChase(match)) return null;

  const totalOvers = resolveTotalOvers(match);
  const target = (match.innings[0]?.runs || 0) + 1;
  const balls = match.innings[1].balls;

  let legalBalls = 0;
  let runs = 0;
  let wickets = 0;
  for (const ball of balls) {
    runs += ball.runs || 0;
    if (ball.isWicket) wickets += 1;
    if (isLegalBall(ball)) legalBalls += 1;
  }

  return chaseFeatures({ legalBalls, runs, wickets, target, totalOvers });
}

/**
 * Replays the chase, emitting feature vectors at checkpoints.
 *
 * @param {'every-ball'|'over-boundary'} at - 'over-boundary' reproduces the training extraction
 *   exactly (one row per completed over, excluding the innings' final boundary); 'every-ball' is
 *   what key-moments needs, plus a leading state before any ball has been bowled.
 * @returns {Array<{legalBalls, runs, wickets, features}>}
 */
function replayChaseStates(match, { at = 'every-ball' } = {}) {
  if (!isInChase(match)) return [];

  const totalOvers = resolveTotalOvers(match);
  const maxLegalBalls = totalOvers * 6;
  const target = (match.innings[0]?.runs || 0) + 1;
  const balls = match.innings[1].balls;

  const out = [];
  let legalBalls = 0;
  let runs = 0;
  let wickets = 0;
  let lastBoundaryEmittedAt = null;

  if (at === 'every-ball') {
    out.push({
      legalBalls: 0,
      runs: 0,
      wickets: 0,
      features: chaseFeatures({ legalBalls: 0, runs: 0, wickets: 0, target, totalOvers })
    });
  }

  for (const ball of balls) {
    runs += ball.runs || 0;
    if (ball.isWicket) wickets += 1;
    if (isLegalBall(ball)) legalBalls += 1;

    // `legalBalls % 6 === 0` stays true across any wides/no-balls bowled after an over's sixth
    // legal delivery, because those do not increment legalBalls. The original extraction had no
    // guard, so it re-emitted the same over boundary once per trailing extra with the runs
    // inflated each time - 792 duplicated rows across 414 of 577 matches in the committed
    // training file, found by matchStateFeatures.test.js's parity assertion.
    //
    // The correct checkpoint is the FIRST one: an over ends the instant its sixth legal ball is
    // bowled, so any following wide belongs to the next over, not this boundary.
    const atBoundary =
      legalBalls > 0 &&
      legalBalls % 6 === 0 &&
      legalBalls < maxLegalBalls &&
      legalBalls !== lastBoundaryEmittedAt;

    if (atBoundary) lastBoundaryEmittedAt = legalBalls;

    if (at === 'every-ball' || atBoundary) {
      out.push({
        legalBalls,
        runs,
        wickets,
        features: chaseFeatures({ legalBalls, runs, wickets, target, totalOvers })
      });
    }
  }

  return out;
}

module.exports = {
  NON_LEGAL_EXTRAS,
  OVERS_BY_MATCH_TYPE,
  isLegalBall,
  toDecimalOvers,
  resolveTotalOvers,
  chaseFeatures,
  isInChase,
  currentChaseState,
  replayChaseStates
};

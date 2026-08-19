// The exact ball-generating process of backend/src/scripts/matchSimulator.js, transcribed once so
// every diagnostic and the RO1a oracle share one definition of "the world" rather than each
// re-deriving it. Transcription, not reimplementation: each distribution below cites the line it
// came from, and simulatorProcess.test.js asserts the weights sum correctly and that the derived
// per-delivery run distribution matches an empirical draw from the same expressions.
//
// The single load-bearing property, established in documentation/ai-engine-audit.md and confirmed
// by reading simulateInnings in full: NOTHING here depends on batter, bowler, team, or match state.
// `striker` and `currentBowler` are read only to label the ball. That is what makes the exact DP in
// oracle.js possible.

// matchSimulator.js:52 - pickWeighted({ normal: 88, wide: 5, 'no-ball': 2, bye: 3, 'leg-bye': 2 })
const BALL_TYPE = { normal: 88, wide: 5, 'no-ball': 2, bye: 3, 'leg-bye': 2 };

// matchSimulator.js:107 - 1 + (rand < 0.12 ? ceil(rand*4) : 0); ceil(U*4) is uniform on {1,2,3,4}
const WIDE_RUNS = { 1: 0.88, 2: 0.03, 3: 0.03, 4: 0.03, 5: 0.03 };

// matchSimulator.js:112 - 1 + (rand < 0.2 ? (rand < 0.3 ? 4 : ceil(rand*2)) : 0)
//   0.8         -> 1
//   0.2 * 0.3   -> 5
//   0.2 * 0.7/2 -> 2 and 3
const NO_BALL_RUNS = { 1: 0.8, 2: 0.07, 3: 0.07, 5: 0.06 };

// matchSimulator.js:117 - pickWeighted({ 1: 70, 2: 20, 4: 10 })
const BYE_RUNS = { 1: 0.7, 2: 0.2, 4: 0.1 };

// matchSimulator.js:121 - Math.random() < 0.045
const WICKET_P = 0.045;

// matchSimulator.js:131 - pickWeighted({ 0: 38, 1: 32, 2: 9, 3: 2, 4: 13, 6: 6 })
const NORMAL_RUNS = { 0: 0.38, 1: 0.32, 2: 0.09, 3: 0.02, 4: 0.13, 6: 0.06 };

const TOTAL_BALL_TYPE_WEIGHT = Object.values(BALL_TYPE).reduce((a, b) => a + b, 0);

/**
 * The per-delivery outcome distribution, flattened into a single list of
 * `{ p, runs, isWicket, isLegal }` entries summing to probability 1.
 *
 * This is the complete transition kernel of a chase in this world. Both the skew diagnostic and
 * the oracle DP consume exactly this, so neither can drift from the other.
 */
function deliveryOutcomes() {
  const out = [];
  const w = (k) => BALL_TYPE[k] / TOTAL_BALL_TYPE_WEIGHT;

  for (const [runs, p] of Object.entries(WIDE_RUNS)) {
    out.push({ p: w('wide') * p, runs: Number(runs), isWicket: false, isLegal: false });
  }
  for (const [runs, p] of Object.entries(NO_BALL_RUNS)) {
    out.push({ p: w('no-ball') * p, runs: Number(runs), isWicket: false, isLegal: false });
  }
  // bye and leg-bye share a run distribution and both consume a legal ball
  const byeWeight = w('bye') + w('leg-bye');
  for (const [runs, p] of Object.entries(BYE_RUNS)) {
    out.push({ p: byeWeight * p, runs: Number(runs), isWicket: false, isLegal: true });
  }
  out.push({ p: w('normal') * WICKET_P, runs: 0, isWicket: true, isLegal: true });
  for (const [runs, p] of Object.entries(NORMAL_RUNS)) {
    out.push({ p: w('normal') * (1 - WICKET_P) * p, runs: Number(runs), isWicket: false, isLegal: true });
  }
  return out;
}

// Deterministic RNG so diagnostics reproduce byte-identically. The production simulator uses an
// unseeded Math.random; only the seeding differs, the distribution is the one transcribed above.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawOutcome(rand, outcomes) {
  let r = rand();
  for (const o of outcomes) {
    r -= o.p;
    if (r <= 0) return o;
  }
  return outcomes[outcomes.length - 1];
}

/**
 * Replays one chase, capturing the state after EVERY delivery - including mid-over states, which
 * is the whole point. `extractWinProbabilityData.js` emits rows only at completed overs, where
 * cricket notation and true decimal overs agree exactly, so the training data cannot exhibit the
 * skew at all. The live socket push (matchController.js:491) fires after every ball, so most
 * SERVED states are mid-over. That asymmetry is what this diagnostic measures.
 */
function replayChase({ target, totalOvers = 20, rand }) {
  const outcomes = deliveryOutcomes();
  const maxLegalBalls = totalOvers * 6;
  const states = [];
  let runs = 0;
  let wickets = 0;
  let legalBalls = 0;

  while (legalBalls < maxLegalBalls && wickets < 10) {
    const o = drawOutcome(rand, outcomes);
    runs += o.runs;
    if (o.isWicket) wickets += 1;
    if (o.isLegal) legalBalls += 1;

    states.push({ legalBalls, runs, wickets, target, totalOvers });

    if (runs >= target) break;
  }
  return { states, runs, wickets, legalBalls, won: runs >= target };
}

module.exports = {
  BALL_TYPE,
  WIDE_RUNS,
  NO_BALL_RUNS,
  BYE_RUNS,
  NORMAL_RUNS,
  WICKET_P,
  deliveryOutcomes,
  mulberry32,
  replayChase
};

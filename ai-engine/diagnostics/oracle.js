// RO1a - the exact win probability under the simulator's own generative process.
//
// This is an ORACLE in the sense research/protocol.md uses: it reads the ground truth of the world
// the data came from. It is a diagnostic upper bound, never deployable, and it says nothing about
// cricket - only about matchSimulator.js.
//
// WHY AN EXACT DP IS POSSIBLE. matchSimulator.js draws every delivery from fixed distributions
// independent of batter, bowler, team and match state (see simulatorProcess.js, and
// documentation/ai-engine-audit.md Fact 2). A chase is therefore a first-passage problem: i.i.d.
// draws accumulating runs against an absorbing wicket counter and a ball budget. There is no
// hidden state, so P(win | balls remaining, wickets down, runs needed) is computable in closed
// form rather than estimated.
//
// WHY THAT MATTERS FOR THE RESEARCH QUESTION. If the exact predictor is a function of exactly the
// four features already in use, then a well-specified baseline is approximately Bayes-optimal on
// this data, "can ML beat it" has a predictable negative answer, and a positive answer would
// indicate overfitting rather than skill. Measuring the deployed model against this oracle is a
// VALIDITY CHECK on the estimator, not a claim that any method works.
//
// RECURRENCE. With b legal balls remaining, w wickets down, r runs still needed:
//
//   V(b, w, r) = 0            if w >= 10 or b <= 0   (with r > 0)
//   V(b, w, r) = 1            if r <= 0
//   V(b, w, r) = SUM_o p_o * V(b - [o legal], w + [o wicket], r - runs_o)
//
// Non-legal deliveries (wides, no-balls) do not decrement b, which would be an infinite loop
// except that both always concede at least one run, so r strictly decreases. Iterating b ascending
// and r ascending is therefore well-founded and needs no fixed-point solve.

const { deliveryOutcomes } = require('./simulatorProcess');

/**
 * Builds the full value table.
 *
 * @param {number} maxBalls - legal balls in an innings (120 for a T20)
 * @param {number} maxRuns  - largest runs-needed value to tabulate
 * @returns {(b: number, w: number, r: number) => number} lookup into the table
 */
function buildOracle({ maxBalls = 120, maxRuns = 300 } = {}) {
  const outcomes = deliveryOutcomes();
  const W = 11; // wickets down, 0..10
  const R = maxRuns + 1;

  // V[b][w][r]
  const V = new Array(maxBalls + 1);
  for (let b = 0; b <= maxBalls; b++) {
    V[b] = new Array(W);
    for (let w = 0; w < W; w++) V[b][w] = new Float64Array(R);
  }

  for (let b = 0; b <= maxBalls; b++) {
    for (let w = 0; w < W; w++) {
      for (let r = 0; r < R; r++) {
        if (r <= 0) {
          V[b][w][r] = 1;
          continue;
        }
        if (b === 0 || w >= 10) {
          V[b][w][r] = 0;
          continue;
        }

        let acc = 0;
        for (const o of outcomes) {
          const nr = Math.max(0, r - o.runs);
          const nb = o.isLegal ? b - 1 : b;
          const nw = o.isWicket ? w + 1 : w;

          if (nr <= 0) {
            acc += o.p; // reaching the target wins immediately, wicket or not
          } else if (nw >= 10 || nb === 0) {
            acc += 0;
          } else {
            // nb <= b always; when nb === b (an extra) nr < r strictly, so this entry is already
            // computed under the ascending-r loop.
            acc += o.p * V[nb][nw][nr];
          }
        }
        V[b][w][r] = acc;
      }
    }
  }

  return function oracle(b, w, r) {
    if (r <= 0) return 1;
    if (b <= 0 || w >= 10) return 0;
    const bb = Math.min(Math.max(0, Math.round(b)), maxBalls);
    const ww = Math.min(Math.max(0, Math.round(w)), 10);
    const rr = Math.min(Math.max(0, Math.round(r)), maxRuns);
    return V[bb][ww][rr];
  };
}

module.exports = { buildOracle };

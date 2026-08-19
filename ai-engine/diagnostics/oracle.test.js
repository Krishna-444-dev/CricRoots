// Validity gate 3 for the RO1a oracle: verify the implementation recovers the structure when it is
// unambiguously present, BEFORE using it to judge anything else. research/protocol.md records why -
// without this, a null result from the oracle comparison would be uninterpretable, because
// "estimator is poor" and "oracle is wrong" look identical.
//
// The check that matters is the last one: the DP is compared against a Monte Carlo replay driven by
// the SAME transition kernel. They must agree to within Monte Carlo error. Any disagreement means
// the recurrence is wrong, since both consume simulatorProcess.deliveryOutcomes().

const assert = require('assert');
const { buildOracle } = require('./oracle');
const { deliveryOutcomes, mulberry32, replayChase } = require('./simulatorProcess');

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log('oracle.test.js');

test('the transition kernel is a probability distribution', () => {
  const total = deliveryOutcomes().reduce((a, o) => a + o.p, 0);
  assert.ok(Math.abs(total - 1) < 1e-12, `outcomes sum to ${total}, not 1`);
});

const oracle = buildOracle({ maxBalls: 120, maxRuns: 300 });

test('boundary conditions', () => {
  assert.strictEqual(oracle(50, 3, 0), 1, 'target already reached is a certain win');
  assert.strictEqual(oracle(0, 3, 5), 0, 'no balls left and runs needed is a certain loss');
  assert.strictEqual(oracle(50, 10, 5), 0, 'all out is a certain loss');
});

test('monotone in each argument, in the right direction', () => {
  // more balls is never worse
  assert.ok(oracle(60, 4, 50) >= oracle(30, 4, 50));
  // more wickets down is never better
  assert.ok(oracle(60, 2, 50) >= oracle(60, 7, 50));
  // more runs needed is never better
  assert.ok(oracle(60, 4, 30) >= oracle(60, 4, 80));
});

test('one run needed off many balls with wickets in hand is near certain', () => {
  assert.ok(oracle(60, 1, 1) > 0.99, `got ${oracle(60, 1, 1)}`);
});

test('an impossible ask is near zero', () => {
  // 200 runs off 6 balls
  assert.ok(oracle(6, 0, 200) < 1e-6, `got ${oracle(6, 0, 200)}`);
});

test('DP agrees with Monte Carlo on the same kernel', () => {
  const cases = [
    { balls: 60, wickets: 2, needed: 55 },
    { balls: 30, wickets: 5, needed: 40 },
    { balls: 90, wickets: 1, needed: 100 },
    { balls: 12, wickets: 8, needed: 15 },
    { balls: 120, wickets: 0, needed: 165 }
  ];
  const N = 60000;
  const rand = mulberry32(424242);

  for (const c of cases) {
    let wins = 0;
    for (let i = 0; i < N; i++) {
      // replayChase counts up from an empty innings, so express the case as an equivalent fresh
      // chase: totalOvers covers `balls` legal deliveries, target is `needed`, and the wickets
      // already lost are applied by shortening the wicket budget.
      let runs = 0;
      let wkts = c.wickets;
      let legal = 0;
      const outcomes = deliveryOutcomes();
      while (legal < c.balls && wkts < 10) {
        let r = rand();
        let picked = outcomes[outcomes.length - 1];
        for (const o of outcomes) {
          r -= o.p;
          if (r <= 0) { picked = o; break; }
        }
        runs += picked.runs;
        if (picked.isWicket) wkts += 1;
        if (picked.isLegal) legal += 1;
        if (runs >= c.needed) break;
      }
      if (runs >= c.needed) wins += 1;
    }
    const mc = wins / N;
    const dp = oracle(c.balls, c.wickets, c.needed);
    const se = Math.sqrt(Math.max(mc * (1 - mc), 1e-9) / N);
    const tol = Math.max(4 * se, 0.004);
    assert.ok(
      Math.abs(dp - mc) <= tol,
      `balls=${c.balls} w=${c.wickets} need=${c.needed}: DP ${dp.toFixed(5)} vs MC ${mc.toFixed(5)} (tol ${tol.toFixed(5)})`
    );
  }
});

console.log(`\n${passed} passed`);

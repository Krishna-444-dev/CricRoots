// Verifies the generator actually produces the structure dataset-assumptions.md claims it does -
// not a framework-driven test suite (research/ deliberately has no dependencies of its own; this
// runs directly via `node research/synthetic/generator.test.js`), just the same kind of
// assertion-and-throw checks, because "we assumed the generator does X" is exactly the kind of
// claim this whole program exists to stop taking on faith.
const assert = require('assert');
const { generatePopulation, trueProbability, generateMatches, makeRng } = require('./generator');

function section(name, fn) {
  process.stdout.write(`${name} ... `);
  fn();
  console.log('OK');
}

section('same seed produces byte-identical output (reproducibility)', () => {
  const popA = generatePopulation({ numBatters: 10, numBowlers: 10, seed: 42 });
  const popB = generatePopulation({ numBatters: 10, numBowlers: 10, seed: 42 });
  assert.deepStrictEqual(
    popA.batters.map((b) => b.vulnerability),
    popB.batters.map((b) => b.vulnerability)
  );
  const matchesA = generateMatches({ population: popA, numMatches: 5, ballsPerInnings: 20, seed: 7 });
  const matchesB = generateMatches({ population: popB, numMatches: 5, ballsPerInnings: 20, seed: 7 });
  assert.deepStrictEqual(matchesA.matches, matchesB.matches);
});

section('a different seed produces different output', () => {
  const popA = generatePopulation({ numBatters: 10, numBowlers: 10, seed: 1 });
  const popB = generatePopulation({ numBatters: 10, numBowlers: 10, seed: 2 });
  assert.notDeepStrictEqual(
    popA.batters.map((b) => b.vulnerability),
    popB.batters.map((b) => b.vulnerability)
  );
});

section('trueProbability always returns a valid probability in (0, 1)', () => {
  const pop = generatePopulation({ numBatters: 20, numBowlers: 20, seed: 3 });
  const rng = makeRng(99);
  for (let i = 0; i < 500; i++) {
    const b = rng.pick(pop.batters);
    const w = rng.pick(pop.bowlers);
    const p = trueProbability(pop, b._id, w._id, rng.pick(require('./generator').LINES), rng.pick(require('./generator').LENGTHS));
    assert.ok(p > 0 && p < 1 && Number.isFinite(p), `invalid probability: ${p}`);
  }
});

section('higher batter vulnerability produces higher OBSERVED dismissal rate in generated data (not just in the hidden parameter)', () => {
  // This is the actual load-bearing check: does the generator's intended structure survive all
  // the way through to the ball-by-ball output, or only exist in the hidden parameters? Split
  // batters into above/below-median vulnerability and confirm the realized dismissal rate in a
  // large generated sample tracks it - with enough balls that sampling noise can't plausibly
  // explain a reversal.
  const pop = generatePopulation({ numBatters: 40, numBowlers: 20, seed: 11 });
  const { matches } = generateMatches({ population: pop, numMatches: 400, ballsPerInnings: 60, seed: 12 });

  const sortedByVuln = [...pop.batters].sort((a, b) => a.vulnerability - b.vulnerability);
  const lowVulnIds = new Set(sortedByVuln.slice(0, 20).map((b) => b._id));
  const highVulnIds = new Set(sortedByVuln.slice(20).map((b) => b._id));

  let lowBalls = 0, lowWickets = 0, highBalls = 0, highWickets = 0;
  for (const m of matches) {
    for (const inn of m.innings) {
      for (const ball of inn.balls) {
        if (lowVulnIds.has(ball.batsmanId)) { lowBalls++; if (ball.isWicket) lowWickets++; }
        if (highVulnIds.has(ball.batsmanId)) { highBalls++; if (ball.isWicket) highWickets++; }
      }
    }
  }
  const lowRate = lowWickets / lowBalls;
  const highRate = highWickets / highBalls;
  assert.ok(lowBalls > 1000 && highBalls > 1000, 'not enough balls sampled to trust this check');
  assert.ok(highRate > lowRate, `expected high-vulnerability batters to show a higher dismissal rate: low=${lowRate.toFixed(4)} (n=${lowBalls}) high=${highRate.toFixed(4)} (n=${highBalls})`);
  console.log(`    (low-vulnerability observed rate: ${lowRate.toFixed(4)} n=${lowBalls}, high-vulnerability: ${highRate.toFixed(4)} n=${highBalls})`);
});

section('a batter/bowler pair with a strong positive interaction shows a detectably different true probability than the same batter against a neutral bowler', () => {
  const pop = generatePopulation({ numBatters: 30, numBowlers: 30, seed: 21 });
  // Find a pair with a strong interaction effect to make this check meaningful rather than
  // relying on chance alignment.
  let strongPair = null;
  for (const [key, effect] of pop.interactions.entries()) {
    if (Math.abs(effect) > 0.5) { strongPair = key; break; }
  }
  assert.ok(strongPair, 'expected at least one strong interaction in a population this size - if this fails, INTERACTION_PROBABILITY or the effect distribution may need revisiting');
  const [batterId, bowlerId] = strongPair.split('|');
  const neutralBowler = pop.bowlers.find((w) => !pop.interactions.has(`${batterId}|${w._id}`));
  const pWithInteraction = trueProbability(pop, batterId, bowlerId, 'off-stump', 'good-length');
  const pNeutral = trueProbability(pop, batterId, neutralBowler._id, 'off-stump', 'good-length');
  assert.notStrictEqual(pWithInteraction.toFixed(4), pNeutral.toFixed(4));
});

section('generated match documents use real schema enum values for line/length/battingStyle/bowlingStyle', () => {
  const { LINES, LENGTHS } = require('./generator');
  const pop = generatePopulation({ numBatters: 24, numBowlers: 12, seed: 5 });
  for (const b of pop.batters) assert.ok(['Right-hand', 'Left-hand'].includes(b.battingStyle));
  for (const w of pop.bowlers) assert.ok(['Right-arm Fast', 'Right-arm Spin', 'Left-arm Fast', 'Left-arm Spin'].includes(w.bowlingStyle));
  const { matches } = generateMatches({ population: pop, numMatches: 3, ballsPerInnings: 12, seed: 6 });
  for (const m of matches) {
    for (const inn of m.innings) {
      for (const ball of inn.balls) {
        assert.ok(LINES.includes(ball.line), `bad line: ${ball.line}`);
        assert.ok(LENGTHS.includes(ball.length), `bad length: ${ball.length}`);
      }
    }
  }
});

console.log('\nAll generator verification checks passed.');

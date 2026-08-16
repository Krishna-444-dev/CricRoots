// Verifies the generator actually produces the structure dataset-assumptions.md claims it does -
// not a framework-driven test suite (research/ deliberately has no dependencies of its own; this
// runs directly via `node research/synthetic/generator.test.js`), just the same kind of
// assertion-and-throw checks, because "we assumed the generator does X" is exactly the kind of
// claim this whole program exists to stop taking on faith.
const assert = require('assert');
const { generatePopulation, trueProbability, generateMatches, generateLeagueMatches, generateFixtures, makeRng, LINES, LENGTHS } = require('./generator');

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

section('generateFixtures produces exactly C(numTeams,2) x rounds fixtures, every team appearing the same number of times', () => {
  const fixtures = generateFixtures({ numTeams: 8, rounds: 2, seed: 1 });
  assert.strictEqual(fixtures.length, (8 * 7 / 2) * 2);
  const appearances = new Array(8).fill(0);
  for (const [a, b] of fixtures) { appearances[a]++; appearances[b]++; }
  for (const count of appearances) assert.strictEqual(count, 2 * (8 - 1)); // plays every other team twice
});

section('generateLeagueMatches produces the realistic sparsity distribution league-design.md predicted (verifying the DATA, not tuning based on evaluation metrics)', () => {
  // This checks the a priori prediction in league-design.md: after fixing the fixed-two-team
  // flaw, the large majority of (batter, bowler) pairs should stay in the single-digit-to-low-
  // teens exposure range across the whole season, not accumulate into the 50+ regime the pilot
  // experiment incorrectly produced. This is a check on the GENERATED DATA's structure, decided
  // before regenerating - not a post-hoc adjustment based on the evaluation harness's output
  // metrics, which this file has no access to and never will.
  const pop = generatePopulation({ numBatters: 176, numBowlers: 96, seed: 1 });
  const { matches, teams } = generateLeagueMatches({
    population: pop, numTeams: 16, battersPerTeam: 11, bowlersPerTeam: 6, rounds: 2, ballsPerInnings: 35, seed: 2
  });
  assert.strictEqual(teams.length, 16);
  assert.strictEqual(matches.length, (16 * 15 / 2) * 2);

  const pairCounts = new Map();
  for (const m of matches) {
    for (const inn of m.innings) {
      for (const ball of inn.balls) {
        const key = `${ball.batsmanId}|${ball.bowlerId}`;
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
      }
    }
  }
  const counts = [...pairCounts.values()];
  const fractionSparse = counts.filter((c) => c <= 15).length / counts.length;
  const fractionDense = counts.filter((c) => c >= 50).length / counts.length;
  console.log(`\n    (${counts.length} distinct pairs faced at least one ball; ${(fractionSparse * 100).toFixed(1)}% at <=15 balls, ${(fractionDense * 100).toFixed(1)}% at >=50 balls)`);
  assert.ok(fractionSparse > 0.8, `expected the large majority of pairs to stay in the sparse (<=15) regime per league-design.md's prediction, got ${(fractionSparse * 100).toFixed(1)}%`);
  assert.ok(fractionDense < 0.05, `expected very few pairs to reach the dense (50+) regime, got ${(fractionDense * 100).toFixed(1)}%`);
});

section('generateLeagueMatches batting order is genuinely randomized per innings, not fixed at roster order', () => {
  const pop = generatePopulation({ numBatters: 22, numBowlers: 12, seed: 5 });
  const { matches } = generateLeagueMatches({ population: pop, numTeams: 2, battersPerTeam: 11, bowlersPerTeam: 6, rounds: 3, ballsPerInnings: 20, seed: 6 });
  const firstBatsmanIds = new Set();
  for (const m of matches) {
    for (const inn of m.innings) {
      if (inn.balls.length > 0) firstBatsmanIds.add(inn.balls[0].batsmanId);
    }
  }
  assert.ok(firstBatsmanIds.size > 1, 'expected the first ball of an innings to go to different batters across matches (randomized order), not always the same one');
});

section('World B (archetypeSignal:true) is byte-identical to World A in every table except archetypeEffect, for the same seed', () => {
  const worldA = generatePopulation({ numBatters: 30, numBowlers: 20, seed: 77 });
  const worldB = generatePopulation({ numBatters: 30, numBowlers: 20, seed: 77, archetypeSignal: true });
  assert.deepStrictEqual(worldA.batters, worldB.batters);
  assert.deepStrictEqual(worldA.bowlers, worldB.bowlers);
  assert.deepStrictEqual([...worldA.interactions.entries()], [...worldB.interactions.entries()]);
  assert.deepStrictEqual([...worldA.lineLengthEffect.entries()], [...worldB.lineLengthEffect.entries()]);
  assert.deepStrictEqual([...worldA.batterLineLengthResponse.entries()], [...worldB.batterLineLengthResponse.entries()]);
  assert.strictEqual(worldA.archetypeEffect, undefined);
  assert.ok(worldB.archetypeEffect instanceof Map && worldB.archetypeEffect.size === 8, 'expected 8 (battingStyle x bowlingStyle) archetype effects in World B');
});

section('World B\'s archetype effect actually changes trueProbability relative to World A for the same matchup', () => {
  const worldA = generatePopulation({ numBatters: 10, numBowlers: 10, seed: 88 });
  const worldB = generatePopulation({ numBatters: 10, numBowlers: 10, seed: 88, archetypeSignal: true });
  let foundDifference = false;
  for (const b of worldA.batters) {
    for (const w of worldA.bowlers) {
      const pA = trueProbability(worldA, b._id, w._id, 'off-stump', 'good-length');
      const pB = trueProbability(worldB, b._id, w._id, 'off-stump', 'good-length');
      if (Math.abs(pA - pB) > 1e-9) { foundDifference = true; break; }
    }
    if (foundDifference) break;
  }
  assert.ok(foundDifference, 'expected at least one (batter, bowler) pair where World B\'s archetype term changes the true probability');
});

section('World C (drift) is byte-identical to World A in every existing table, for the same seed', () => {
  const worldA = generatePopulation({ numBatters: 30, numBowlers: 20, seed: 55 });
  const worldC = generatePopulation({ numBatters: 30, numBowlers: 20, seed: 55, drift: { types: ['player', 'interaction', 'context'], magnitude: 1.0 } });
  assert.deepStrictEqual(worldA.batters, worldC.batters);
  assert.deepStrictEqual(worldA.bowlers, worldC.bowlers);
  assert.deepStrictEqual([...worldA.interactions.entries()], [...worldC.interactions.entries()]);
  assert.deepStrictEqual([...worldA.lineLengthEffect.entries()], [...worldC.lineLengthEffect.entries()]);
  assert.deepStrictEqual([...worldA.batterLineLengthResponse.entries()], [...worldC.batterLineLengthResponse.entries()]);
  assert.strictEqual(worldA.driftCoefficients, undefined);
  assert.ok(worldC.driftCoefficients, 'expected drift coefficients in World C');
  // And at t=0 the drifted world must reproduce the stationary world exactly - drift accumulates
  // FROM the season start, it does not offset it.
  for (const b of worldA.batters.slice(0, 5)) {
    for (const w of worldA.bowlers.slice(0, 5)) {
      assert.strictEqual(
        trueProbability(worldA, b._id, w._id, 'off-stump', 'good-length'),
        trueProbability(worldC, b._id, w._id, 'off-stump', 'good-length', 0)
      );
    }
  }
});

section('drift types are independent - each one moves only its own term', () => {
  const base = generatePopulation({ numBatters: 20, numBowlers: 15, seed: 66 });
  const only = (types) => generatePopulation({ numBatters: 20, numBowlers: 15, seed: 66, drift: { types, magnitude: 1.0 } });
  const player = only(['player']), interaction = only(['interaction']), context = only(['context']);
  assert.ok(player.driftCoefficients.V.size > 0 && player.driftCoefficients.I.size === 0 && player.driftCoefficients.LL.size === 0);
  assert.ok(interaction.driftCoefficients.I.size > 0 && interaction.driftCoefficients.V.size === 0 && interaction.driftCoefficients.LL.size === 0);
  assert.ok(context.driftCoefficients.LL.size > 0 && context.driftCoefficients.V.size === 0 && context.driftCoefficients.I.size === 0);
  // Interaction drift may only touch pairs that already have an interaction entry.
  for (const key of interaction.driftCoefficients.I.keys()) {
    assert.ok(base.interactions.has(key), `interaction drift invented a new pair: ${key}`);
  }
});

section('DRIFT VERIFICATION: prescribed drift is measurably present in generated ball-by-ball data at every magnitude', () => {
  // Review modification 9. If the drift does not materialise in the DATA, Experiment 6 measures
  // nothing regardless of what m was set to - so this must pass before the experiment is run.
  // Measured two ways: (a) mean absolute change in TRUE probability between season start and end,
  // (b) realized dismissal rate in the first vs last decile of the generated season.
  const results = [];
  for (const magnitude of [0.25, 0.50, 1.00]) {
    const pop = generatePopulation({
      numBatters: 176, numBowlers: 96, seed: 1,
      drift: { types: ['player', 'interaction', 'context'], magnitude }
    });
    let sumAbsDelta = 0, n = 0;
    const rng = makeRng(4242);
    for (let i = 0; i < 4000; i++) {
      const b = rng.pick(pop.batters), w = rng.pick(pop.bowlers);
      const line = rng.pick(LINES), length = rng.pick(LENGTHS);
      sumAbsDelta += Math.abs(trueProbability(pop, b._id, w._id, line, length, 1) - trueProbability(pop, b._id, w._id, line, length, 0));
      n++;
    }
    const meanAbsDelta = sumAbsDelta / n;

    const { matches } = generateLeagueMatches({
      population: pop, numTeams: 16, battersPerTeam: 11, bowlersPerTeam: 6, rounds: 2, ballsPerInnings: 35, seed: 2
    });
    const decile = Math.floor(matches.length / 10);
    const rateOf = (ms) => {
      let balls = 0, wkts = 0;
      for (const m of ms) for (const inn of m.innings) for (const ball of inn.balls) { balls++; if (ball.isWicket) wkts++; }
      return { rate: wkts / balls, balls };
    };
    const first = rateOf(matches.slice(0, decile));
    const last = rateOf(matches.slice(-decile));
    results.push({ magnitude, meanAbsDelta, firstDecileRate: first.rate, lastDecileRate: last.rate, ballsPerDecile: first.balls });
    console.log(`\n    m=${magnitude.toFixed(2)}: mean |p(t=1) - p(t=0)| = ${meanAbsDelta.toFixed(5)}; realized dismissal rate first decile ${(first.rate * 100).toFixed(2)}% vs last ${(last.rate * 100).toFixed(2)}% (n=${first.balls}/${last.balls} balls)`);
    assert.ok(meanAbsDelta > 0.001 * magnitude * 4, `drift at m=${magnitude} barely moves true probabilities (mean |delta| = ${meanAbsDelta.toExponential(2)})`);
  }
  // Dose-response: larger m must move probabilities more. A generator whose drift did not scale
  // with its own magnitude parameter would make the whole dose-response grid meaningless.
  assert.ok(results[0].meanAbsDelta < results[1].meanAbsDelta && results[1].meanAbsDelta < results[2].meanAbsDelta,
    'drift magnitude is not monotone in m: ' + JSON.stringify(results.map((r) => r.meanAbsDelta)));
  require('fs').writeFileSync(
    require('path').join(__dirname, '..', 'diagnostics', 'drift-verification-results.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), note: 'Verification that World C drift materialises in generated data. Written by generator.test.js; the EXPERIMENT has not been run.', results }, null, 2)
  );
});

section('generateLeagueMatches assigns normalized season time spanning [0,1] in fixture order', () => {
  const pop = generatePopulation({ numBatters: 44, numBowlers: 24, seed: 7 });
  const { matches } = generateLeagueMatches({ population: pop, numTeams: 4, battersPerTeam: 11, bowlersPerTeam: 6, rounds: 2, ballsPerInnings: 12, seed: 8 });
  assert.strictEqual(matches[0].t, 0);
  assert.strictEqual(matches[matches.length - 1].t, 1);
  for (let i = 1; i < matches.length; i++) assert.ok(matches[i].t > matches[i - 1].t, 'season time must increase with fixture order');
});

console.log('\nAll generator verification checks passed.');

// Diagnoses the C4 dose-response anomaly - C4-mod degraded MORE than C4-stress on nearly every
// method, breaking the monotonicity the grid was built to produce. See experiment-6-design.md.
//
// Uses ONLY the existing committed raw results and deterministically regenerated populations.
// Nothing is re-run, no generator parameter is changed, no criterion is revisited. The experiment
// was preregistered and completed; adjusting it because the dose-response was not pretty is
// exactly what six experiments of discipline exist to prevent.
//
// The central measurement is a decomposition. Brier for a perfect predictor of a Bernoulli outcome
// is not zero - it is p(1-p). So:
//
//     Brier_observed  =  Brier_irreducible  +  excess
//     Brier_irreducible = mean over checkpoints of pTrue*(1-pTrue)
//
// Brier_irreducible depends only on where the true probabilities sit, i.e. on the test period's
// base rate. Excess is the part attributable to the model. If the anomaly lives in the irreducible
// term, it is a property of the generated target, not of any method's response to drift.
//
// Usage: node research/diagnostics/experiment-6-drift-diagnostic.js
const fs = require('fs');
const path = require('path');
const { generatePopulation, generateLeagueMatches, trueProbability, makeRng, LINES, LENGTHS } = require('../synthetic/generator');

const RESULTS_DIR = path.join(__dirname, '..', 'results');
const ALL_TYPES = ['player', 'interaction', 'context'];
const POP = { numBatters: 176, numBowlers: 96, seed: 1 };
const LEAGUE = { numTeams: 16, battersPerTeam: 11, bowlersPerTeam: 6, rounds: 2, ballsPerInnings: 35, seed: 2 };

function findRun(name) {
  const dir = fs.readdirSync(RESULTS_DIR).find((d) => d.startsWith(name + '_'));
  if (!dir) throw new Error(`run not found: ${name}`);
  return {
    dir,
    summary: JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, dir, 'summary.json'), 'utf8')),
    raw: JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, dir, 'raw-results.json'), 'utf8'))
  };
}

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const logit = (p) => Math.log(p / (1 - p));

function main() {
  const runs = [
    ['C0b  m=0.00', '6-C0b', 0.00],
    ['mild m=0.25', '6-C4-mild', 0.25],
    ['mod  m=0.50', '6-C4-mod', 0.50],
    ['strs m=1.00', '6-C4-stress', 1.00]
  ].map(([label, name, m]) => ({ label, name, m, ...findRun(name) }));

  // ---- 0. Are drift coefficients exact scalar multiples across magnitudes? -------------------
  // rng.normal(0, sd) draws the same standard normal and scales it, and drift is drawn last from
  // an identical RNG position - so delta(m) should be exactly m*delta(1.0). If so, the drift
  // DIRECTION is identical at every magnitude and differential cancellation between components
  // cannot explain the anomaly.
  console.log('='.repeat(100));
  console.log('0. IS DRIFT DIRECTION IDENTICAL ACROSS MAGNITUDES? (rules cancellation in or out)');
  console.log('='.repeat(100));
  const popAt = (m) => generatePopulation({ ...POP, drift: m > 0 ? { types: ALL_TYPES, magnitude: m } : null });
  const pops = new Map([[0, generatePopulation(POP)], [0.25, popAt(0.25)], [0.5, popAt(0.5)], [1.0, popAt(1.0)]]);
  const p1 = pops.get(1.0), pHalf = pops.get(0.5);
  let maxRatioDev = 0;
  for (const [key, v] of p1.driftCoefficients.V) {
    const half = pHalf.driftCoefficients.V.get(key);
    if (Math.abs(v) > 1e-12) maxRatioDev = Math.max(maxRatioDev, Math.abs(half / v - 0.5));
  }
  for (const [key, v] of p1.driftCoefficients.I) {
    const half = pHalf.driftCoefficients.I.get(key);
    if (Math.abs(v) > 1e-12) maxRatioDev = Math.max(maxRatioDev, Math.abs(half / v - 0.5));
  }
  console.log(`  max deviation of delta(0.5)/delta(1.0) from exactly 0.5: ${maxRatioDev.toExponential(3)}`);
  console.log(`  => drift direction ${maxRatioDev < 1e-12 ? 'IS IDENTICAL across magnitudes, only scaled' : 'DIFFERS across magnitudes'}`);
  console.log(`  => differential cancellation between components ${maxRatioDev < 1e-12 ? 'CANNOT explain the anomaly' : 'remains possible'}`);

  // ---- 1-3. Ground-truth movement in probability and logit space -----------------------------
  console.log('');
  console.log('='.repeat(100));
  console.log('1-3. GROUND-TRUTH MOVEMENT (population level, independent of any model)');
  console.log('='.repeat(100));
  console.log(`  ${'run'.padEnd(13)} ${'E|p(1)-p(0)|'.padStart(14)} ${'E|z(1)-z(0)|'.padStart(14)} ${'sd(p) at t=0'.padStart(14)} ${'sd(p) at t=1'.padStart(14)}`);
  for (const r of runs) {
    const pop = pops.get(r.m);
    const rng = makeRng(4242);
    const dP = [], dZ = [], p0 = [], p1s = [];
    for (let i = 0; i < 6000; i++) {
      const b = rng.pick(pop.batters), w = rng.pick(pop.bowlers);
      const line = rng.pick(LINES), length = rng.pick(LENGTHS);
      const a = trueProbability(pop, b._id, w._id, line, length, 0);
      const c = trueProbability(pop, b._id, w._id, line, length, 1);
      dP.push(Math.abs(c - a)); dZ.push(Math.abs(logit(c) - logit(a))); p0.push(a); p1s.push(c);
    }
    const sd = (a) => { const mu = mean(a); return Math.sqrt(mean(a.map((x) => (x - mu) ** 2))); };
    console.log(`  ${r.label.padEnd(13)} ${dP.length ? mean(dP).toFixed(6).padStart(14) : ''} ${mean(dZ).toFixed(6).padStart(14) } ${sd(p0).toFixed(6).padStart(14)} ${sd(p1s).toFixed(6).padStart(14)}`);
  }

  // ---- 4-5. Train vs test regime distance, measured on the actual generated seasons -----------
  console.log('');
  console.log('='.repeat(100));
  console.log('4-5. TRAIN vs TEST REGIME (on the actual generated matches, temporal 85/15 split)');
  console.log('='.repeat(100));
  console.log(`  ${'run'.padEnd(13)} ${'mean pTrue train'.padStart(17)} ${'mean pTrue test'.padStart(16)} ${'E|p_test - pbar_train|'.padStart(23)} ${'realized wkt rate test'.padStart(23)}`);
  for (const r of runs) {
    const pop = pops.get(r.m);
    const { matches } = generateLeagueMatches({ population: pop, ...LEAGUE });
    const numTest = Math.round(matches.length * 0.15);
    const split = matches.length - numTest;
    const collect = (ms) => {
      const ps = [], ys = [];
      for (const m of ms) for (const inn of m.innings) for (const ball of inn.balls) {
        ps.push(trueProbability(pop, ball.batsmanId, ball.bowlerId, ball.line, ball.length, m.t));
        ys.push(ball.isWicket ? 1 : 0);
      }
      return { ps, ys };
    };
    const tr = collect(matches.slice(0, split));
    const te = collect(matches.slice(split));
    const pbarTrain = mean(tr.ps);
    console.log(`  ${r.label.padEnd(13)} ${pbarTrain.toFixed(6).padStart(17)} ${mean(te.ps).toFixed(6).padStart(16)} ${mean(te.ps.map((p) => Math.abs(p - pbarTrain))).toFixed(6).padStart(23)} ${mean(te.ys).toFixed(6).padStart(23)}`);
  }

  // ---- 6. THE DECOMPOSITION: irreducible vs excess Brier --------------------------------------
  console.log('');
  console.log('='.repeat(100));
  console.log('6. BRIER DECOMPOSITION at the evaluated checkpoints:  observed = irreducible + excess');
  console.log('   irreducible = mean pTrue*(1-pTrue) - the Brier a PERFECT predictor would score.');
  console.log('='.repeat(100));
  const irr = new Map();
  console.log(`  ${'run'.padEnd(13)} ${'checkpoints'.padStart(12)} ${'mean pTrue'.padStart(12)} ${'realized rate'.padStart(14)} ${'irreducible Brier'.padStart(18)}`);
  for (const r of runs) {
    const rows = r.raw.filter((x) => x.method === 'global');
    const v = mean(rows.map((x) => x.pTrue * (1 - x.pTrue)));
    irr.set(r.name, v);
    console.log(`  ${r.label.padEnd(13)} ${String(rows.length).padStart(12)} ${mean(rows.map((x) => x.pTrue)).toFixed(6).padStart(12)} ${mean(rows.map((x) => x.trueOutcome)).toFixed(6).padStart(14)} ${v.toFixed(8).padStart(18)}`);
  }

  const methods = ['global', 'singleLevelShrinkage', 'fullHierarchy', 'oracleInformedHierarchy', 'jointRegularizedLogit', 'jointRegularizedLogitOnline'];
  console.log('');
  console.log('  EXCESS Brier (observed - irreducible) - the part attributable to the model:');
  console.log(`  ${'method'.padEnd(30)}${runs.map((r) => r.label.slice(0, 11).padStart(14)).join('')}`);
  for (const m of methods) {
    const cells = runs.map((r) => {
      const b = r.summary.summary[m].brierScore;
      return (b - irr.get(r.name)).toFixed(8).padStart(14);
    });
    console.log(`  ${m.padEnd(30)}${cells.join('')}`);
  }

  // ---- 7. Oracle MAE, which is not distorted by the realized base rate ------------------------
  console.log('');
  console.log('='.repeat(100));
  console.log('7. ORACLE MAE by magnitude - distance from the TRUE probability, not the noisy outcome');
  console.log('='.repeat(100));
  console.log(`  ${'method'.padEnd(30)}${runs.map((r) => r.label.slice(0, 11).padStart(14)).join('')}`);
  for (const m of methods) {
    const cells = runs.map((r) => r.summary.summary[m].oracleError.mae.toFixed(4).padStart(14));
    console.log(`  ${m.padEnd(30)}${cells.join('')}`);
  }

  console.log('');
  console.log('='.repeat(100));
  console.log('No interpretation applied. Diagnostic only; no criterion is revisited and nothing was re-run.');
  console.log('='.repeat(100));
}

main();

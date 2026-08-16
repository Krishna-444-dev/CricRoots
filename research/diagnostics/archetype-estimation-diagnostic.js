// DIAGNOSTIC ONLY. No new algorithm, no hypothesis verdict, no criterion.
//
// Experiment 7 left a specific gap unexplained. In World B the archetype level carries genuine
// signal (8.84% of logit variance, by construction), and the ORACLE archetype estimator beats
// global (0.0276 vs 0.0305 oracle MAE) - so the signal is worth having. Yet the EMPIRICAL
// archetype estimator is worse than global (0.0399). Neither contamination (H9) nor irrelevance
// (H2) accounts for it.
//
// This measures where the loss occurs, without proposing a mechanism. Naming a mechanism before
// measuring one is how the last four hypotheses were formed; three were unsupported.
//
// Runs entirely as computation - no database. That is legitimate here because the fit-once joint
// model's prediction depends only on (batter, bowler, styles, line, length) and not on the
// checkpoint's revealed state, so fitting on training balls and evaluating on test balls
// reproduces the harness's jointRegularizedLogit exactly. Empirical archetype pools are likewise
// computed directly from the generated balls, reproducing what
// getLineLengthBreakdown({batsmanIds: archIds, bowlerIds: archIds}) returns.
//
// Usage: node research/diagnostics/archetype-estimation-diagnostic.js
const { generatePopulation, generateLeagueMatches, trueProbability, makeRng, LINES, LENGTHS } = require('../synthetic/generator');
const { buildDesign, fit, makePredictor } = require('../models/regularizedHierarchicalLogit');

const POP = { numBatters: 176, numBowlers: 96, seed: 1, archetypeSignal: true };   // World B
const LEAGUE = { numTeams: 16, battersPerTeam: 11, bowlersPerTeam: 6, rounds: 2, ballsPerInnings: 35, seed: 2 };
const LAMBDA = 5, LAMBDA_INT = 20; // chosen by training-only CV in every prior run

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const variance = (a) => { const m = mean(a); return m === null ? null : mean(a.map((x) => (x - m) ** 2)); };
const logit = (p) => Math.log(p / (1 - p));

function seededShuffle(arr, seed) {
  const rng = makeRng(seed);
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng.uniform(0, i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

function main() {
  const pop = generatePopulation(POP);
  const { matches } = generateLeagueMatches({ population: pop, ...LEAGUE });
  // Same random split as Experiments 4/5/7 (splitSeed 3, testFraction 0.15)
  const shuffled = seededShuffle(matches, 3);
  const numTest = Math.round(matches.length * 0.15);
  const trainMatches = shuffled.slice(0, matches.length - numTest);
  const testMatches = shuffled.slice(matches.length - numTest);

  const bStyle = new Map(pop.batters.map((b) => [b._id, b.battingStyle]));
  const wStyle = new Map(pop.bowlers.map((w) => [w._id, w.bowlingStyle]));
  const toRows = (ms) => {
    const rows = [];
    for (const m of ms) for (const inn of m.innings) for (const ball of inn.balls) rows.push({
      batterId: ball.batsmanId, bowlerId: ball.bowlerId,
      battingStyle: bStyle.get(ball.batsmanId), bowlingStyle: wStyle.get(ball.bowlerId),
      line: ball.line, length: ball.length, isWicket: ball.isWicket
    });
    return rows;
  };
  const trainRows = toRows(trainMatches);
  const testRows = toRows(testMatches);
  for (const r of testRows) r.pTrue = trueProbability(pop, r.batterId, r.bowlerId, r.line, r.length);

  console.log(`World B. Training balls ${trainRows.length}, test balls ${testRows.length}.\n`);

  // ---- 1. True archetype effect (the generator's own A_ab) ------------------------------------
  console.log('='.repeat(100));
  console.log('1. TRUE ARCHETYPE EFFECT - the generator\'s A_ab, logit space');
  console.log('='.repeat(100));
  const archKeys = [...pop.archetypeEffect.keys()];
  for (const k of archKeys) console.log(`  ${k.padEnd(32)} ${pop.archetypeEffect.get(k) >= 0 ? '+' : ''}${pop.archetypeEffect.get(k).toFixed(4)}`);
  console.log(`  sd across the 8 combinations: ${Math.sqrt(variance([...pop.archetypeEffect.values()])).toFixed(4)}`);

  // ---- 2-5. Oracle vs empirical archetype cell estimates ---------------------------------------
  // Oracle: exact conditional mean of trueProbability over every batter/bowler in the archetype.
  // Empirical: dismissal rate observed in the training data for the same cell.
  const battersByStyle = new Map(), bowlersByStyle = new Map();
  for (const b of pop.batters) { if (!battersByStyle.has(b.battingStyle)) battersByStyle.set(b.battingStyle, []); battersByStyle.get(b.battingStyle).push(b); }
  for (const w of pop.bowlers) { if (!bowlersByStyle.has(w.bowlingStyle)) bowlersByStyle.set(w.bowlingStyle, []); bowlersByStyle.get(w.bowlingStyle).push(w); }

  const empCount = new Map(), empWkts = new Map();
  for (const r of trainRows) {
    const key = `${r.battingStyle}|${r.bowlingStyle}|${r.line}|${r.length}`;
    empCount.set(key, (empCount.get(key) || 0) + 1);
    if (r.isWicket) empWkts.set(key, (empWkts.get(key) || 0) + 1);
  }

  const cells = [];
  for (const [bs, batters] of battersByStyle) for (const [ws, bowlers] of bowlersByStyle)
    for (const line of LINES) for (const length of LENGTHS) {
      const ps = [];
      for (const b of batters) for (const w of bowlers) ps.push(trueProbability(pop, b._id, w._id, line, length));
      const key = `${bs}|${ws}|${line}|${length}`;
      const n = empCount.get(key) || 0;
      cells.push({
        key, n,
        oracle: mean(ps),
        withinVar: variance(ps),
        empirical: n > 0 ? (empWkts.get(key) || 0) / n : null
      });
    }

  const withData = cells.filter((c) => c.n > 0);
  console.log('');
  console.log('='.repeat(100));
  console.log('2-4. ORACLE vs EMPIRICAL archetype cell estimates (8 archetype pairs x 42 line/length = 336 cells)');
  console.log('='.repeat(100));
  console.log(`  cells with training data: ${withData.length} of ${cells.length}`);
  console.log(`  between-cell sd of the ORACLE estimate:    ${Math.sqrt(variance(withData.map((c) => c.oracle))).toFixed(6)}   <- the signal available`);
  console.log(`  mean |empirical - oracle|:                 ${mean(withData.map((c) => Math.abs(c.empirical - c.oracle))).toFixed(6)}   <- the estimation error`);
  console.log(`  between-cell sd of the EMPIRICAL estimate:  ${Math.sqrt(variance(withData.map((c) => c.empirical))).toFixed(6)}`);
  console.log('');
  console.log('  Ratio of estimation error to available signal: ' +
    (mean(withData.map((c) => Math.abs(c.empirical - c.oracle))) / Math.sqrt(variance(withData.map((c) => c.oracle)))).toFixed(2) + 'x');

  console.log('');
  console.log('='.repeat(100));
  console.log('5. ESTIMATION ERROR BY ARCHETYPE CELL SAMPLE SIZE');
  console.log('='.repeat(100));
  console.log(`  ${'cell n'.padEnd(12)} ${'cells'.padStart(7)} ${'mean |emp-oracle|'.padStart(19)} ${'mean oracle'.padStart(13)} ${'sd(oracle)'.padStart(12)}`);
  for (const [lo, hi] of [[1, 10], [10, 25], [25, 50], [50, 100], [100, 1e9]]) {
    const bin = withData.filter((c) => c.n >= lo && c.n < hi);
    if (!bin.length) continue;
    const label = hi === 1e9 ? `${lo}+` : `${lo}-${hi - 1}`;
    console.log(`  ${label.padEnd(12)} ${String(bin.length).padStart(7)} ${mean(bin.map((c) => Math.abs(c.empirical - c.oracle))).toFixed(6).padStart(19)} ${mean(bin.map((c) => c.oracle)).toFixed(6).padStart(13)} ${Math.sqrt(variance(bin.map((c) => c.oracle))).toFixed(6).padStart(12)}`);
  }

  // ---- 6. Within-archetype heterogeneity -------------------------------------------------------
  console.log('');
  console.log('='.repeat(100));
  console.log('6. WITHIN-ARCHETYPE HETEROGENEITY - how well does a cell mean even represent its members?');
  console.log('='.repeat(100));
  const betweenVar = variance(withData.map((c) => c.oracle));
  const withinVar = mean(withData.map((c) => c.withinVar));
  console.log(`  between-cell variance of true probability: ${betweenVar.toExponential(4)}`);
  console.log(`  mean WITHIN-cell variance:                 ${withinVar.toExponential(4)}`);
  console.log(`  ratio within/between:                      ${(withinVar / betweenVar).toFixed(2)}x`);
  console.log('');
  console.log('  Reliability R = betweenVar / (betweenVar + withinVar/n), by cell sample size:');
  for (const [lo, hi] of [[1, 10], [10, 25], [25, 50], [50, 100], [100, 1e9]]) {
    const bin = withData.filter((c) => c.n >= lo && c.n < hi);
    if (!bin.length) continue;
    const label = hi === 1e9 ? `${lo}+` : `${lo}-${hi - 1}`;
    const R = mean(bin.map((c) => betweenVar / (betweenVar + c.withinVar / c.n)));
    console.log(`    ${label.padEnd(10)} n_cells=${String(bin.length).padStart(4)}   mean R = ${R.toFixed(4)}`);
  }

  // ---- 7-8. Joint model: recovered archetype coefficients, and component ablation --------------
  // Ablation is done in the DESIGN MATRIX (collapsing a factor to a single level makes it
  // redundant with the intercept), so the optimizer is untouched and no model code changes.
  console.log('');
  console.log('='.repeat(100));
  console.log('7-8. JOINT MODEL - recovered archetype effect, and where its advantage comes from');
  console.log('='.repeat(100));

  const fitVariant = ({ dropArch = false, dropInteraction = false, dropPlayers = false }) => {
    const rows = trainRows.map((r) => ({
      ...r,
      battingStyle: dropArch ? 'X' : r.battingStyle,
      bowlingStyle: dropArch ? 'X' : r.bowlingStyle,
      batterId: dropPlayers ? 'X' : r.batterId,
      bowlerId: dropPlayers ? 'X' : r.bowlerId
    }));
    // Interaction is keyed on batterId|bowlerId inside buildDesign; collapse it by giving every
    // row the same pair key while keeping the individual ids intact.
    const design = buildDesign(rows);
    if (dropInteraction && !dropPlayers) {
      design.pairIdx.clear(); design.pairIdx.set('X', 0);
      for (const e of design.encoded) e.p = 0;
    }
    const sizes = { batter: design.batterIdx.size, bowler: design.bowlerIdx.size, arch: design.archIdx.size, ll: design.llIdx.size, pair: Math.max(design.pairIdx.size, 1) };
    const params = fit(design.encoded, sizes, { lambda: LAMBDA, lambdaInteraction: LAMBDA_INT });
    const predict = makePredictor(params, design);
    return {
      params, design,
      mae: mean(testRows.map((r) => Math.abs(predict({
        batterId: dropPlayers ? 'X' : r.batterId, bowlerId: dropPlayers ? 'X' : r.bowlerId,
        battingStyle: dropArch ? 'X' : r.battingStyle, bowlingStyle: dropArch ? 'X' : r.bowlingStyle,
        line: r.line, length: r.length
      }) - r.pTrue)))
    };
  };

  const full = fitVariant({});
  console.log('\n  Recovered archetype coefficients vs the generator\'s true A_ab (both logit space,');
  console.log('  each shown relative to its own mean since the intercept absorbs any common offset):');
  const trueVals = archKeys.map((k) => pop.archetypeEffect.get(k));
  const trueMean = mean(trueVals);
  const est = archKeys.map((k) => { const i = full.design.archIdx.get(k); return i === undefined ? 0 : full.params.arch[i]; });
  const estMean = mean(est);
  console.log(`  ${'archetype pair'.padEnd(32)} ${'true (centred)'.padStart(15)} ${'fitted (centred)'.padStart(17)} ${'error'.padStart(10)}`);
  for (let i = 0; i < archKeys.length; i++) {
    const t = trueVals[i] - trueMean, e = est[i] - estMean;
    console.log(`  ${archKeys[i].padEnd(32)} ${t.toFixed(4).padStart(15)} ${e.toFixed(4).padStart(17)} ${(e - t).toFixed(4).padStart(10)}`);
  }
  const cent = (a, m) => a.map((x) => x - m);
  const tc = cent(trueVals, trueMean), ec = cent(est, estMean);
  const cov = mean(tc.map((x, i) => x * ec[i]));
  const corr = cov / (Math.sqrt(mean(tc.map((x) => x * x))) * Math.sqrt(mean(ec.map((x) => x * x))));
  console.log(`\n  correlation between fitted and true archetype effects: ${corr.toFixed(4)}`);
  console.log(`  sd(true) = ${Math.sqrt(mean(tc.map((x) => x * x))).toFixed(4)}   sd(fitted) = ${Math.sqrt(mean(ec.map((x) => x * x))).toFixed(4)}   shrinkage factor = ${(Math.sqrt(mean(ec.map((x) => x * x))) / Math.sqrt(mean(tc.map((x) => x * x)))).toFixed(3)}`);

  console.log('\n  COMPONENT ABLATION - oracle MAE on held-out balls (lower is better):');
  const variants = [
    ['full model', {}],
    ['without archetype term', { dropArch: true }],
    ['without interaction term', { dropInteraction: true }],
    ['without archetype AND interaction', { dropArch: true, dropInteraction: true }],
    ['without per-player terms', { dropPlayers: true }]
  ];
  const results = [];
  for (const [label, opts] of variants) {
    const v = fitVariant(opts);
    results.push({ label, mae: v.mae });
    console.log(`    ${label.padEnd(36)} ${v.mae.toFixed(6)}   ${label === 'full model' ? '' : (v.mae - full.mae >= 0 ? '+' : '') + (v.mae - full.mae).toExponential(2) + ' vs full'}`);
  }

  console.log('');
  console.log('='.repeat(100));
  console.log('Diagnostic only. No hypothesis verdict, no criterion, no proposed mechanism.');
  console.log('='.repeat(100));
}

main();

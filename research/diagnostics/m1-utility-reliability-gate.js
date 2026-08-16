// M1 GATE ONLY - experiment-9-design.md section 2. Nothing else is run.
//
// Before asking whether an observable proxy predicts per-entity utility, establish whether
// per-entity utility is MEASURABLE. If a batter's utility estimate is dominated by which held-out
// balls happened to occur, then corr(proxy, utility) ~ 0 is guaranteed however good the proxy is,
// and we would misread that as "no observable proxy exists".
//
// Three views of the same question, because a single coefficient can hide structure:
//   (a) split-half correlation across batters, plus Spearman-Brown correction to full length
//   (b) variance decomposition - between-batter variance against mean within-batter measurement
//       variance, giving a reliability coefficient that does not depend on one arbitrary split
//   (c) the DISTRIBUTION of per-batter measurement noise, and reliability stratified by how many
//       held-out balls a batter actually has
//
// Note on (c): "per-batter reliability" is not strictly defined - reliability is a property of a
// population of measurements, not of one measurement. What IS per-batter is the measurement NOISE
// on that batter's utility estimate, and that is what the distribution below reports.
//
// lambda is fixed at 5 - a frozen grid value at which the latent term is LIVE at every volume.
// Using the CV-selected penalty would make utility identically zero at low volume, which would
// conflate "the label is unmeasurable" with "there is no effect to measure".
//
// Usage: node research/diagnostics/m1-utility-reliability-gate.js
const fs = require('fs');
const path = require('path');
const { generatePopulation, generateLeagueMatches, trueProbability, makeRng } = require('../synthetic/generator');
const { buildDesign } = require('../models/regularizedHierarchicalLogit');
const { fitOnce, makePredictor } = require('../models/lowRankJointLogit');

const BASE_POP = { numBatters: 176, numBowlers: 96, seed: 1, archetypeSignal: true, latentFactors: { K: 3, sigmaPhi: 0.22, mode: 'target' } };
const LEAGUE = { numTeams: 16, battersPerTeam: 11, bowlersPerTeam: 6, rounds: 2, ballsPerInnings: 35, seed: 2 };
const TRUE_K = 3;
const LAMBDA_LOWRANK = 5;
const KILL_LATENT = 1e9;
const SPLIT_REPEATS = 50; // random half-splits, averaged - one arbitrary split is itself noisy

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const variance = (a) => { const m = mean(a); return m === null ? null : mean(a.map((x) => (x - m) ** 2)); };
function corr(a, b) {
  const ma = mean(a), mb = mean(b);
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da === 0 || db === 0 ? 0 : n / Math.sqrt(da * db);
}
const quantile = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
function seededShuffle(arr, seed) {
  const rng = makeRng(seed);
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng.uniform(0, i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

function main() {
  const pop = generatePopulation(BASE_POP);
  const bStyle = new Map(pop.batters.map((b) => [b._id, b.battingStyle]));
  const wStyle = new Map(pop.bowlers.map((w) => [w._id, w.bowlingStyle]));
  const out = { generatedAt: new Date().toISOString(), lambdaLowRank: LAMBDA_LOWRANK, volumes: [] };

  for (const rounds of [2, 8, 32]) {
    const { matches } = generateLeagueMatches({ population: pop, ...LEAGUE, rounds });
    const shuffled = seededShuffle(matches, 3);
    const numTest = Math.round(matches.length * 0.15);
    const toRows = (ms) => {
      const rows = [];
      for (const m of ms) for (const inn of m.innings) for (const ball of inn.balls) rows.push({
        batterId: ball.batsmanId, bowlerId: ball.bowlerId,
        battingStyle: bStyle.get(ball.batsmanId), bowlingStyle: wStyle.get(ball.bowlerId),
        line: ball.line, length: ball.length, isWicket: ball.isWicket
      });
      return rows;
    };
    const trainRows = toRows(shuffled.slice(0, matches.length - numTest));
    const testRows = toRows(shuffled.slice(matches.length - numTest));
    for (const r of testRows) r.pTrue = trueProbability(pop, r.batterId, r.bowlerId, r.line, r.length);

    const design = buildDesign(trainRows);
    const sizes = { batter: design.batterIdx.size, bowler: design.bowlerIdx.size, arch: design.archIdx.size, ll: design.llIdx.size, pair: Math.max(design.pairIdx.size, 1) };
    const t0 = Date.now();
    const latent = fitOnce(design.encoded, sizes, { K: TRUE_K, lambda: 5, lambdaInteraction: 20, lambdaLowRank: LAMBDA_LOWRANK, useInteraction: false, seed: 11 });
    const flat = fitOnce(design.encoded, sizes, { K: 1, lambda: 5, lambdaInteraction: 20, lambdaLowRank: KILL_LATENT, useInteraction: false, seed: 11 });
    const pLatent = makePredictor(latent, design, TRUE_K, false);
    const pFlat = makePredictor(flat, design, 1, false);

    // Per-ball utility contribution. Predictions are fixed once fitted, so resampling test balls
    // needs no refit - the measurement noise being probed is entirely "which balls occurred".
    const byBatter = new Map();
    for (const r of testRows) {
      const d = Math.abs(pFlat(r) - r.pTrue) - Math.abs(pLatent(r) - r.pTrue);
      if (!byBatter.has(r.batterId)) byBatter.set(r.batterId, []);
      byBatter.get(r.batterId).push(d);
    }
    const batters = [...byBatter.entries()].filter(([, d]) => d.length >= 2);
    const nTest = batters.map(([, d]) => d.length);

    // (a) repeated random split-half
    const rng = makeRng(999);
    const splitCorrs = [];
    for (let rep = 0; rep < SPLIT_REPEATS; rep++) {
      const h1 = [], h2 = [];
      for (const [, d] of batters) {
        const sh = [...d];
        for (let i = sh.length - 1; i > 0; i--) { const j = Math.floor(rng.uniform(0, i + 1)); [sh[i], sh[j]] = [sh[j], sh[i]]; }
        const half = Math.floor(sh.length / 2);
        h1.push(mean(sh.slice(0, half)));
        h2.push(mean(sh.slice(half, half * 2)));
      }
      splitCorrs.push(corr(h1, h2));
    }
    const rHalf = mean(splitCorrs);
    const rFull = (2 * rHalf) / (1 + rHalf); // Spearman-Brown

    // (b) variance decomposition, independent of any particular split
    const util = batters.map(([, d]) => mean(d));
    const measVar = batters.map(([, d]) => variance(d) / d.length); // SE^2 of that batter's estimate
    const observedBetween = variance(util);
    const meanMeasVar = mean(measVar);
    const trueBetween = observedBetween - meanMeasVar;
    const reliability = trueBetween / observedBetween;

    console.log('='.repeat(104));
    console.log(`ROUNDS=${rounds}   ${(trainRows.length / pop.batters.length).toFixed(0)} training balls/batter   ${batters.length} batters   (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    console.log('='.repeat(104));
    console.log(`  held-out balls per batter: median ${quantile(nTest, 0.5)}   p10 ${quantile(nTest, 0.1)}   p90 ${quantile(nTest, 0.9)}`);
    console.log('');
    console.log(`  (a) split-half correlation (${SPLIT_REPEATS} random splits): ${rHalf.toFixed(4)}   Spearman-Brown full-length: ${rFull.toFixed(4)}`);
    console.log(`  (b) variance decomposition:`);
    console.log(`        observed between-batter variance of utility : ${observedBetween.toExponential(3)}`);
    console.log(`        mean within-batter measurement variance     : ${meanMeasVar.toExponential(3)}`);
    console.log(`        implied TRUE between-batter variance        : ${trueBetween.toExponential(3)}`);
    console.log(`        reliability = true / observed               : ${reliability.toFixed(4)}`);
    console.log('');
    const measSd = measVar.map(Math.sqrt);
    console.log(`  (c) per-batter measurement noise SD:  median ${quantile(measSd, 0.5).toExponential(3)}   p10 ${quantile(measSd, 0.1).toExponential(3)}   p90 ${quantile(measSd, 0.9).toExponential(3)}`);
    console.log(`      observed spread of utility across batters SD: ${Math.sqrt(observedBetween).toExponential(3)}`);
    console.log(`      ratio (median noise / observed spread): ${(quantile(measSd, 0.5) / Math.sqrt(observedBetween)).toFixed(3)}   <- above 1 means noise exceeds the signal being sought`);
    console.log('');
    console.log(`      reliability by held-out-ball count:`);
    const sorted = [...batters].sort((a, b) => a[1].length - b[1].length);
    for (let q = 0; q < 3; q++) {
      const sl = sorted.slice(Math.floor(q * sorted.length / 3), Math.floor((q + 1) * sorted.length / 3));
      const u = sl.map(([, d]) => mean(d));
      const mv = mean(sl.map(([, d]) => variance(d) / d.length));
      const ob = variance(u);
      console.log(`        tercile ${q + 1}  balls ${sl[0][1].length}-${sl[sl.length - 1][1].length}   reliability ${((ob - mv) / ob).toFixed(4)}`);
    }
    console.log('');
    out.volumes.push({ rounds, perBatterTrain: trainRows.length / pop.batters.length, nBatters: batters.length, medianTestBalls: quantile(nTest, 0.5), splitHalf: rHalf, spearmanBrown: rFull, observedBetween, meanMeasVar, reliability });
  }

  const outPath = path.join(__dirname, 'm1-utility-reliability-results.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`Written to ${outPath}`);
  console.log('\nM1 gate only. No proxies built, no algorithm proposed, no pass/fail threshold preregistered -');
  console.log('the design deliberately did not invent one, so this is reported descriptively.');
}

main();

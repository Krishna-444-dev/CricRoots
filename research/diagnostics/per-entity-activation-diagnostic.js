// Is the activation threshold UNIVERSAL, or does it vary by entity?
//
// Diagnostic only. No new algorithm, no change to World D, no hypothesis verdict. Nothing here
// proposes an entity-specific rule; it only measures whether one would have anything to act on.
//
// Per review, THREE quantities are kept conceptually separate, because they can diverge and
// collapsing them would hide exactly the interesting case:
//
//   1. REPRESENTATION CONFIDENCE - do we reliably know what this batter's latent behaviour is?
//      Measured as stability of the fitted latent surface across independent seeded fits. A batter
//      whose estimate swings between restarts is not "known", however close one fit happens to land.
//
//   2. REPRESENTATION ACCURACY - is the estimate actually close to the truth?
//      Per-batter correlation between fitted and true latent surface. Only computable here because
//      Track A has ground truth.
//
//   3. PREDICTIVE UTILITY - does using it improve predictions FOR THAT BATTER?
//      Held-out MAE with the latent term vs the same model with it forced off.
//
// A batter can score well on 2 and badly on 3. That combination - accurately recovered, predictively
// useless - is a distinct finding from "not recoverable", and the design of this script exists to
// make it visible rather than averaged away.
//
// Usage: node research/diagnostics/per-entity-activation-diagnostic.js
const fs = require('fs');
const path = require('path');
const { generatePopulation, generateLeagueMatches, trueProbability, latentTerm, makeRng, LINES, LENGTHS } = require('../synthetic/generator');
const { buildDesign } = require('../models/regularizedHierarchicalLogit');
const { fitOnce, makePredictor } = require('../models/lowRankJointLogit');

const BASE_POP = { numBatters: 176, numBowlers: 96, seed: 1, archetypeSignal: true, latentFactors: { K: 3, sigmaPhi: 0.22, mode: 'target' } };
const LEAGUE = { numTeams: 16, battersPerTeam: 11, bowlersPerTeam: 6, rounds: 2, ballsPerInnings: 35, seed: 2 };
const TRUE_K = 3;
// Smallest FROZEN grid value at which the latent term is live at low volume. Taken from
// Experiment 8's grid, not tuned here.
const LAMBDA_LOWRANK = 5;
const SEEDS = [11, 22, 33];
const KILL_LATENT = 1e9;

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

function surfaceFor(params, design, batterId, K) {
  const bi = design.batterIdx.get(batterId);
  if (bi === undefined) return null;
  const v = [];
  for (const line of LINES) for (const length of LENGTHS) {
    const li = design.llIdx.get(`${line}|${length}`);
    if (li === undefined) { v.push(0); continue; }
    let f = 0;
    for (let k = 0; k < K; k++) f += params.U[bi * K + k] * params.V[li * K + k];
    v.push(f);
  }
  return v;
}

function main() {
  const pop = generatePopulation(BASE_POP);
  const bStyle = new Map(pop.batters.map((b) => [b._id, b.battingStyle]));
  const wStyle = new Map(pop.bowlers.map((w) => [w._id, w.bowlingStyle]));
  const out = { generatedAt: new Date().toISOString(), lambdaLowRank: LAMBDA_LOWRANK, volumes: [] };

  for (const rounds of [2, 8]) {
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

    const nBy = new Map();
    for (const r of trainRows) nBy.set(r.batterId, (nBy.get(r.batterId) || 0) + 1);
    const testBy = new Map();
    for (const r of testRows) { if (!testBy.has(r.batterId)) testBy.set(r.batterId, []); testBy.get(r.batterId).push(r); }

    const design = buildDesign(trainRows);
    const sizes = { batter: design.batterIdx.size, bowler: design.bowlerIdx.size, arch: design.archIdx.size, ll: design.llIdx.size, pair: Math.max(design.pairIdx.size, 1) };

    // Multiple seeded fits: the primary fit plus the others, used for the stability measure.
    const fits = SEEDS.map((seed) => fitOnce(design.encoded, sizes, { K: TRUE_K, lambda: 5, lambdaInteraction: 20, lambdaLowRank: LAMBDA_LOWRANK, useInteraction: false, seed }));
    const primary = fits[0];
    const predictLatent = makePredictor(primary, design, TRUE_K, false);
    // Same model, latent term forced off - same optimiser, design and data, so the difference
    // isolates the latent term.
    const flat = fitOnce(design.encoded, sizes, { K: 1, lambda: 5, lambdaInteraction: 20, lambdaLowRank: KILL_LATENT, useInteraction: false, seed: 11 });
    const predictFlat = makePredictor(flat, design, 1, false);

    const per = [];
    for (const b of pop.batters) {
      const surfaces = fits.map((f) => surfaceFor(f, design, b._id, TRUE_K));
      if (surfaces[0] === null) continue;
      const tru = [];
      for (const line of LINES) for (const length of LENGTHS) tru.push(latentTerm(pop, b._id, line, length, 'target'));

      // 1. confidence: pairwise agreement of the fitted surface across independent seeds
      const pairs = [];
      for (let i = 0; i < surfaces.length; i++) for (let j = i + 1; j < surfaces.length; j++) pairs.push(corr(surfaces[i], surfaces[j]));
      // 2. accuracy
      const accuracy = corr(surfaces[0], tru);
      // 3. predictive utility on this batter's own held-out balls
      const mine = testBy.get(b._id) || [];
      const utility = mine.length === 0 ? null
        : mean(mine.map((r) => Math.abs(predictFlat(r) - r.pTrue))) - mean(mine.map((r) => Math.abs(predictLatent(r) - r.pTrue)));

      const zb = pop.latent.z.get(b._id);
      per.push({
        id: b._id, n: nBy.get(b._id) || 0, nTest: mine.length,
        confidence: mean(pairs), accuracy, utility,
        zNorm: Math.sqrt(zb.reduce((s, x) => s + x * x, 0)),
        sdTrue: Math.sqrt(variance(tru))
      });
    }

    const withUtil = per.filter((p) => p.utility !== null);
    const acc = per.map((p) => p.accuracy), conf = per.map((p) => p.confidence), ns = per.map((p) => p.n);
    const util = withUtil.map((p) => p.utility);

    console.log('='.repeat(108));
    console.log(`ROUNDS=${rounds}   mean ${mean(ns).toFixed(0)} training balls/batter   lambdaLowRank=${LAMBDA_LOWRANK} (frozen)   ${per.length} batters`);
    console.log('='.repeat(108));
    console.log(`  1. CONFIDENCE (cross-seed agreement)  mean ${mean(conf).toFixed(4)}  sd ${Math.sqrt(variance(conf)).toFixed(4)}  p10 ${quantile(conf, 0.1).toFixed(3)}  p90 ${quantile(conf, 0.9).toFixed(3)}`);
    console.log(`  2. ACCURACY   (vs true surface)       mean ${mean(acc).toFixed(4)}  sd ${Math.sqrt(variance(acc)).toFixed(4)}  p10 ${quantile(acc, 0.1).toFixed(3)}  p90 ${quantile(acc, 0.9).toFixed(3)}`);
    console.log(`       fraction accuracy > 0.5: ${(acc.filter((x) => x > 0.5).length / acc.length * 100).toFixed(1)}%   < 0: ${(acc.filter((x) => x < 0).length / acc.length * 100).toFixed(1)}%`);
    console.log(`  3. UTILITY    (held-out MAE benefit)  mean ${mean(util).toExponential(3)}  sd ${Math.sqrt(variance(util)).toExponential(3)}  frac>0 ${(util.filter((x) => x > 0).length / util.length * 100).toFixed(1)}%   (${withUtil.length} batters with test balls, median ${quantile(withUtil.map((p) => p.nTest), 0.5)} each)`);
    console.log('');
    console.log(`  DO THE THREE AGREE WITH EACH OTHER?`);
    console.log(`     corr(accuracy, confidence) = ${corr(acc, conf).toFixed(4)}`);
    console.log(`     corr(accuracy, utility)    = ${corr(withUtil.map((p) => p.accuracy), util).toFixed(4)}   <- accurate recovery need not mean useful`);
    console.log(`     corr(confidence, utility)  = ${corr(withUtil.map((p) => p.confidence), util).toFixed(4)}`);
    console.log('');
    console.log(`  IS ANY OF IT EXPLAINED BY OBSERVATION COUNT?`);
    console.log(`     corr(accuracy, n)   = ${corr(acc, ns).toFixed(4)}`);
    console.log(`     corr(confidence, n) = ${corr(conf, ns).toFixed(4)}`);
    console.log(`     corr(utility, n)    = ${corr(withUtil.map((p) => p.n), util).toFixed(4)}`);
    console.log(`     corr(accuracy, |z_b|)   = ${corr(acc, per.map((p) => p.zNorm)).toFixed(4)}   <- strength of the batter's own latent position`);
    console.log(`     corr(accuracy, sdTrue)  = ${corr(acc, per.map((p) => p.sdTrue)).toFixed(4)}   <- how much their latent surface actually varies`);
    console.log('');
    console.log(`  BY TRAINING-OBSERVATION QUARTILE:`);
    const sorted = [...per].sort((a, b) => a.n - b.n);
    for (let q = 0; q < 4; q++) {
      const sl = sorted.slice(Math.floor(q * per.length / 4), Math.floor((q + 1) * per.length / 4));
      const su = sl.filter((p) => p.utility !== null);
      console.log(`     Q${q + 1}  n ${sl[0].n}-${sl[sl.length - 1].n}   accuracy ${mean(sl.map((p) => p.accuracy)).toFixed(4)}   confidence ${mean(sl.map((p) => p.confidence)).toFixed(4)}   utility ${su.length ? mean(su.map((p) => p.utility)).toExponential(2) : 'n/a'}`);
    }
    console.log('');
    out.volumes.push({ rounds, meanN: mean(ns), per });
  }

  const outPath = path.join(__dirname, 'per-entity-activation-results.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`Written to ${outPath}`);
  console.log('\nMeasurement study only. Does not propose an entity-specific rule.');
}

main();

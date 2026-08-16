// When does a principled, training-only selection procedure START choosing to use the latent
// representation? Diagnostic only - no new algorithm, no change to World D's generating process.
//
// This is the table review asked for:
//
//   data volume -> CV-selected lambda | latent recovery r | latent magnitude | prediction benefit
//
// The question is deliberately NOT "can we find a lambda where the latent structure appears" - we
// already know we can (lambda=5 gives r=0.4534 at 4x data). That would be a fishing expedition.
// The question is: under the SAME selection procedure used in Experiment 8, at what point does
// held-out validation start preferring a live latent term over a dead one?
//
// The CV grid is therefore FROZEN at Experiment 8's exact values - kGrid [1,2,3,5,8],
// lowRankGrid [1,5,20,100] - and is not adjusted at any data volume.
//
// Only the observation count varies. Same population, same z, same phi, same seeds as Experiment 8.
//
// Usage: node research/diagnostics/latent-adoption-curve.js
const fs = require('fs');
const path = require('path');
const { generatePopulation, generateLeagueMatches, trueProbability, latentTerm, makeRng, LINES, LENGTHS } = require('../synthetic/generator');
const { buildDesign } = require('../models/regularizedHierarchicalLogit');
const { fitOnce, fitWithCrossValidation, makePredictor } = require('../models/lowRankJointLogit');

const BASE_POP = { numBatters: 176, numBowlers: 96, seed: 1, archetypeSignal: true, latentFactors: { K: 3, sigmaPhi: 0.22, mode: 'target' } };
const LEAGUE = { numTeams: 16, battersPerTeam: 11, bowlersPerTeam: 6, rounds: 2, ballsPerInnings: 35, seed: 2 };
const ROUNDS = [2, 8, 16];
const TRUE_K = 3;
const KILL_LATENT = 1e9; // forces U,V to zero exactly, giving the pure additive model on the SAME optimizer

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const variance = (a) => { const m = mean(a); return m === null ? null : mean(a.map((x) => (x - m) ** 2)); };
function corr(a, b) {
  const ma = mean(a), mb = mean(b);
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da === 0 || db === 0 ? 0 : n / Math.sqrt(da * db);
}
function seededShuffle(arr, seed) {
  const rng = makeRng(seed);
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng.uniform(0, i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

function latentSurfaces(pop, params, design, K) {
  const fit = [], tru = [];
  for (const b of pop.batters) {
    const bi = design.batterIdx.get(b._id);
    if (bi === undefined) continue;
    for (const line of LINES) for (const length of LENGTHS) {
      const li = design.llIdx.get(`${line}|${length}`);
      if (li === undefined) continue;
      let f = 0;
      for (let k = 0; k < K; k++) f += params.U[bi * K + k] * params.V[li * K + k];
      fit.push(f); tru.push(latentTerm(pop, b._id, line, length, 'target'));
    }
  }
  return { r: corr(fit, tru), sdFit: Math.sqrt(variance(fit)), sdTrue: Math.sqrt(variance(tru)) };
}

function main() {
  const pop = generatePopulation(BASE_POP);
  const bStyle = new Map(pop.batters.map((b) => [b._id, b.battingStyle]));
  const wStyle = new Map(pop.bowlers.map((w) => [w._id, w.bowlingStyle]));
  const out = { generatedAt: new Date().toISOString(), rows: [] };

  console.log('='.repeat(112));
  console.log('LATENT ADOPTION CURVE - when does training-only CV start choosing to use the latent term?');
  console.log('  CV grid FROZEN at Experiment 8 values: K in {1,2,3,5,8}, lambdaLowRank in {1,5,20,100}.');
  console.log('  Only observation volume varies. Same population/z/phi/seeds as Experiment 8.');
  console.log('='.repeat(112));
  console.log(`  ${'balls/batter'.padStart(13)} ${'CV lambda'.padStart(10)} ${'CV K'.padStart(5)} ${'latent live?'.padStart(13)} ${'r_latent'.padStart(9)} ${'sd(fit)/sd(true)'.padStart(17)} ${'MAE no-latent'.padStart(14)} ${'MAE low-rank'.padStart(13)} ${'benefit'.padStart(11)}`);

  for (const rounds of ROUNDS) {
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
    const perBatter = trainRows.length / pop.batters.length;

    const t = Date.now();
    // The CV-selected low-rank model - identical procedure to Experiment 8's arm C.
    const m = fitWithCrossValidation(trainRows, { useInteraction: false });
    const rec = latentSurfaces(pop, m.params, m.design, m.K);
    const maeLowRank = mean(testRows.map((r) => Math.abs(m.predict(r) - r.pTrue)));

    // Same model with the latent term forced off, on the SAME optimizer and design, so the
    // difference isolates the latent term rather than any implementation difference.
    const design = buildDesign(trainRows);
    const sizes = { batter: design.batterIdx.size, bowler: design.bowlerIdx.size, arch: design.archIdx.size, ll: design.llIdx.size, pair: Math.max(design.pairIdx.size, 1) };
    const flat = fitOnce(design.encoded, sizes, { K: 1, lambda: 5, lambdaInteraction: 20, lambdaLowRank: KILL_LATENT, useInteraction: false, seed: 11 });
    const flatPredict = makePredictor(flat, design, 1, false);
    const maeNoLatent = mean(testRows.map((r) => Math.abs(flatPredict(r) - r.pTrue)));

    const live = rec.sdFit > 1e-4;
    const row = { rounds, perBatter, cvLambda: m.lambdaLowRank, cvK: m.K, live, ...rec, maeNoLatent, maeLowRank, benefit: maeNoLatent - maeLowRank, seconds: (Date.now() - t) / 1000 };
    out.rows.push(row);
    console.log(`  ${perBatter.toFixed(0).padStart(13)} ${String(m.lambdaLowRank).padStart(10)} ${String(m.K).padStart(5)} ${(live ? 'YES' : 'no (=0)').padStart(13)} ${rec.r.toFixed(4).padStart(9)} ${(rec.sdFit / rec.sdTrue).toFixed(4).padStart(17)} ${maeNoLatent.toFixed(6).padStart(14)} ${maeLowRank.toFixed(6).padStart(13)} ${((row.benefit >= 0 ? '+' : '') + row.benefit.toExponential(2)).padStart(11)}   (${((Date.now() - t) / 1000).toFixed(0)}s)`);
  }

  const outPath = path.join(__dirname, 'latent-adoption-curve-results.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nWritten to ${outPath}`);
  console.log('\nDiagnostic only. No new algorithm, no change to World D, no hypothesis verdict.');
}

main();

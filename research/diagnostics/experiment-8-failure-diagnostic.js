// Post-Experiment-8 diagnostic: WHY couldn't the factor model recover the latent structure?
//
// Not a new experiment and not a new algorithm. World D's generating process is unchanged - the
// population, its z, and its phi are identical to Experiment 8's (same seeds). Only two things are
// varied, and both are varied because the review questions ask for exactly that:
//   - the AMOUNT of observation (rounds in the fixture list), question 4
//   - which independent NOISE terms are active (I_bw, R_b,ll), question 3
// Noise suppression is done by copying the population object and clearing those maps inside this
// script, so research/synthetic/generator.js is not touched at all.
//
// Arm C (low-rank without the free interaction term) is used throughout, with K FIXED at the true
// value of 3. The K-selection question is asked separately at the end.
//
// lambdaLowRank IS VARIED, and must be. A first version of this script held it at 20 - the value
// cross-validation selected in Experiment 8 - and every condition returned r_latent ~ 0 with
// sd(fitted latent) ~ 1e-9. At that penalty the bilinear term collapses to the trivial all-zero
// solution, which is an exact fixed point: with U and V both at zero the bilinear gradient is
// identically zero. So the script was re-measuring one dead solution at three data volumes rather
// than testing whether data volume matters. Varying the penalty is required for the question to be
// answerable at all.
//
// Usage: node research/diagnostics/experiment-8-failure-diagnostic.js
const fs = require('fs');
const path = require('path');
const { generatePopulation, generateLeagueMatches, trueProbability, latentTerm, makeRng, LINES, LENGTHS } = require('../synthetic/generator');
const { buildDesign } = require('../models/regularizedHierarchicalLogit');
const { fitOnce, fitWithCrossValidation } = require('../models/lowRankJointLogit');

const BASE_POP = { numBatters: 176, numBowlers: 96, seed: 1, archetypeSignal: true, latentFactors: { K: 3, sigmaPhi: 0.22, mode: 'target' } };
const LEAGUE = { numTeams: 16, battersPerTeam: 11, bowlersPerTeam: 6, rounds: 2, ballsPerInnings: 35, seed: 2 };
const TRUE_K = 3;

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const variance = (a) => { const m = mean(a); return m === null ? null : mean(a.map((x) => (x - m) ** 2)); };
function corr(a, b) {
  const ma = mean(a), mb = mean(b);
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da === 0 || db === 0 ? 0 : n / Math.sqrt(da * db);
}
const logit = (p) => Math.log(p / (1 - p));

/** Suppresses the independent noise terms by clearing their lookup maps on a COPY. trueProbability
 * falls back to 0 for absent keys, so the latent term, player levels, archetype and line/length
 * remain exactly as generated. generator.js is untouched. */
function suppressNoise(pop) {
  return { ...pop, interactions: new Map(), batterLineLengthResponse: new Map() };
}

function makeRows(pop, rounds) {
  const { matches } = generateLeagueMatches({ population: pop, ...LEAGUE, rounds });
  const bStyle = new Map(pop.batters.map((b) => [b._id, b.battingStyle]));
  const wStyle = new Map(pop.bowlers.map((w) => [w._id, w.bowlingStyle]));
  const rows = [];
  for (const m of matches) for (const inn of m.innings) for (const ball of inn.balls) rows.push({
    batterId: ball.batsmanId, bowlerId: ball.bowlerId,
    battingStyle: bStyle.get(ball.batsmanId), bowlingStyle: wStyle.get(ball.bowlerId),
    line: ball.line, length: ball.length, isWicket: ball.isWicket
  });
  return rows;
}

function latentShare(pop) {
  const rng = makeRng(4242);
  const lat = [], tot = [];
  for (let i = 0; i < 40000; i++) {
    const b = rng.pick(pop.batters), w = rng.pick(pop.bowlers), line = rng.pick(LINES), length = rng.pick(LENGTHS);
    lat.push(latentTerm(pop, b._id, line, length, 'target'));
    tot.push(logit(trueProbability(pop, b._id, w._id, line, length)));
  }
  return variance(lat) / variance(tot);
}

function recoverySingleFit(pop, rows, K, lambdaLowRank) {
  const design = buildDesign(rows);
  const sizes = { batter: design.batterIdx.size, bowler: design.bowlerIdx.size, arch: design.archIdx.size, ll: design.llIdx.size, pair: Math.max(design.pairIdx.size, 1) };
  const P = fitOnce(design.encoded, sizes, { K, lambda: 5, lambdaInteraction: 20, lambdaLowRank, useInteraction: false, seed: 11 });
  const fit = [], tru = [];
  for (const b of pop.batters) {
    const bi = design.batterIdx.get(b._id);
    if (bi === undefined) continue;
    for (const line of LINES) for (const length of LENGTHS) {
      const li = design.llIdx.get(`${line}|${length}`);
      if (li === undefined) continue;
      let f = 0;
      for (let k = 0; k < K; k++) f += P.U[bi * K + k] * P.V[li * K + k];
      fit.push(f); tru.push(latentTerm(pop, b._id, line, length, 'target'));
    }
  }
  return { r: corr(fit, tru), iterations: P.iterationsRun, sdFit: Math.sqrt(variance(fit)), sdTrue: Math.sqrt(variance(tru)) };
}

function main() {
  const pop = generatePopulation(BASE_POP);
  const popClean = suppressNoise(pop);
  const out = { generatedAt: new Date().toISOString(), rows: [] };

  console.log('='.repeat(104));
  console.log('Q3/Q4/Q7 - RECOVERY vs OBSERVATION VOLUME and vs NOISE STRUCTURE');
  console.log('  Arm C (low-rank, no free interaction), K FIXED at the true value 3, lambda fixed.');
  console.log('  World D generating process unchanged; only observation count and active noise terms vary.');
  console.log('='.repeat(104));
  console.log(`  ${'noise'.padEnd(20)} ${'rounds'.padStart(6)} ${'balls/bat'.padStart(10)} ${'lambdaLR'.padStart(9)} ${'r_latent'.padStart(9)} ${'sd(fit)/sd(true)'.padStart(17)}`);

  for (const [noiseLabel, P] of [['full (as Exp 8)', pop], ['I and R suppressed', popClean]]) {
    const share = latentShare(P);
    for (const rounds of [2, 8, 32]) {
      const rows = makeRows(P, rounds);
      const perBatter = rows.length / P.batters.length;
      for (const lam of [20, 5, 1]) {
        const t = Date.now();
        const rec = recoverySingleFit(P, rows, TRUE_K, lam);
        out.rows.push({ noise: noiseLabel, rounds, balls: rows.length, perBatter, latentShare: share, lambdaLowRank: lam, ...rec });
        console.log(`  ${noiseLabel.padEnd(20)} ${String(rounds).padStart(6)} ${perBatter.toFixed(0).padStart(10)} ${String(lam).padStart(9)} ${rec.r.toFixed(4).padStart(9)} ${(rec.sdFit / rec.sdTrue).toFixed(4).padStart(17)}   (${((Date.now() - t) / 1000).toFixed(0)}s)`);
      }
    }
  }

  console.log('');
  console.log('='.repeat(104));
  console.log('Q5 - does the selected K collapse toward the true value of 3 as data increases?');
  console.log('='.repeat(104));
  out.kSelection = [];
  for (const rounds of [2, 8]) {
    const rows = makeRows(pop, rounds);
    const t = Date.now();
    const m = fitWithCrossValidation(rows, { useInteraction: false });
    out.kSelection.push({ rounds, balls: rows.length, K: m.K, lambdaLowRank: m.lambdaLowRank });
    console.log(`  rounds=${String(rounds).padStart(2)}  balls=${String(rows.length).padStart(7)}  CV-selected K = ${m.K}   lambdaLowRank = ${m.lambdaLowRank}   (${((Date.now() - t) / 1000).toFixed(0)}s)   [true K = 3]`);
  }

  const outPath = path.join(__dirname, 'experiment-8-failure-diagnostic-results.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nWritten to ${outPath}`);
  console.log('\nDiagnostic only. No new algorithm, no change to World D, no hypothesis verdict.');
}

main();

// Is the activation threshold UNIVERSAL, or does it vary by entity?
//
// The adoption curve asks when the population as a whole starts paying for a latent
// representation. Review's sharper question: within a single fit, is recovery uniform across
// batters, or do some batters become representable long before others?
//
// If recovery is uniform, observation count is the whole story and a global rule is adequate.
// If it is heterogeneous - and especially if it is NOT explained by observation count alone -
// then a global penalty is deciding one thing for entities in very different evidential states.
//
// Diagnostic only. No new algorithm, no change to World D, no hypothesis verdict. Nothing here
// proposes an entity-specific rule; it only measures whether one would have anything to act on.
//
// Usage: node research/diagnostics/per-entity-activation-diagnostic.js
const fs = require('fs');
const path = require('path');
const { generatePopulation, generateLeagueMatches, latentTerm, makeRng, LINES, LENGTHS } = require('../synthetic/generator');
const { buildDesign } = require('../models/regularizedHierarchicalLogit');
const { fitOnce } = require('../models/lowRankJointLogit');

const BASE_POP = { numBatters: 176, numBowlers: 96, seed: 1, archetypeSignal: true, latentFactors: { K: 3, sigmaPhi: 0.22, mode: 'target' } };
const LEAGUE = { numTeams: 16, battersPerTeam: 11, bowlersPerTeam: 6, rounds: 2, ballsPerInnings: 35, seed: 2 };
const TRUE_K = 3;
// lambda=5 is used because it is the smallest FROZEN grid value at which the latent term is live
// at low data volume. It is not tuned here - it comes from Experiment 8's grid.
const LAMBDA_LOWRANK = 5;

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const variance = (a) => { const m = mean(a); return m === null ? null : mean(a.map((x) => (x - m) ** 2)); };
function corr(a, b) {
  const ma = mean(a), mb = mean(b);
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da === 0 || db === 0 ? 0 : n / Math.sqrt(da * db);
}
const quantile = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

function main() {
  const pop = generatePopulation(BASE_POP);
  const bStyle = new Map(pop.batters.map((b) => [b._id, b.battingStyle]));
  const wStyle = new Map(pop.bowlers.map((w) => [w._id, w.bowlingStyle]));
  const out = { generatedAt: new Date().toISOString(), lambdaLowRank: LAMBDA_LOWRANK, volumes: [] };

  for (const rounds of [2, 8]) {
    const { matches } = generateLeagueMatches({ population: pop, ...LEAGUE, rounds });
    const rows = [];
    for (const m of matches) for (const inn of m.innings) for (const ball of inn.balls) rows.push({
      batterId: ball.batsmanId, bowlerId: ball.bowlerId,
      battingStyle: bStyle.get(ball.batsmanId), bowlingStyle: wStyle.get(ball.bowlerId),
      line: ball.line, length: ball.length, isWicket: ball.isWicket
    });
    const nBy = new Map();
    for (const r of rows) nBy.set(r.batterId, (nBy.get(r.batterId) || 0) + 1);

    const design = buildDesign(rows);
    const sizes = { batter: design.batterIdx.size, bowler: design.bowlerIdx.size, arch: design.archIdx.size, ll: design.llIdx.size, pair: Math.max(design.pairIdx.size, 1) };
    const P = fitOnce(design.encoded, sizes, { K: TRUE_K, lambda: 5, lambdaInteraction: 20, lambdaLowRank: LAMBDA_LOWRANK, useInteraction: false, seed: 11 });

    // Per-batter recovery: correlation across that batter's own 42 (line,length) cells.
    const per = [];
    for (const b of pop.batters) {
      const bi = design.batterIdx.get(b._id);
      if (bi === undefined) continue;
      const fit = [], tru = [];
      for (const line of LINES) for (const length of LENGTHS) {
        const li = design.llIdx.get(`${line}|${length}`);
        if (li === undefined) continue;
        let f = 0;
        for (let k = 0; k < TRUE_K; k++) f += P.U[bi * TRUE_K + k] * P.V[li * TRUE_K + k];
        fit.push(f); tru.push(latentTerm(pop, b._id, line, length, 'target'));
      }
      const zb = pop.latent.z.get(b._id);
      per.push({
        id: b._id, n: nBy.get(b._id) || 0, r: corr(fit, tru),
        zNorm: Math.sqrt(zb.reduce((s, x) => s + x * x, 0)),
        sdTrue: Math.sqrt(variance(tru)), sdFit: Math.sqrt(variance(fit))
      });
    }

    const rs = per.map((p) => p.r);
    const ns = per.map((p) => p.n);
    console.log('='.repeat(104));
    console.log(`ROUNDS=${rounds}   mean ${mean(ns).toFixed(0)} balls/batter   lambdaLowRank=${LAMBDA_LOWRANK} (frozen grid value)   pooled r=${corr(per.flatMap((p) => [p.r]), per.flatMap((p) => [p.r])) ? '' : ''}`);
    console.log('='.repeat(104));
    console.log(`  per-batter recovery r:  mean ${mean(rs).toFixed(4)}   sd ${Math.sqrt(variance(rs)).toFixed(4)}`);
    console.log(`     p10 ${quantile(rs, 0.1).toFixed(4)}   p25 ${quantile(rs, 0.25).toFixed(4)}   median ${quantile(rs, 0.5).toFixed(4)}   p75 ${quantile(rs, 0.75).toFixed(4)}   p90 ${quantile(rs, 0.9).toFixed(4)}`);
    console.log(`     fraction with r > 0.5: ${(rs.filter((x) => x > 0.5).length / rs.length * 100).toFixed(1)}%      r < 0: ${(rs.filter((x) => x < 0).length / rs.length * 100).toFixed(1)}%`);
    console.log(`  observation count:      mean ${mean(ns).toFixed(0)}   sd ${Math.sqrt(variance(ns)).toFixed(1)}   range ${Math.min(...ns)}-${Math.max(...ns)}`);
    console.log('');
    console.log(`  IS RECOVERY EXPLAINED BY OBSERVATION COUNT?`);
    console.log(`     corr(r, n)      = ${corr(rs, ns).toFixed(4)}`);
    console.log(`     corr(r, |z_b|)  = ${corr(rs, per.map((p) => p.zNorm)).toFixed(4)}   <- is it the strength of a batter's own latent position instead?`);
    console.log(`     corr(r, sdTrue) = ${corr(rs, per.map((p) => p.sdTrue)).toFixed(4)}   <- or how much their latent surface actually varies?`);
    console.log('');
    console.log(`  recovery by observation-count quartile:`);
    const sortedByN = [...per].sort((a, b) => a.n - b.n);
    for (let q = 0; q < 4; q++) {
      const slice = sortedByN.slice(Math.floor(q * per.length / 4), Math.floor((q + 1) * per.length / 4));
      console.log(`     Q${q + 1}  n ${slice[0].n}-${slice[slice.length - 1].n}   mean r ${mean(slice.map((p) => p.r)).toFixed(4)}   frac r>0.5 ${(slice.filter((p) => p.r > 0.5).length / slice.length * 100).toFixed(0)}%`);
    }
    console.log('');
    out.volumes.push({ rounds, meanN: mean(ns), per });
  }

  const outPath = path.join(__dirname, 'per-entity-activation-results.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`Written to ${outPath}`);
  console.log('\nDiagnostic only. Measures whether an entity-specific rule would have anything to act on.');
  console.log('Does not propose one.');
}

main();

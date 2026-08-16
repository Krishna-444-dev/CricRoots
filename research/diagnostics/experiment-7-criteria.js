// Applies Experiment 7's preregistered criteria G1-G4 mechanically. See experiment-7-design.md §6.
//
// Written BEFORE any Experiment 7 result was readable, same discipline as the Experiment 6
// evaluator. Experiment 5 is why: applying H5's criterion literally reversed the verdict that an
// eyeball reading of the tables had suggested, and that only worked because the criterion and the
// code implementing it both existed independently of the numbers.
//
// Usage: node research/diagnostics/experiment-7-criteria.js
const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.join(__dirname, '..', 'results');
const ARM_A = 'fullHierarchy';
const ARM_B = 'fullHierarchyLOO';
const ARM_C = 'fullHierarchyNoArchetype';
const JOINT = 'jointRegularizedLogit';

const G1_THRESHOLD = 1e-4;     // oracle MAE, per design §6
const MIN_STRATUM_COUNT = 20;  // strata below this are shown but excluded from the trend test
const STRATA = [[0, 0.05], [0.05, 0.10], [0.10, 0.20], [0.20, 0.50], [0.50, 1.0001]];

function findRun(name) {
  const dir = fs.readdirSync(RESULTS_DIR).find((d) => d.startsWith(name + '_'));
  if (!dir) return null;
  return {
    dir,
    summary: JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, dir, 'summary.json'), 'utf8')),
    raw: JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, dir, 'raw-results.json'), 'utf8'))
  };
}

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const mae = (run, m) => run.summary.summary[m].oracleError.mae;
const brier = (run, m) => run.summary.summary[m].brierScore;

function analyse(runName, worldLabel, carriesWeight) {
  const run = findRun(runName);
  if (!run) { console.error(`Missing run ${runName}`); process.exit(2); }

  console.log('\n' + '='.repeat(100));
  console.log(`${runName} - ${worldLabel}${carriesWeight ? '   << carries the evidentiary weight (design §3)' : ''}`);
  console.log('='.repeat(100));

  // ---- Three-arm comparison (G3) -------------------------------------------------------------
  console.log('\nTHREE-ARM COMPARISON (G3 - breaking the H-A / H-B confound)');
  console.log(`  ${'arm'.padEnd(34)} ${'oracle MAE'.padStart(11)} ${'Brier'.padStart(13)} ${'Spearman'.padStart(9)}`);
  for (const [label, m] of [['A  fullHierarchy (contaminated)', ARM_A], ['B  fullHierarchyLOO', ARM_B], ['C  fullHierarchyNoArchetype', ARM_C], ['   jointRegularizedLogit (ref)', JOINT]]) {
    console.log(`  ${label.padEnd(34)} ${mae(run, m).toFixed(4).padStart(11)} ${brier(run, m).toFixed(8).padStart(13)} ${run.summary.summary[m].spearmanCorrelation.toFixed(4).padStart(9)}`);
  }
  const maeA = mae(run, ARM_A), maeB = mae(run, ARM_B), maeC = mae(run, ARM_C);
  const span = maeA - maeC;
  const positionOfB = span !== 0 ? (maeA - maeB) / span : null;
  console.log(`\n  A - C span in oracle MAE: ${span.toFixed(6)}`);
  console.log(`  B sits ${positionOfB === null ? 'n/a' : (positionOfB * 100).toFixed(1) + '% of the way from A to C'}`);
  console.log(`  => ${positionOfB === null ? 'n/a' : positionOfB > 0.7 ? 'near C: contamination explains most of the deficit' : positionOfB < 0.3 ? 'near A: archetype noise dominates' : 'between: both mechanisms contribute'}`);

  // ---- G1 ------------------------------------------------------------------------------------
  console.log(`\nG1 - does removing contamination help?  (arm B oracle MAE lower than arm A by > ${G1_THRESHOLD})`);
  const g1Delta = maeA - maeB;
  console.log(`  arm A ${maeA.toFixed(6)}   arm B ${maeB.toFixed(6)}   improvement ${g1Delta >= 0 ? '+' : ''}${g1Delta.toExponential(3)}`);
  const g1 = g1Delta > G1_THRESHOLD;
  console.log(`  G1: ${g1 ? 'MET' : 'NOT MET'}${carriesWeight ? '' : '   (World A is not decisive - see design §3)'}`);

  // ---- G2 mechanism ----------------------------------------------------------------------------
  console.log('\nG2 - is the mechanism the claimed one?  achieved shrinkage S = |p_exact_raw - p_final|');
  const byKey = (m) => new Map(run.raw.filter((r) => r.method === m).map((r) => [`${r.matchIdx}|${r.globalBallCounter}`, r]));
  const rowsA = byKey(ARM_A), rowsB = byKey(ARM_B);
  const checkpoints = [...rowsA.keys()];

  // Design §5: restricted to checkpoints where the exact level actually participates in the blend.
  const eligible = [], noEvidence = [];
  for (const k of checkpoints) {
    const a = rowsA.get(k), b = rowsB.get(k);
    if (!a || !b || a.exactBucketN === undefined) continue;
    if (a.exactBucketN > 0 && a.exactBucketRate !== null && a.prediction !== null && b.prediction !== null) {
      eligible.push({
        r: a.bVsArchBucketN > 0 ? a.exactBucketN / a.bVsArchBucketN : 0,
        SA: Math.abs(a.exactBucketRate - a.prediction),
        SB: Math.abs(a.exactBucketRate - b.prediction)
      });
    } else {
      noEvidence.push(k);
    }
  }
  console.log(`  eligible checkpoints (exact level participates): ${eligible.length}`);
  console.log(`  reported separately as coverage, NOT folded into strata: ${noEvidence.length} with no exact-bucket evidence`);
  if (eligible.length === 0) {
    console.log('  G2: CANNOT BE EVALUATED - no checkpoint has bucket-level exact evidence.');
    return { runName, g1, g2: null, positionOfB, eligible: 0 };
  }

  console.log(`\n  ${'overlap r'.padEnd(12)} ${'n'.padStart(6)} ${'mean S_A'.padStart(11)} ${'mean S_B'.padStart(11)} ${'mean dS'.padStart(12)} ${'median dS'.padStart(12)}`);
  const strataStats = [];
  for (const [lo, hi] of STRATA) {
    const inBin = eligible.filter((e) => e.r >= lo && e.r < hi);
    const label = `${(lo * 100).toFixed(0)}-${(hi * 100).toFixed(0)}%`;
    if (inBin.length === 0) { console.log(`  ${label.padEnd(12)} ${'0'.padStart(6)}`); continue; }
    const dS = inBin.map((e) => e.SB - e.SA);
    const rec = { label, n: inBin.length, meanSA: mean(inBin.map((e) => e.SA)), meanSB: mean(inBin.map((e) => e.SB)), meanDS: mean(dS), medianDS: median(dS) };
    strataStats.push(rec);
    console.log(`  ${label.padEnd(12)} ${String(rec.n).padStart(6)} ${rec.meanSA.toFixed(6).padStart(11)} ${rec.meanSB.toFixed(6).padStart(11)} ${((rec.meanDS >= 0 ? '+' : '') + rec.meanDS.toExponential(2)).padStart(12)} ${((rec.medianDS >= 0 ? '+' : '') + rec.medianDS.toExponential(2)).padStart(12)}`);
  }

  const overallDS = mean(eligible.map((e) => e.SB - e.SA));
  console.log(`\n  overall mean dS = ${overallDS >= 0 ? '+' : ''}${overallDS.toExponential(3)}   (H9 predicts > 0: arm A under-shrinks)`);

  const qualifying = strataStats.filter((s) => s.n >= MIN_STRATUM_COUNT);
  console.log(`  strata meeting the minimum count of ${MIN_STRATUM_COUNT}: ${qualifying.length} (${qualifying.map((s) => s.label).join(', ') || 'none'})`);
  let nonDecreasing = true;
  for (let i = 1; i < qualifying.length; i++) if (qualifying[i].meanDS < qualifying[i - 1].meanDS) nonDecreasing = false;
  const highest = qualifying[qualifying.length - 1];
  const g2 = qualifying.length >= 2 && overallDS > 0 && nonDecreasing && highest && highest.meanDS > 0;
  console.log(`  non-decreasing across qualifying strata: ${qualifying.length >= 2 ? (nonDecreasing ? 'YES' : 'NO') : 'insufficient strata to test'}`);
  console.log(`  highest qualifying stratum dS > 0: ${highest ? (highest.meanDS > 0 ? 'YES' : 'NO') : 'n/a'}`);
  console.log(`\n  G2: ${g2 ? 'MET' : 'NOT MET'}`);

  // ---- G4 --------------------------------------------------------------------------------------
  console.log('\nG4 - does the corrected hierarchy become competitive with joint estimation?  (preregistered EXPECTED TO FAIL)');
  const maeJ = mae(run, JOINT);
  console.log(`  arm B ${maeB.toFixed(6)}   joint ${maeJ.toFixed(6)}   gap ${(maeB - maeJ).toExponential(3)}`);
  console.log(`  G4: ${maeB <= maeJ ? 'MET (unexpected - report prominently)' : 'NOT MET (as expected)'}`);

  return { runName, g1, g2, positionOfB, eligible: eligible.length };
}

const a = analyse('7-A', 'World A (archetype uninformative)', false);
const b = analyse('7-B', 'World B (archetype = 8.84% of variance)', true);

console.log('\n' + '='.repeat(100));
console.log('H9 VERDICT');
console.log('='.repeat(100));
console.log('  Design §6: G1 AND G2 must BOTH hold, in World B, for H9 to be supported.');
console.log(`  World B  G1: ${b.g1 ? 'MET' : 'NOT MET'}   G2: ${b.g2 === null ? 'NOT EVALUABLE' : b.g2 ? 'MET' : 'NOT MET'}`);
console.log(`  World A  G1: ${a.g1 ? 'MET' : 'NOT MET'}   G2: ${a.g2 === null ? 'NOT EVALUABLE' : a.g2 ? 'MET' : 'NOT MET'}   (not decisive by design)`);
console.log('');
if (b.g1 && b.g2) console.log('  => H9 SUPPORTED: arm B improves AND shows the predicted under-shrinkage signature.');
else if (b.g1 && b.g2 === false) console.log('  => H9 REJECTED AS THE MECHANISM: arm B improves, but WITHOUT the shrinkage signature.');
else if (!b.g1) console.log('  => H9 UNSUPPORTED: removing contamination did not measurably help where archetype carries signal.');
else console.log('  => INCONCLUSIVE - see G2 evaluability above.');
console.log('\nNo interpretation beyond the preregistered criteria.');
console.log('='.repeat(100));

// Applies Experiment 6's preregistered criteria F1-F4 mechanically, plus the C0a->C0b split
// effect and the C0b->drift degradations. See research/experiment-6-design.md section 9.
//
// Written BEFORE any Experiment 6 result was readable, for the same reason the criteria themselves
// were: so the arithmetic that decides pass/fail is fixed in advance rather than assembled around
// whatever the numbers turn out to be. Experiment 5 showed this matters - applying H5's criterion
// literally reversed the verdict an eyeball reading of the tables had suggested.
//
// This script decides nothing about F5 (descriptive) and does not touch the temporal-block
// analysis (separate script, deliberately outside the pass/fail path).
//
// Usage: node research/diagnostics/experiment-6-criteria.js
const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.join(__dirname, '..', 'results');

// Measured optimizer-noise floor (Experiment 5: truncated vs converged fit, everything else
// identical). All thresholds in the design are expressed as multiples of this.
const NOISE_FLOOR = 8.7e-7;
const THRESHOLD = 100 * NOISE_FLOOR; // 8.7e-5

// global is excluded from F1's pass/fail by the pre-run amendment: mean-zero drift leaves its
// population-average target invariant by construction. singleLevelShrinkage is only weakly
// entity-dependent at this sparsity (k=15 gives individual data <=16% of blend weight for 86% of
// checkpoints; Experiment 5 measured it within 4.3e-6 of global), so F1 is additionally reported
// with it excluded - the design says F1 must not be considered met on its strength alone.
const EXCLUDED_FROM_F1 = new Set(['global']);
const WEAKLY_ENTITY_DEPENDENT = new Set(['singleLevelShrinkage', 'fullHierarchyNoArchetype']);

function loadRuns() {
  const runs = {};
  for (const dir of fs.readdirSync(RESULTS_DIR)) {
    if (!dir.startsWith('6-')) continue;
    const summaryPath = path.join(RESULTS_DIR, dir, 'summary.json');
    if (!fs.existsSync(summaryPath)) continue;
    const j = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    runs[j.runName] = { dir, ...j };
  }
  return runs;
}

function brier(run, method) {
  const s = run.summary[method];
  return s ? s.brierScore : null;
}

function fmt(x, digits = 8) {
  if (x === null || x === undefined) return 'n/a';
  return x.toFixed(digits);
}

function main() {
  const runs = loadRuns();
  const expected = ['6-C0a', '6-C0b', '6-C1', '6-C2', '6-C3', '6-C4-mild', '6-C4-mod', '6-C4-stress'];
  const missing = expected.filter((r) => !runs[r]);
  if (missing.length > 0) {
    console.error(`Missing runs: ${missing.join(', ')}. All 8 must complete before criteria are evaluated.`);
    process.exit(2);
  }

  const methods = Object.keys(runs['6-C0b'].summary);

  // Guard: every run must have converged, or its joint-model numbers are not trustworthy (D13/D16).
  console.log('='.repeat(96));
  console.log('CONVERGENCE GUARD (D13/D16) - joint fit must not have hit the iteration cap');
  console.log('='.repeat(96));
  let allConverged = true;
  for (const r of expected) {
    const jm = runs[r].meta.jointModel || {};
    const ok = jm.hitIterationCap === false;
    allConverged = allConverged && ok;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${r.padEnd(14)} iterations=${String(jm.finalFitIterations).padStart(6)}  lambda=${jm.chosenLambda}`);
  }
  if (!allConverged) console.log('\n  ** At least one run did not converge. Do not interpret its scores. **');

  // --- C0a -> C0b : the split effect, isolated -----------------------------------------------
  console.log('');
  console.log('='.repeat(96));
  console.log('SPLIT EFFECT (C0a random -> C0b temporal, both stationary). Not a drift result.');
  console.log('='.repeat(96));
  console.log(`  ${'method'.padEnd(30)} ${'C0a Brier'.padStart(12)} ${'C0b Brier'.padStart(12)} ${'delta'.padStart(12)}`);
  const c0aRank = [...methods].sort((a, b) => (brier(runs['6-C0a'], a) ?? 9) - (brier(runs['6-C0a'], b) ?? 9));
  const c0bRank = [...methods].sort((a, b) => (brier(runs['6-C0b'], a) ?? 9) - (brier(runs['6-C0b'], b) ?? 9));
  for (const m of methods) {
    const a = brier(runs['6-C0a'], m), b = brier(runs['6-C0b'], m);
    console.log(`  ${m.padEnd(30)} ${fmt(a).padStart(12)} ${fmt(b).padStart(12)} ${(b !== null && a !== null ? (b - a >= 0 ? '+' : '') + (b - a).toExponential(3) : 'n/a').padStart(12)}`);
  }
  console.log(`\n  Method ordering under C0a: ${c0aRank.join(' > ')}`);
  console.log(`  Method ordering under C0b: ${c0bRank.join(' > ')}`);
  const orderingChanged = c0aRank.join('|') !== c0bRank.join('|');
  console.log(`  Ordering changed by the split: ${orderingChanged ? 'YES - must be reported before any drift result is interpreted' : 'no'}`);

  // --- Degradation table: D_m(M) = Brier_m(M) - Brier_C0b(M) ---------------------------------
  const driftRuns = ['6-C1', '6-C2', '6-C3', '6-C4-mild', '6-C4-mod', '6-C4-stress'];
  const D = (run, m) => {
    const a = brier(runs[run], m), b = brier(runs['6-C0b'], m);
    return a === null || b === null ? null : a - b;
  };

  console.log('');
  console.log('='.repeat(96));
  console.log('DEGRADATION FROM C0b:  D_m(M) = Brier_m(M) - Brier_C0b(M)   (positive = worse under drift)');
  console.log('='.repeat(96));
  console.log(`  ${'method'.padEnd(30)}${driftRuns.map((r) => r.replace('6-', '').padStart(13)).join('')}`);
  for (const m of methods) {
    const cells = driftRuns.map((r) => {
      const d = D(r, m);
      return (d === null ? 'n/a' : (d >= 0 ? '+' : '') + d.toExponential(2)).padStart(13);
    });
    const tag = EXCLUDED_FROM_F1.has(m) ? ' [excl. F1]' : WEAKLY_ENTITY_DEPENDENT.has(m) ? ' [weak]' : '';
    console.log(`  ${(m + tag).padEnd(30)}${cells.join('')}`);
  }

  // --- F1 -------------------------------------------------------------------------------------
  console.log('');
  console.log('='.repeat(96));
  console.log(`F1 - does drift damage ENTITY-DEPENDENT prediction?  (threshold ${THRESHOLD.toExponential(2)})`);
  console.log('='.repeat(96));
  const f1Candidates = methods.filter((m) => !EXCLUDED_FROM_F1.has(m));
  const f1Passers = f1Candidates.filter((m) => (D('6-C4-stress', m) ?? -1) > THRESHOLD);
  const f1Strict = f1Passers.filter((m) => !WEAKLY_ENTITY_DEPENDENT.has(m));
  for (const m of f1Candidates) {
    const d = D('6-C4-stress', m);
    const passes = (d ?? -1) > THRESHOLD;
    console.log(`  ${passes ? 'over ' : '     '} ${m.padEnd(30)} D_1.00 = ${d === null ? 'n/a' : (d >= 0 ? '+' : '') + d.toExponential(3)}`);
  }
  console.log(`\n  F1 (any entity-dependent method): ${f1Passers.length > 0 ? 'MET' : 'NOT MET'} - ${f1Passers.length} of ${f1Candidates.length} exceed threshold`);
  console.log(`  F1 (excluding weakly entity-dependent): ${f1Strict.length > 0 ? 'MET' : 'NOT MET'} - ${f1Strict.length} method(s): ${f1Strict.join(', ') || 'none'}`);
  console.log('  (global excluded by the pre-run amendment; its behaviour is in the tables above)');

  // --- F2 -------------------------------------------------------------------------------------
  console.log('');
  console.log('='.repeat(96));
  console.log('F2 - is the joint model differentially FRAGILE under drift?');
  console.log('='.repeat(96));
  const dJoint = D('6-C4-stress', 'jointRegularizedLogit');
  const dSingle = D('6-C4-stress', 'singleLevelShrinkage');
  const gap = dJoint !== null && dSingle !== null ? dJoint - dSingle : null;
  console.log(`  D_1.00(jointRegularizedLogit)  = ${dJoint === null ? 'n/a' : dJoint.toExponential(3)}`);
  console.log(`  D_1.00(singleLevelShrinkage)   = ${dSingle === null ? 'n/a' : dSingle.toExponential(3)}`);
  console.log(`  difference                     = ${gap === null ? 'n/a' : (gap >= 0 ? '+' : '') + gap.toExponential(3)}`);
  console.log(`\n  Joint model differentially fragile: ${gap !== null && gap > THRESHOLD ? 'YES - report as a finding against the current direction' : 'no'}`);

  // --- F3 -------------------------------------------------------------------------------------
  console.log('');
  console.log('='.repeat(96));
  console.log('F3 - does online adaptation help MORE as drift increases?  A(m) = Brier(offline) - Brier(online)');
  console.log('='.repeat(96));
  const doseRuns = [['0.00', '6-C0b'], ['0.25', '6-C4-mild'], ['0.50', '6-C4-mod'], ['1.00', '6-C4-stress']];
  const A = [];
  for (const [label, run] of doseRuns) {
    const off = brier(runs[run], 'jointRegularizedLogit');
    const on = brier(runs[run], 'jointRegularizedLogitOnline');
    const a = off !== null && on !== null ? off - on : null;
    A.push(a);
    console.log(`  m=${label}  offline ${fmt(off)}  online ${fmt(on)}  A(m) = ${a === null ? 'n/a' : (a >= 0 ? '+' : '') + a.toExponential(3)}`);
  }
  let monotone = true;
  for (let i = 1; i < A.length; i++) if (A[i] === null || A[i - 1] === null || A[i] < A[i - 1]) monotone = false;
  const growth = A[3] !== null && A[0] !== null ? A[3] - A[0] : null;
  console.log(`\n  Monotonically non-decreasing across m: ${monotone ? 'YES' : 'NO'}`);
  console.log(`  A(1.00) - A(0) = ${growth === null ? 'n/a' : (growth >= 0 ? '+' : '') + growth.toExponential(3)}  (needs > ${THRESHOLD.toExponential(2)})`);
  console.log(`\n  F3: ${monotone && growth !== null && growth > THRESHOLD ? 'SUPPORTED' : 'NOT SUPPORTED'}`);

  // --- F4 -------------------------------------------------------------------------------------
  console.log('');
  console.log('='.repeat(96));
  console.log('F4 - is drift a DISCRIMINATOR between formulations?');
  console.log('='.repeat(96));
  const absGap = gap === null ? null : Math.abs(gap);
  console.log(`  |D_1.00(joint) - D_1.00(singleLevelShrinkage)| = ${absGap === null ? 'n/a' : absGap.toExponential(3)}  (threshold ${THRESHOLD.toExponential(2)})`);
  console.log(`\n  Drift discriminates between formulations: ${absGap !== null && absGap > THRESHOLD ? 'YES' : 'NO - both degrade comparably; drift alone does not motivate a new algorithm'}`);

  // --- F5 (DESCRIPTIVE ONLY) --------------------------------------------------------------------
  console.log('');
  console.log('='.repeat(96));
  console.log('F5 - which drift type dominates?  DESCRIPTIVE ONLY - may not be promoted into a claim');
  console.log('='.repeat(96));
  console.log(`  ${'method'.padEnd(30)}${['6-C1 player', '6-C2 interact', '6-C3 context'].map((h) => h.padStart(15)).join('')}`);
  for (const m of methods) {
    const cells = ['6-C1', '6-C2', '6-C3'].map((r) => {
      const d = D(r, m);
      return (d === null ? 'n/a' : (d >= 0 ? '+' : '') + d.toExponential(2)).padStart(15);
    });
    console.log(`  ${m.padEnd(30)}${cells.join('')}`);
  }

  console.log('');
  console.log('='.repeat(96));
  console.log('No interpretation applied. F1-F4 are the preregistered tests; F5 and the temporal-block');
  console.log('analysis (separate script) are descriptive and cannot be promoted into claims.');
  console.log('='.repeat(96));
}

main();

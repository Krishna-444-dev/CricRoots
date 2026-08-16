// Verifies the two things that must hold BEFORE any Experiment 5 score is worth reading:
//
//   1. INFORMATION FLOW - what each method could actually see at prediction time.
//   2. UPDATE MECHANICS - whether the online model genuinely updated after each revealed ball,
//      and whether the per-test-match reset genuinely reset it.
//
// If the online model silently failed to update, or leaked state across held-out matches, the
// comparison is meaningless no matter which score is lowest - and both failure modes produce
// perfectly plausible-looking numbers. So these checks are mechanical and run first.
//
// Everything here is derived from the committed raw-results.json, not from instrumentation added
// to a special run - so it verifies the actual experiment that produced the reported numbers.
//
// Usage: node research/diagnostics/verify-information-flow.js <results-dir> [<results-dir> ...]
const fs = require('fs');
const path = require('path');

const OFFLINE = 'jointRegularizedLogit';
const ONLINE = 'jointRegularizedLogitOnline';

// Fidelity of the online optimizer to a fully converged cold refit, measured in
// research/models/online-fidelity-check.js (decision D14). Differences below this are optimizer
// noise, not evidence of learning.
const FIDELITY_TOLERANCE = 5.7e-5;

function key(row) {
  return `${row.matchIdx}|${row.globalBallCounter}`;
}

function check(label, passed, detail) {
  console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${label}`);
  if (detail) console.log(`         ${detail}`);
  return passed;
}

function verify(dir) {
  const summary = JSON.parse(fs.readFileSync(path.join(dir, 'summary.json'), 'utf8'));
  const raw = JSON.parse(fs.readFileSync(path.join(dir, 'raw-results.json'), 'utf8'));
  const world = summary.meta.archetypeSignal ? 'World B (archetypeSignal: true)' : 'World A (archetypeSignal: false)';

  console.log(`\n${'='.repeat(78)}`);
  console.log(`${path.basename(dir)} - ${world}`);
  console.log(`${'='.repeat(78)}`);

  const byMethod = new Map();
  for (const row of raw) {
    if (!byMethod.has(row.method)) byMethod.set(row.method, []);
    byMethod.get(row.method).push(row);
  }

  // ---- 1. INFORMATION FLOW ------------------------------------------------------------
  console.log('\n1. INFORMATION FLOW - what each method could see at prediction time\n');
  const jm = summary.meta.jointModel || {};
  // Runs produced before decision D13 have no convergence instrumentation at all. Those runs used
  // the non-converged fixed-300-iteration optimizer, so their joint-model numbers carry a ~1.3e-4
  // Brier uncertainty. Silence here would be the worst outcome: it would read as a clean pass.
  const preD13 = jm.hitIterationCap === undefined;
  console.log(`  Training matches: ${summary.meta.numTrainMatches}   Test matches: ${summary.meta.numTestMatches}`);
  console.log(`  Joint model training rows: ${jm.trainingRowCount}   lambda: ${jm.chosenLambda} (CV over training rows only)`);
  if (preD13) {
    console.log('  Base fit iterations: NOT RECORDED - this run predates the convergence fix (D13)');
  } else {
    console.log(`  Base fit iterations: ${jm.finalFitIterations}   hit iteration cap: ${jm.hitIterationCap}`);
    console.log(`  Online budget: ${jm.onlineIterationsPerBall} Adam iterations per revealed ball`);
  }
  console.log('');

  console.log('  method                        | data source at prediction time');
  console.log('  ------------------------------|--------------------------------------------------');
  const SOURCES = {
    global: 'DB: all training balls (no player identity)',
    rawExactMatchup: 'DB: this exact pair, this exact line/length bucket',
    singleLevelShrinkage: 'DB: exact pair + global, blended k=15',
    archetypeOnly: 'DB: archetype x archetype pool',
    fullHierarchyNoArchetype: 'DB: exact pair + global via real hierarchicalBlend',
    oracleArchetypeOnly: 'ORACLE: hidden ground truth (diagnostic upper bound)',
    oracleInformedHierarchy: 'ORACLE prior + DB exact pair (diagnostic upper bound)',
    [OFFLINE]: 'Fitted once on training rows; NO within-match balls',
    [ONLINE]: 'Training rows + every revealed ball of THIS match',
    fullHierarchy: 'DB: 4-level chain via real getMatchupPlan'
  };
  for (const method of byMethod.keys()) {
    console.log(`  ${method.padEnd(29)} | ${SOURCES[method] || 'UNDOCUMENTED - investigate'}`);
  }

  let allPassed = true;

  console.log('\n  Checks:');
  // Every DB-querying method must be evaluated at exactly the same checkpoints.
  const checkpointCounts = [...byMethod.entries()].map(([m, rows]) => `${m}:${rows.length}`);
  const distinctCounts = new Set([...byMethod.values()].map((rows) => rows.length));
  allPassed &= check(
    'every method evaluated at an identical number of checkpoints',
    distinctCounts.size === 1,
    checkpointCounts.join('  ')
  );

  // withinMatchBallsRevealed is the harness's own record of how much live evidence existed.
  const offlineRows = byMethod.get(OFFLINE) || [];
  const onlineRows = byMethod.get(ONLINE) || [];
  const meanRevealed = offlineRows.reduce((s, r) => s + r.withinMatchBallsRevealed, 0) / (offlineRows.length || 1);
  console.log(`         mean within-match balls available per checkpoint: ${meanRevealed.toFixed(1)}`);

  if (preD13) {
    allPassed &= check(
      'joint-model fit convergence is verifiable from the results file (D13)',
      false,
      'this run predates the convergence fix: it used the fixed 300-iteration optimizer, so its ' +
      'joint-model Brier values carry ~1.3e-4 uncertainty (~23% of the reported margin). ' +
      'Ordering may hold; precise values must not be cited.'
    );
  }

  if (onlineRows.length === 0) {
    console.log('\n  (no online method in this run - Experiment 4 or earlier; skipping update-mechanics checks)');
    return Boolean(allPassed);
  }

  // ---- 2. UPDATE MECHANICS ------------------------------------------------------------
  console.log('\n2. UPDATE MECHANICS - did the online model actually update, and actually reset?\n');

  const offlineByKey = new Map(offlineRows.map((r) => [key(r), r]));
  const paired = onlineRows
    .map((r) => ({ online: r, offline: offlineByKey.get(key(r)) }))
    .filter((p) => p.offline);

  allPassed &= check(
    'online and offline rows pair up 1:1 on (matchIdx, globalBallCounter)',
    paired.length === onlineRows.length,
    `${paired.length} paired of ${onlineRows.length} online rows`
  );

  // INVARIANT A - the per-match reset. At the first checkpoint of each test match the online
  // model has observed nothing, so it MUST predict exactly what the fit-once model predicts. Any
  // difference means state survived from the previous test match: cross-match leakage.
  const firstOfMatch = paired.filter((p) => p.online.withinMatchBallsRevealed === 0);
  const resetViolations = firstOfMatch.filter((p) => Math.abs(p.online.prediction - p.offline.prediction) > 1e-12);
  const worstReset = firstOfMatch.reduce((m, p) => Math.max(m, Math.abs(p.online.prediction - p.offline.prediction)), 0);
  allPassed &= check(
    'per-match reset: online == offline exactly at each test match\'s first ball (no cross-match leakage)',
    resetViolations.length === 0,
    `${firstOfMatch.length} test-match starts checked, ${resetViolations.length} violations, max deviation ${worstReset.toExponential(2)}`
  );

  // INVARIANT B - updates actually happen. After balls have been revealed, the online model must
  // differ from the fit-once model by more than optimizer noise, or it never learned anything.
  const afterEvidence = paired.filter((p) => p.online.withinMatchBallsRevealed >= 10);
  const diffs = afterEvidence.map((p) => Math.abs(p.online.prediction - p.offline.prediction));
  const meanDiff = diffs.reduce((s, d) => s + d, 0) / (diffs.length || 1);
  const movedFraction = diffs.filter((d) => d > FIDELITY_TOLERANCE).length / (diffs.length || 1);
  allPassed &= check(
    'online model genuinely diverges from the fit-once model once evidence exists',
    movedFraction > 0.5 && meanDiff > FIDELITY_TOLERANCE,
    `after >=10 revealed balls: mean |online - offline| = ${meanDiff.toExponential(3)}, ` +
    `${(movedFraction * 100).toFixed(1)}% of checkpoints moved more than the ${FIDELITY_TOLERANCE.toExponential(1)} fidelity tolerance`
  );

  // INVARIANT C - divergence grows with evidence. If updates were happening but had no cumulative
  // effect, divergence would be flat in the number of revealed balls.
  const buckets = [[0, 0], [1, 9], [10, 24], [25, 49], [50, Infinity]];
  console.log('\n         divergence from the fit-once model, by within-match evidence:');
  const bucketMeans = [];
  for (const [lo, hi] of buckets) {
    const inBucket = paired.filter((p) => p.online.withinMatchBallsRevealed >= lo && p.online.withinMatchBallsRevealed <= hi);
    if (inBucket.length === 0) continue;
    const mean = inBucket.reduce((s, p) => s + Math.abs(p.online.prediction - p.offline.prediction), 0) / inBucket.length;
    bucketMeans.push(mean);
    const label = hi === Infinity ? `${lo}+` : lo === hi ? `${lo}` : `${lo}-${hi}`;
    console.log(`           ${label.padStart(6)} balls revealed (n=${String(inBucket.length).padStart(5)}): mean |online - offline| = ${mean.toExponential(3)}`);
  }
  const growing = bucketMeans.length >= 2 && bucketMeans[bucketMeans.length - 1] > bucketMeans[0];
  allPassed &= check(
    'divergence grows with accumulated within-match evidence',
    growing,
    growing ? 'monotone-ish increase from first to last bucket' : 'divergence is flat or shrinking - updates may not be accumulating'
  );

  // INVARIANT D - the online model must never differ at a checkpoint it has no evidence for
  // BEYOND what it legitimately observed. Sanity check that no online prediction is NaN/out of range.
  const invalid = onlineRows.filter((r) => !(r.prediction > 0 && r.prediction < 1));
  allPassed &= check(
    'all online predictions are valid probabilities in (0,1)',
    invalid.length === 0,
    `${invalid.length} invalid of ${onlineRows.length}`
  );

  // Convergence guard from D13 - a non-converged base fit invalidates the numbers regardless.
  allPassed &= check(
    'base joint fit converged rather than hitting the iteration cap (D13)',
    jm.hitIterationCap === false,
    `finalFitIterations=${jm.finalFitIterations}, hitIterationCap=${jm.hitIterationCap}`
  );

  return Boolean(allPassed);
}

const dirs = process.argv.slice(2);
if (dirs.length === 0) {
  console.error('Usage: node research/diagnostics/verify-information-flow.js <results-dir> [...]');
  process.exit(2);
}
let ok = true;
for (const dir of dirs) ok = verify(dir) && ok;
console.log(`\n${'='.repeat(78)}`);
console.log(ok ? 'ALL MECHANICAL CHECKS PASSED - results are safe to read.' : 'SOME CHECKS FAILED - do not interpret the scores until resolved.');
console.log(`${'='.repeat(78)}\n`);
process.exit(ok ? 0 : 1);

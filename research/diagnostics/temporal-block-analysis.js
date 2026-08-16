// DESCRIPTIVE ONLY - review modification 6, experiment-6-design.md section 8.
//
// Breaks the online-vs-offline Brier improvement down by temporal block within the test period.
// F3 compares AGGREGATE Brier, and a method could improve on aggregate while getting worse in
// precisely the late test period where drift is strongest - which would make F3 misleading in
// exactly the case Experiment 6 exists to study. This surfaces that.
//
// This script deliberately lives OUTSIDE research/metrics.js. Two reasons: metrics.js stays
// byte-identical across every experiment to date, so no earlier result becomes non-reproducible;
// and the descriptive-only status of this breakdown is then structural rather than a promise -
// nothing in the pass/fail path can reach it.
//
// It MUST NOT be promoted into a pass/fail criterion, before or after seeing results.
//
// Usage: node research/diagnostics/temporal-block-analysis.js <results-dir> [<results-dir> ...]
const fs = require('fs');
const path = require('path');

const OFFLINE = 'jointRegularizedLogit';
const ONLINE = 'jointRegularizedLogitOnline';
const NUM_BLOCKS = 3;

function brier(rows) {
  const usable = rows.filter((r) => r.prediction !== null && r.prediction !== undefined);
  if (usable.length === 0) return null;
  return usable.reduce((s, r) => s + (r.prediction - r.trueOutcome) ** 2, 0) / usable.length;
}

function analyse(dir) {
  const summary = JSON.parse(fs.readFileSync(path.join(dir, 'summary.json'), 'utf8'));
  const raw = JSON.parse(fs.readFileSync(path.join(dir, 'raw-results.json'), 'utf8'));
  const meta = summary.meta;
  const drift = meta.drift ? `${meta.drift.types.join('+')} @ m=${meta.drift.magnitude}` : 'none (stationary)';

  console.log(`\n${'='.repeat(88)}`);
  console.log(`${path.basename(dir)}   split=${meta.splitMode || 'random'}   drift=${drift}`);
  console.log(`${'='.repeat(88)}`);

  const offline = raw.filter((r) => r.method === OFFLINE);
  const online = raw.filter((r) => r.method === ONLINE);
  if (offline.length === 0 || online.length === 0) {
    console.log('  (run contains no online method - nothing to break down)');
    return;
  }

  // testMatchIndex is recorded per row by the harness; fall back to matchIdx for older runs.
  const idxOf = (r) => (r.testMatchIndex !== undefined ? r.testMatchIndex : r.matchIdx);
  const maxIdx = Math.max(...offline.map(idxOf));
  const blockOf = (r) => Math.min(NUM_BLOCKS - 1, Math.floor((idxOf(r) / (maxIdx + 1)) * NUM_BLOCKS));

  console.log('  block           test matches   n     offline Brier   online Brier    improvement');
  console.log('  --------------  -------------  ----  --------------  --------------  -----------');
  const improvements = [];
  for (let b = 0; b < NUM_BLOCKS; b++) {
    const off = offline.filter((r) => blockOf(r) === b);
    const on = online.filter((r) => blockOf(r) === b);
    if (off.length === 0) continue;
    const idxs = off.map(idxOf);
    const bOff = brier(off), bOn = brier(on);
    const imp = bOff - bOn;
    improvements.push(imp);
    const label = ['early', 'middle', 'late'][b] || `block ${b}`;
    console.log(`  ${label.padEnd(14)}  ${String(Math.min(...idxs)).padStart(3)}-${String(Math.max(...idxs)).padEnd(9)}  ${String(off.length).padStart(4)}  ${bOff.toFixed(8)}      ${bOn.toFixed(8)}      ${imp >= 0 ? '+' : ''}${imp.toExponential(3)}`);
  }

  const aggregate = brier(offline) - brier(online);
  console.log(`  ${'aggregate'.padEnd(14)}  ${'all'.padEnd(13)}  ${String(offline.length).padStart(4)}  ${brier(offline).toFixed(8)}      ${brier(online).toFixed(8)}      ${aggregate >= 0 ? '+' : ''}${aggregate.toExponential(3)}`);

  const growing = improvements.length >= 2 && improvements[improvements.length - 1] > improvements[0];
  const anyNegative = improvements.some((i) => i < 0);
  console.log('');
  console.log(`  Improvement grows early -> late: ${growing ? 'yes' : 'NO'}`);
  if (anyNegative) {
    console.log('  NOTE: at least one block shows online performing WORSE than offline, while the');
    console.log('        aggregate may still be positive. This is the situation that would make F3');
    console.log('        misleading - report it alongside F3 rather than in place of it.');
  }
  console.log('  (descriptive only - this cannot support or overturn F3)');
}

const dirs = process.argv.slice(2);
if (dirs.length === 0) {
  console.error('Usage: node research/diagnostics/temporal-block-analysis.js <results-dir> [...]');
  process.exit(2);
}
for (const d of dirs) analyse(d);
console.log('');

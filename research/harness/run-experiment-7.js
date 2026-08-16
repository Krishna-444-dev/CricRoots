// Experiment 7 runner - H9, nested-pool contamination. See research/experiment-7-design.md.
//
//   node research/harness/run-experiment-7.js 7-A     (World A)
//   node research/harness/run-experiment-7.js 7-B     (World B - carries the evidentiary weight)
//
// Config is identical to Experiments 4/5 (random split, same seeds) so results are directly
// comparable to those. Adds one method - fullHierarchyLOO, arm B - and enables the per-checkpoint
// nesting diagnostics needed for the G2 mechanism test.
//
// Metrics only, no interpretation.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { runExperiment } = require('./evaluate');
const { summarizeByMethod } = require('../metrics');

const BASE = {
  numTeams: 16,
  battersPerTeam: 11,
  bowlersPerTeam: 6,
  rounds: 2,
  populationSeed: 1,
  testFraction: 0.15,
  ballsPerInnings: 35,
  matchSeed: 2,
  splitSeed: 3,
  checkpointStride: 1,
  splitMode: 'random',
  collectNestingDiagnostics: true
};

const RUNS = {
  '7-A': { archetypeSignal: false },
  '7-B': { archetypeSignal: true }
};

async function main() {
  const runName = process.argv[2];
  if (!runName || !RUNS[runName]) {
    console.error(`Usage: node research/harness/run-experiment-7.js <run>\n\nPreregistered runs:\n  ${Object.keys(RUNS).join('\n  ')}`);
    process.exit(2);
  }
  const CONFIG = { ...BASE, ...RUNS[runName] };

  const startedAt = new Date().toISOString();
  console.log(`Starting Experiment 7 run ${runName} (${CONFIG.archetypeSignal ? 'World B' : 'World A'})...`);
  console.log('Config:', JSON.stringify(CONFIG));

  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const startTime = Date.now();
  const { results, meta } = await runExperiment(CONFIG);
  const elapsedMs = Date.now() - startTime;
  console.log(`Experiment ran ${results.length} prediction rows in ${elapsedMs}ms`);

  const summary = summarizeByMethod(results);

  await mongoose.disconnect();
  await mongod.stop();

  const gitCommit = execSync('git rev-parse HEAD', { cwd: path.join(__dirname, '..', '..') }).toString().trim();
  const runDir = path.join(__dirname, '..', 'results', `${runName}_${startedAt.replace(/[:.]/g, '-')}`);
  fs.mkdirSync(runDir, { recursive: true });

  const record = { runName, startedAt, elapsedMs, codeVersion: gitCommit, config: CONFIG, meta, rowCount: results.length, summary };
  fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify(record, null, 2));
  fs.writeFileSync(path.join(runDir, 'raw-results.json'), JSON.stringify(results));

  console.log('\n=== RAW SUMMARY (no interpretation applied) ===\n');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nWritten to ${runDir}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

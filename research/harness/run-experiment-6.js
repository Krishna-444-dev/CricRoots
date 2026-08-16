// Experiment 6 runner - World C, temporal drift. See research/experiment-6-design.md.
//
// One process per run, selected by name, so each of the eight preregistered runs writes its own
// timestamped results directory and can be scheduled independently:
//
//   node research/harness/run-experiment-6.js 6-C0a
//
// The eight runs below ARE the preregistered grid (design section 6). Adding a run, changing a
// magnitude, or introducing a drift type not listed here would be a change to the preregistration
// and needs its own review - the grid is deliberately hard-coded rather than accepting arbitrary
// parameters from the command line.
//
// Metrics only, no interpretation - same discipline as every other run-experiment*.js.
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
  checkpointStride: 1
};

const ALL_TYPES = ['player', 'interaction', 'context'];

const RUNS = {
  // C0a: the anchor. Random split, no drift - should reproduce Experiment 5's World A closely,
  // since the drift machinery is inert at m=0. Any material divergence means the World C code
  // perturbed the stationary path.
  '6-C0a': { splitMode: 'random', drift: null },
  // C0b: the control every drift run is compared against. Temporal split, no drift, so
  // C0a -> C0b isolates the split's own effect.
  '6-C0b': { splitMode: 'temporal', drift: null },
  '6-C1': { splitMode: 'temporal', drift: { types: ['player'], magnitude: 0.50 } },
  '6-C2': { splitMode: 'temporal', drift: { types: ['interaction'], magnitude: 0.50 } },
  '6-C3': { splitMode: 'temporal', drift: { types: ['context'], magnitude: 0.50 } },
  '6-C4-mild': { splitMode: 'temporal', drift: { types: ALL_TYPES, magnitude: 0.25 } },
  '6-C4-mod': { splitMode: 'temporal', drift: { types: ALL_TYPES, magnitude: 0.50 } },
  '6-C4-stress': { splitMode: 'temporal', drift: { types: ALL_TYPES, magnitude: 1.00 } }
};

async function main() {
  const runName = process.argv[2];
  if (!runName || !RUNS[runName]) {
    console.error(`Usage: node research/harness/run-experiment-6.js <run>\n\nPreregistered runs:\n  ${Object.keys(RUNS).join('\n  ')}`);
    process.exit(2);
  }
  const CONFIG = { ...BASE, ...RUNS[runName] };

  const startedAt = new Date().toISOString();
  console.log(`Starting Experiment 6 run ${runName}...`);
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

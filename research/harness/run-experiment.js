// Runs a controlled experiment for real and writes raw results to research/results/<timestamp>/ -
// metrics only, no interpretation or conclusion written here or anywhere else. Per explicit
// instruction, results come back for joint interpretation before any conclusion is written down.
//
// Second experiment (this config): identical evaluation pipeline to the pilot
// (research/results/2026-08-15T22-44-34-033Z/) - same metrics, same protocol, no tuning after
// seeing results. The only change is the data-generating process: a realistic 16-team double
// round-robin league with randomized batting order (research/synthetic/league-design.md) in
// place of the pilot's fixed two-team roster, which produced an unrealistic sparsity
// distribution (94.7% of checkpoints at 50+ exact-matchup balls).
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { runExperiment } = require('./evaluate');
const { summarizeByMethod } = require('../metrics');

const CONFIG = {
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

async function main() {
  const startedAt = new Date().toISOString();
  console.log('Starting second controlled experiment (league/fixture-based data)...');
  console.log('Config:', CONFIG);

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

  const runDir = path.join(__dirname, '..', 'results', startedAt.replace(/[:.]/g, '-'));
  fs.mkdirSync(runDir, { recursive: true });

  const record = {
    startedAt,
    elapsedMs,
    codeVersion: gitCommit,
    config: CONFIG,
    meta,
    rowCount: results.length,
    summary
  };

  fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify(record, null, 2));
  fs.writeFileSync(path.join(runDir, 'raw-results.json'), JSON.stringify(results));

  console.log('\n=== RAW SUMMARY (no interpretation applied) ===\n');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nWritten to ${runDir}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

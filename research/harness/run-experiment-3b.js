// WORLD B entry point (research/synthetic/world-b-design.md) - identical CONFIG to the World A
// runner (research/harness/run-experiment.js): same population/match/split seeds, same
// evaluation pipeline, same methods - differing in exactly one flag: archetypeSignal: true, so
// battingStyle/bowlingStyle genuinely predict the outcome (measured realized effect: 8.84% of
// logit-space variance, see world-b-design.md), instead of carrying ~0% signal as in World A.
// Both runners are re-run together whenever the method set changes, so the two worlds are always
// compared at the same code version - see research/research-log.md for the run history.
// Metrics only, no interpretation written here - same discipline as every other run-experiment*.js.
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
  checkpointStride: 1,
  archetypeSignal: true
};

async function main() {
  const startedAt = new Date().toISOString();
  console.log('Starting controlled experiment - WORLD B (archetypeSignal: true)...');
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

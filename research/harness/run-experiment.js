// Runs the first controlled experiment for real and writes raw results to
// research/results/<timestamp>/ - metrics only, no interpretation or conclusion written here or
// anywhere else. Per explicit instruction, results come back for joint interpretation before any
// conclusion is written down.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { runExperiment } = require('./evaluate');
const { summarizeByMethod } = require('../metrics');

const CONFIG = {
  numBatters: 40,
  numBowlers: 40,
  populationSeed: 1,
  numTrainMatches: 100,
  numTestMatches: 25,
  ballsPerInnings: 35,
  matchSeed: 2,
  splitSeed: 3,
  checkpointStride: 1
};

async function main() {
  const startedAt = new Date().toISOString();
  console.log('Starting first controlled experiment...');
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

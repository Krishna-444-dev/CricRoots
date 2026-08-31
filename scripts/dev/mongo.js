// Local dev MongoDB, using the real mongod binary mongodb-memory-server already downloads for the
// test suite. Docker is not required and no system install is needed.
//
// Lives in the repo, and writes to ./.dev-data (gitignored), on purpose: an earlier version of this
// script lived in a scratch directory under /tmp along with its data, and both were cleaned up
// overnight - taking the entire seeded demo database with them.
//
//   node scripts/dev/mongo.js
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');

const DB_PATH = path.join(__dirname, '..', '..', '.dev-data', 'mongo');
require('fs').mkdirSync(DB_PATH, { recursive: true });

(async () => {
  const mongod = await MongoMemoryServer.create({
    instance: { port: 27017, dbPath: DB_PATH, storageEngine: 'wiredTiger' },
  });
  console.log(`dev mongo up: ${mongod.getUri()}`);
  console.log(`dbPath: ${DB_PATH}`);
  const stop = async () => { await mongod.stop(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  setInterval(() => {}, 1 << 30);
})().catch((e) => { console.error(e); process.exit(1); });

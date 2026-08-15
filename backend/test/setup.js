// Shared integration-test harness: a real (in-memory) MongoDB instance via mongodb-memory-server
// and a real Express app via createApp() (see src/app.js), driven through supertest. This is a
// real mongod binary, not a mock - consistent with this project's established "verify against a
// real database" discipline, just made fast/isolated enough to run in CI on every push instead
// of by hand against the shared dev database.
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('../src/app');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-not-for-production';

let mongod;

async function startTestDB() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

async function stopTestDB() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

async function clearTestDB() {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

function getApp() {
  return createApp();
}

module.exports = { startTestDB, stopTestDB, clearTestDB, getApp };

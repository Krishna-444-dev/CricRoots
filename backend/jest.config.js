module.exports = {
  testEnvironment: 'node',
  // Two categories of test live side by side on purpose: fast, dependency-free unit tests next
  // to the pure functions they cover (src/**/__tests__), and real-database integration tests
  // under test/ that spin up mongodb-memory-server once per suite (see test/setup.js) - both
  // run through the same `npm test`/CI invocation rather than needing separate commands.
  testMatch: ['**/__tests__/**/*.test.js', '**/test/**/*.test.js'],
  // Integration tests boot a real (if in-memory) MongoDB instance and an Express app per suite -
  // slower than a pure unit test, but this project's own established discipline all session has
  // been "verify against a real database, not mocks," and mongodb-memory-server is a real mongod
  // binary, not a stub, so this keeps that discipline while staying fast enough for CI.
  testTimeout: 30000,
  verbose: true,
  // Each integration test file spins up its own mongodb-memory-server instance (a real mongod
  // binary, not a mock). Running multiple of those concurrently - Jest's default - contends for
  // CPU/memory hard enough to make mongod itself miss its own startup deadline under load
  // (reproduced locally: parallel runs flaked with "Instance failed to start within 10000ms",
  // serial runs didn't). A CI runner has less headroom than a dev machine, not more, so this
  // isn't a local-only workaround - it trades a few seconds of wall-clock time for a suite that
  // doesn't intermittently fail for reasons unrelated to the code being tested.
  maxWorkers: 1
};

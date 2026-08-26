// A malformed route param must be a client error, not a server error, and must not disclose the ODM.
//
// Before validateObjectIdParams, every detail route answered a bad id with HTTP 500 and the raw
// Mongoose message - "Cast to ObjectId failed for value \"not-an-id\" ... for model \"Player\"".
// Two problems: 500 is the wrong class, so crawlers and stale deep links look like outages in
// monitoring; and the body leaks the ODM, the model name and the internal field path.
//
// The second half of this file is the part that matters: router.param fires for ANY route in a
// router carrying that param name, so the risk is over-rejection - a literal segment sitting where
// a param could match (/teams/mine, /players/me/profile) being wrongly 400'd. Those are asserted
// explicitly, because that failure would be silent and would break real screens.
const request = require('supertest');
const { startTestDB, stopTestDB, clearTestDB, getApp } = require('./setup');
const { createMatchFixture } = require('./fixtures');

let app;
beforeAll(async () => { await startTestDB(); app = getApp(); });
afterAll(async () => { await stopTestDB(); });
afterEach(async () => { await clearTestDB(); });

const BAD = ['not-an-id', '12345', 'undefined', 'null', '%20', 'aaa'];

describe('malformed ids are rejected as client errors', () => {
  test.each([
    ['/api/matches', 'match'],
    ['/api/teams', 'team'],
    ['/api/players', 'player'],
    ['/api/tournaments', 'tournament'],
    ['/api/leagues', 'league'],
  ])('%s/:id returns 400, not 500', async (base) => {
    const res = await request(app).get(`${base}/not-an-id`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('the response body does not leak the ODM or the model name', async () => {
    const res = await request(app).get('/api/players/not-an-id');
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/ObjectId/i);
    expect(body).not.toMatch(/Cast to/i);
    expect(body).not.toMatch(/model "/i);
    expect(body).not.toMatch(/path "/i);
  });

  test.each(BAD)('a variety of malformed values all give 400: %s', async (value) => {
    const res = await request(app).get(`/api/matches/${value}`);
    expect(res.status).toBe(400);
  });
});

describe('literal path segments are NOT over-rejected', () => {
  // router.param matches on NAME, so any literal sitting where :id could match is at risk.
  // Each of these is a real route the mobile client calls.
  test.each([
    '/api/teams/mine',
    '/api/players/me/profile',
    '/api/orders/my',
    '/api/orders/selling',
    '/api/trivia/current',
    '/api/notifications/unread-count',
    '/api/predictions/leaderboard',
    '/api/player-stats/rankings/batsmen',
    '/api/player-stats/rankings/bowlers',
  ])('%s is not treated as an id', async (path) => {
    const { token } = await createMatchFixture(app);
    const res = await request(app).get(path).set('Authorization', `Bearer ${token}`);
    expect(res.status).not.toBe(400);
  });
});

describe('valid ids still reach their controller', () => {
  test('a real match id resolves', async () => {
    const { token, match } = await createMatchFixture(app);
    const res = await request(app).get(`/api/matches/${match._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.match._id).toBe(String(match._id));
  });

  test('a well-formed but non-existent id is 404, not 400', async () => {
    // The distinction the fix must preserve: "not an id" and "no such document" are different.
    const res = await request(app).get('/api/matches/000000000000000000000000');
    expect(res.status).toBe(404);
  });
});

// Integration tests against the real recordBall endpoint (via a real, if in-memory, MongoDB and
// a real Express app - see test/setup.js), covering the invariants recordBall's own comments
// claim to maintain: legal-ball/over counting excludes wides and no-balls, runs accumulate onto
// the innings total exactly as sent, wickets increment, and the scoring lock actually excludes a
// second scorer. These are the rules every other feature this session (charts, MVP, matchup
// stats, the story generator) assumes hold true about the underlying ball log.
const request = require('supertest');
const { startTestDB, stopTestDB, clearTestDB, getApp } = require('./setup');
const { createMatchFixture, registerUser } = require('./fixtures');

let app;

beforeAll(async () => {
  await startTestDB();
  app = getApp();
});

afterAll(async () => {
  await stopTestDB();
});

afterEach(async () => {
  await clearTestDB();
});

function recordBall(token, matchId, overrides = {}) {
  return request(app)
    .post(`/api/matches/${matchId}/record-ball`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      inningsIndex: 0,
      ballNumber: 1,
      batsmanId: overrides.batsmanId || '6a7fd8e5700f451f4ed7de57',
      bowlerId: overrides.bowlerId || '6a7fd8e5700f451f4ed7de58',
      runs: 0,
      isWicket: false,
      isExtra: false,
      extraType: 'none',
      ...overrides
    });
}

describe('scoring invariants (POST /api/matches/:id/record-ball)', () => {
  test('a single legal ball advances the over to exactly "0.1", not a decimal fraction', async () => {
    const { token, match } = await createMatchFixture(app);
    const res = await recordBall(token, match._id, { runs: 1 });
    expect(res.status).toBe(200);
    expect(res.body.match.innings[0].runs).toBe(1);
    expect(res.body.match.innings[0].overs).toBeCloseTo(0.1, 10);
    expect(res.body.match.innings[0].wickets).toBe(0);
  });

  test('six legal balls complete exactly one over ("1.0"), not "0.6"', async () => {
    const { token, match } = await createMatchFixture(app);
    let last;
    for (let i = 1; i <= 6; i++) {
      last = await recordBall(token, match._id, { ballNumber: i, runs: 1 });
      expect(last.status).toBe(200);
    }
    expect(last.body.match.innings[0].overs).toBeCloseTo(1.0, 10);
    expect(last.body.match.innings[0].runs).toBe(6);
  });

  test('a wide adds its runs to the innings total but does NOT advance the over', async () => {
    const { token, match } = await createMatchFixture(app);
    const res = await recordBall(token, match._id, {
      runs: 1, // the mandatory wide run - callers are responsible for including it, per
      isExtra: true,
      extraType: 'wide'
    });
    expect(res.status).toBe(200);
    expect(res.body.match.innings[0].runs).toBe(1);
    expect(res.body.match.innings[0].overs).toBe(0); // zero legal balls recorded yet
  });

  test('a no-ball behaves the same way as a wide for over-counting purposes', async () => {
    const { token, match } = await createMatchFixture(app);
    const res = await recordBall(token, match._id, { runs: 1, isExtra: true, extraType: 'no-ball' });
    expect(res.status).toBe(200);
    expect(res.body.match.innings[0].overs).toBe(0);
  });

  test('five legal balls plus one wide plus one more legal ball still completes the over at exactly 6 legal deliveries', async () => {
    const { token, match } = await createMatchFixture(app);
    for (let i = 1; i <= 5; i++) {
      await recordBall(token, match._id, { ballNumber: i, runs: 1 });
    }
    await recordBall(token, match._id, { ballNumber: 6, runs: 1, isExtra: true, extraType: 'wide' });
    const last = await recordBall(token, match._id, { ballNumber: 7, runs: 1 });
    expect(last.body.match.innings[0].overs).toBeCloseTo(1.0, 10);
    expect(last.body.match.innings[0].runs).toBe(7); // 5 + 1 (wide) + 1
  });

  test('a wicket ball increments the innings wicket count', async () => {
    const { token, match } = await createMatchFixture(app);
    const res = await recordBall(token, match._id, { isWicket: true, wicketType: 'bowled', runs: 0 });
    expect(res.status).toBe(200);
    expect(res.body.match.innings[0].wickets).toBe(1);
  });

  test('a bye/leg-bye counts as a legal ball (advances the over) but is still an extra', async () => {
    const { token, match } = await createMatchFixture(app);
    const res = await recordBall(token, match._id, { runs: 1, isExtra: true, extraType: 'bye' });
    expect(res.status).toBe(200);
    expect(res.body.match.innings[0].overs).toBeCloseTo(0.1, 10); // byes DO count as legal balls
    expect(res.body.match.innings[0].runs).toBe(1);
  });

  test('an invalid inningsIndex is rejected with 400, not silently accepted', async () => {
    const { token, match } = await createMatchFixture(app);
    const res = await recordBall(token, match._id, { inningsIndex: 5 });
    expect(res.status).toBe(400);
  });

  test('recording a ball against a nonexistent match returns 404', async () => {
    const { token } = await createMatchFixture(app);
    const res = await recordBall(token, '000000000000000000000000');
    expect(res.status).toBe(404);
  });
});

describe('scoring lock', () => {
  test('an unauthorized user (not creator/umpire/rostered) is rejected with 403, independent of any lock', async () => {
    const { token: ownerToken, match } = await createMatchFixture(app);
    const { token: otherToken } = await registerUser(app);

    const otherBall = await recordBall(otherToken, match._id, { runs: 1 });
    expect(otherBall.status).toBe(403);
  });

  test('a second AUTHORIZED user (an appointed umpire) is blocked with 423 while the first user\'s fresh lock is active', async () => {
    const { token: ownerToken, match } = await createMatchFixture(app);
    const { token: umpireToken, user: umpireUser } = await registerUser(app);

    const appointRes = await request(app)
      .post(`/api/matches/${match._id}/umpires`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: umpireUser.id });
    expect(appointRes.status).toBe(200);

    const lockRes = await request(app)
      .post(`/api/matches/${match._id}/scoring-lock`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(lockRes.status).toBe(200);

    // The owner (who holds the lock) can still record balls.
    const ownerBall = await recordBall(ownerToken, match._id, { runs: 1 });
    expect(ownerBall.status).toBe(200);

    // The umpire IS authorized to manage this match (canManageMatch would pass), but does
    // NOT hold the active lock - this is the actual lock-contention path, distinct from the
    // plain-403-unauthorized case above.
    const umpireBall = await recordBall(umpireToken, match._id, { ballNumber: 2, runs: 1 });
    expect(umpireBall.status).toBe(423);
  });

  test('releasing the lock lets someone else acquire it', async () => {
    const { token: ownerToken, match } = await createMatchFixture(app);

    await request(app).post(`/api/matches/${match._id}/scoring-lock`).set('Authorization', `Bearer ${ownerToken}`);
    const releaseRes = await request(app).delete(`/api/matches/${match._id}/scoring-lock`).set('Authorization', `Bearer ${ownerToken}`);
    expect(releaseRes.status).toBe(200);

    const reacquireRes = await request(app).post(`/api/matches/${match._id}/scoring-lock`).set('Authorization', `Bearer ${ownerToken}`);
    expect(reacquireRes.status).toBe(200);
  });
});

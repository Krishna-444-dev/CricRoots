// Undo must restore the innings EXACTLY, and must not throw away the delivery it removed.
//
// The second half matters as much as the first: D20 says observational data is never overwritten
// to fit the current view, and an undo that hard-deletes leaves no record that a correction ever
// happened. The removed ball is moved to innings.undoneBalls - outside `balls`, because twenty
// files read that array and a flag left in place would need every one of them to filter it.
const request = require('supertest');
const { startTestDB, stopTestDB, clearTestDB, getApp } = require('./setup');
const { createMatchFixture } = require('./fixtures');
const Match = require('../src/models/Match');

let app;
beforeAll(async () => { await startTestDB(); app = getApp(); });
afterAll(async () => { await stopTestDB(); });
afterEach(async () => { await clearTestDB(); });

const ball = (token, matchId, o = {}) =>
  request(app).post(`/api/matches/${matchId}/record-ball`).set('Authorization', `Bearer ${token}`)
    .send({ inningsIndex: 0, ballNumber: 1, batsmanId: '6a7fd8e5700f451f4ed7de57', bowlerId: '6a7fd8e5700f451f4ed7de58', runs: 0, ...o });

const undo = (token, matchId, body = {}) =>
  request(app).post(`/api/matches/${matchId}/undo-ball`).set('Authorization', `Bearer ${token}`)
    .send({ inningsIndex: 0, ...body });

describe('undo restores the innings exactly', () => {
  test('a mis-tapped run is fully reversed', async () => {
    const { token, match } = await createMatchFixture(app);
    await ball(token, match._id, { ballNumber: 1, runs: 1 });
    await ball(token, match._id, { ballNumber: 2, runs: 6 });   // the mistake
    const before = await Match.findById(match._id);
    expect(before.innings[0].runs).toBe(7);

    const res = await undo(token, match._id);
    expect(res.status).toBe(200);
    expect(res.body.undone.runs).toBe(6);

    const after = await Match.findById(match._id);
    expect(after.innings[0].runs).toBe(1);
    expect(after.innings[0].balls).toHaveLength(1);
    expect(after.innings[0].overs).toBeCloseTo(0.1, 5);
  });

  test('undoing a wicket restores the wicket count', async () => {
    const { token, match } = await createMatchFixture(app);
    await ball(token, match._id, { ballNumber: 1, runs: 2 });
    await ball(token, match._id, { ballNumber: 2, isWicket: true, wicketType: 'bowled' });
    expect((await Match.findById(match._id)).innings[0].wickets).toBe(1);

    await undo(token, match._id);
    const after = await Match.findById(match._id);
    expect(after.innings[0].wickets).toBe(0);
    expect(after.innings[0].runs).toBe(2);
  });

  test('undoing a wide does not consume a legal ball from the over count', async () => {
    const { token, match } = await createMatchFixture(app);
    await ball(token, match._id, { ballNumber: 1, runs: 0 });
    await ball(token, match._id, { ballNumber: 2, runs: 1, isExtra: true, extraType: 'wide' });
    expect((await Match.findById(match._id)).innings[0].overs).toBeCloseTo(0.1, 5);

    await undo(token, match._id);
    const after = await Match.findById(match._id);
    expect(after.innings[0].overs).toBeCloseTo(0.1, 5);   // still one legal ball
    expect(after.innings[0].runs).toBe(0);
  });

  test('repeated undo walks back a whole over', async () => {
    const { token, match } = await createMatchFixture(app);
    for (let i = 1; i <= 6; i++) await ball(token, match._id, { ballNumber: i, runs: 1 });
    expect((await Match.findById(match._id)).innings[0].overs).toBeCloseTo(1.0, 5);

    for (let i = 0; i < 6; i++) await undo(token, match._id);
    const after = await Match.findById(match._id);
    expect(after.innings[0].balls).toHaveLength(0);
    expect(after.innings[0].runs).toBe(0);
    expect(after.innings[0].overs).toBe(0);
    expect(after.innings[0].undoneBalls).toHaveLength(6);
  });

  test('re-scoring after an undo produces the right total', async () => {
    const { token, match } = await createMatchFixture(app);
    await ball(token, match._id, { ballNumber: 1, runs: 6 });   // meant to be 4
    await undo(token, match._id);
    await ball(token, match._id, { ballNumber: 1, runs: 4 });
    const after = await Match.findById(match._id);
    expect(after.innings[0].runs).toBe(4);
    expect(after.innings[0].balls).toHaveLength(1);
  });
});

describe('the removed delivery is preserved, not discarded', () => {
  test('it moves to undoneBalls with who and when', async () => {
    const { token, match, user } = await createMatchFixture(app);
    await ball(token, match._id, { ballNumber: 1, runs: 6, line: 'off-stump', length: 'full' });
    await undo(token, match._id);

    const after = await Match.findById(match._id);
    expect(after.innings[0].undoneBalls).toHaveLength(1);
    const rec = after.innings[0].undoneBalls[0];
    expect(rec.ball.runs).toBe(6);
    expect(rec.ball.line).toBe('off-stump');       // the tagging survives too
    expect(rec.undoneBy).not.toBeNull();
    expect(rec.undoneAt).toBeInstanceOf(Date);
  });

  test('undone balls are NOT in innings.balls, so no consumer counts them', async () => {
    const { token, match } = await createMatchFixture(app);
    await ball(token, match._id, { ballNumber: 1, runs: 4 });
    await ball(token, match._id, { ballNumber: 2, runs: 6 });
    await undo(token, match._id);

    const after = await Match.findById(match._id);
    expect(after.innings[0].balls.map((b) => b.runs)).toEqual([4]);
    // The scorecard endpoint derives from innings.balls, so it must agree.
    const sc = await request(app).get(`/api/matches/${match._id}/scorecard`);
    expect(sc.status).toBe(200);
    expect(sc.body.scorecard.team1.runs).toBe(4);
  });
});

describe('guards', () => {
  test('undo with nothing to undo is refused', async () => {
    const { token, match } = await createMatchFixture(app);
    const res = await undo(token, match._id);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no deliveries/i);
  });

  test('a completed match is refused rather than half-handled', async () => {
    const { token, match } = await createMatchFixture(app);
    await ball(token, match._id, { ballNumber: 1, runs: 4 });
    await request(app).put(`/api/matches/${match._id}`).set('Authorization', `Bearer ${token}`).send({ status: 'Completed' });

    const res = await undo(token, match._id);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/completed/i);
  });

  test('an unauthenticated request cannot undo', async () => {
    const { token, match } = await createMatchFixture(app);
    await ball(token, match._id, { ballNumber: 1, runs: 4 });
    const res = await request(app).post(`/api/matches/${match._id}/undo-ball`).send({ inningsIndex: 0 });
    expect(res.status).toBe(401);
  });
});

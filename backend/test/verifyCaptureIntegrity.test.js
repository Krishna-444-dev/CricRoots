// Tests for the launch-gate verifier.
//
// A verifier that cannot fail is worse than no verifier - it produces a green check that means
// nothing. So roughly half of these deliberately break the capture and assert the gate catches it.
// (D19, 2026-08-25: a gate must first be shown capable of distinguishing the cases it judges.)
const request = require('supertest');
const { startTestDB, stopTestDB, clearTestDB, getApp } = require('./setup');
const { createMatchFixture, registerUser, registerPlayer } = require('./fixtures');
const { verifyMatch } = require('../src/scripts/verifyCaptureIntegrity');
const Match = require('../src/models/Match');
const Prediction = require('../src/models/Prediction');

let app;
beforeAll(async () => { await startTestDB(); app = getApp(); });
afterAll(async () => { await stopTestDB(); });
afterEach(async () => { await clearTestDB(); });

const recordBall = (token, matchId, o = {}) =>
  request(app).post(`/api/matches/${matchId}/record-ball`).set('Authorization', `Bearer ${token}`)
    .send({
      inningsIndex: 0, ballNumber: 1,
      batsmanId: '6a7fd8e5700f451f4ed7de57', bowlerId: '6a7fd8e5700f451f4ed7de58',
      runs: 0, ...o
    });

async function scoredMatch(extra = {}) {
  const { token, match, team1, team2, player } = await createMatchFixture(app);
  const script = [
    { runs: 4 }, { runs: 1, isExtra: true, extraType: 'wide' },
    { runs: 0, isWicket: true, wicketType: 'bowled' }, { runs: 6 },
    { runs: 2 }, { runs: 1, isExtra: true, extraType: 'leg-bye' }, { runs: 0 }
  ];
  for (let i = 0; i < script.length; i++) {
    await recordBall(token, match._id, { ballNumber: i + 1, ...script[i] });
  }
  await request(app).put(`/api/matches/${match._id}`).set('Authorization', `Bearer ${token}`)
    .send({ status: 'Completed', ...extra });
  return { token, team1, team2, player, doc: await Match.findById(match._id).lean() };
}

describe('the verifier passes a correctly captured match', () => {
  test('a full dry-run match passes every check', async () => {
    const { doc } = await scoredMatch();
    const { checks, passed } = verifyMatch(doc, []);
    const failed = checks.filter((c) => !c.pass);
    expect(failed.map((c) => `${c.name}: ${c.detail}`)).toEqual([]);
    expect(passed).toBe(true);
  });

  test('a human override passes, and records who and when', async () => {
    const { token, doc: first } = await scoredMatch();
    const { token: otherToken } = await registerUser(app);
    const other = await registerPlayer(app, otherToken, { battingStyle: 'Left-hand' });
    await request(app).put(`/api/matches/${first._id}`).set('Authorization', `Bearer ${token}`)
      .send({ manOfTheMatch: other._id });

    const doc = await Match.findById(first._id).lean();
    const { checks, passed } = verifyMatch(doc, []);
    expect(passed).toBe(true);
    expect(checks.find((c) => c.name === 'human pick records who and when').pass).toBe(true);
    expect(checks.find((c) => c.name === 'the overridden algorithm pick is still recoverable').pass).toBe(true);
  });

  test('revised predictions pass', async () => {
    const { doc } = await scoredMatch();
    // Predictions lock once a match leaves Scheduled, so revise on a separate still-open match.
    const { match: open, team1: t1, team2: t2 } = await createMatchFixture(app);
    const { token: u } = await registerUser(app);
    const submit = (w) => request(app).post('/api/predictions').set('Authorization', `Bearer ${u}`)
      .send({ matchId: open._id, predictedWinnerId: w });
    await submit(t1._id);
    await submit(t2._id);

    const preds = await Prediction.find({ match: open._id }).lean();
    expect(preds[0].revisions).toHaveLength(1);
    const { passed } = verifyMatch(doc, preds);
    expect(passed).toBe(true);
  });
});

describe('the verifier FAILS when capture is broken', () => {
  test('missing pre-delivery state is caught', async () => {
    const { doc } = await scoredMatch();
    delete doc.innings[0].balls[2].runsBefore;
    const { checks, passed } = verifyMatch(doc, []);
    expect(passed).toBe(false);
    expect(checks.find((c) => c.name === 'every ball carries pre-delivery state').pass).toBe(false);
  });

  test('state captured AFTER the ball instead of before is caught', async () => {
    // The subtle failure: the fields exist and look plausible, but mean the wrong thing.
    const { doc } = await scoredMatch();
    const balls = doc.innings[0].balls;
    balls.forEach((b) => { b.runsBefore += b.runs; });
    const { checks, passed } = verifyMatch(doc, []);
    expect(passed).toBe(false);
    expect(checks.find((c) => c.name === 'pre-delivery state is consistent ball to ball').pass).toBe(false);
  });

  test('a missing algorithm pick is caught', async () => {
    const { doc } = await scoredMatch();
    doc.manOfTheMatchComputed = null;
    const { checks, passed } = verifyMatch(doc, []);
    expect(passed).toBe(false);
    expect(checks.find((c) => c.name === 'manOfTheMatchComputed recorded').pass).toBe(false);
  });

  test('an unset provenance source is caught', async () => {
    const { doc } = await scoredMatch();
    doc.manOfTheMatchSource = null;
    expect(verifyMatch(doc, []).passed).toBe(false);
  });

  test('malformed revision ordinals are caught', async () => {
    const { doc } = await scoredMatch();
    const bad = [{ revisions: [{ revision: 7, predictedWinner: null, supersededAt: null }] }];
    const { checks, passed } = verifyMatch(doc, bad);
    expect(passed).toBe(false);
    expect(checks.find((c) => c.name === 'revision ordinals and payloads intact').pass).toBe(false);
  });
});

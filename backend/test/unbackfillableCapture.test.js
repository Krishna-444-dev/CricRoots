// Tests for the three unbackfillable instrumentation changes (see
// documentation/evidence-provenance-backlog.md items 1, 1b and the Prediction note).
//
// These exist because the failure mode is silent and permanent: if capture is wrong, nothing
// breaks, no user notices, and the observation is simply gone. Every assertion below targets
// something that cannot be reconstructed after the match is saved.
const request = require('supertest');
const { startTestDB, stopTestDB, clearTestDB, getApp } = require('./setup');
const { createMatchFixture, registerUser, registerPlayer } = require('./fixtures');
const Match = require('../src/models/Match');
const Prediction = require('../src/models/Prediction');

let app;

beforeAll(async () => {
  await startTestDB();
  app = getApp();
});
afterAll(async () => { await stopTestDB(); });
afterEach(async () => { await clearTestDB(); });

function recordBall(token, matchId, overrides = {}) {
  return request(app)
    .post(`/api/matches/${matchId}/record-ball`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      inningsIndex: 0,
      ballNumber: 1,
      batsmanId: '6a7fd8e5700f451f4ed7de57',
      bowlerId: '6a7fd8e5700f451f4ed7de58',
      runs: 0,
      ...overrides
    });
}

describe('per-ball match state capture', () => {
  test('records the state BEFORE each delivery, not after', async () => {
    const { token, match } = await createMatchFixture(app);
    await recordBall(token, match._id, { ballNumber: 1, runs: 4 });
    await recordBall(token, match._id, { ballNumber: 2, runs: 1 });
    await recordBall(token, match._id, { ballNumber: 3, runs: 0, isWicket: true, wicketType: 'bowled' });
    await recordBall(token, match._id, { ballNumber: 4, runs: 2 });

    const balls = (await Match.findById(match._id)).innings[0].balls;

    // Ball 1 was bowled at 0/0 off 0 - the state it was bowled IN, not the state it produced.
    expect(balls[0].runsBefore).toBe(0);
    expect(balls[0].wicketsBefore).toBe(0);
    expect(balls[0].legalBallsBefore).toBe(0);
    // Ball 2 at 4/0 off 1
    expect(balls[1].runsBefore).toBe(4);
    expect(balls[1].legalBallsBefore).toBe(1);
    // Ball 4 at 5/1 off 3 - ball 3's wicket is visible, ball 4's own runs are not
    expect(balls[3].runsBefore).toBe(5);
    expect(balls[3].wicketsBefore).toBe(1);
    expect(balls[3].legalBallsBefore).toBe(3);
  });

  test('wides and no-balls add runs but not legal balls', async () => {
    const { token, match } = await createMatchFixture(app);
    await recordBall(token, match._id, { ballNumber: 1, runs: 1, isExtra: true, extraType: 'wide' });
    await recordBall(token, match._id, { ballNumber: 2, runs: 1, isExtra: true, extraType: 'no-ball' });
    await recordBall(token, match._id, { ballNumber: 3, runs: 0 });
    await recordBall(token, match._id, { ballNumber: 4, runs: 0 });

    const balls = (await Match.findById(match._id)).innings[0].balls;
    expect(balls[2].legalBallsBefore).toBe(0);
    expect(balls[2].runsBefore).toBe(2);
    expect(balls[3].legalBallsBefore).toBe(1);
  });

  test('a bye is a legal ball', async () => {
    const { token, match } = await createMatchFixture(app);
    await recordBall(token, match._id, { ballNumber: 1, runs: 1, isExtra: true, extraType: 'bye' });
    await recordBall(token, match._id, { ballNumber: 2, runs: 0 });
    const balls = (await Match.findById(match._id)).innings[0].balls;
    expect(balls[1].legalBallsBefore).toBe(1);
  });

  test('the captured state reconstructs the innings totals exactly', async () => {
    // The real invariant: sum of what was captured must agree with the running totals, otherwise
    // the per-ball state and the innings disagree and neither can be trusted.
    const { token, match } = await createMatchFixture(app);
    const script = [
      { runs: 4 }, { runs: 1, isExtra: true, extraType: 'wide' }, { runs: 0, isWicket: true, wicketType: 'bowled' },
      { runs: 6 }, { runs: 2 }, { runs: 1, isExtra: true, extraType: 'leg-bye' }, { runs: 0 }
    ];
    for (let i = 0; i < script.length; i++) {
      await recordBall(token, match._id, { ballNumber: i + 1, ...script[i] });
    }
    const innings = (await Match.findById(match._id)).innings[0];
    const last = innings.balls[innings.balls.length - 1];
    const isLegal = (b) => !(b.isExtra && ['wide', 'no-ball'].includes(b.extraType));

    expect(last.runsBefore + last.runs).toBe(innings.runs);
    expect(last.wicketsBefore + (last.isWicket ? 1 : 0)).toBe(innings.wickets);
    expect(last.legalBallsBefore + (isLegal(last) ? 1 : 0))
      .toBe(innings.balls.filter(isLegal).length);
  });
});

describe('man-of-the-match provenance', () => {
  async function completeMatch(token, matchId, body = {}) {
    return request(app).put(`/api/matches/${matchId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'Completed', ...body });
  }

  test('the algorithm pick is stored even when nobody disagrees', async () => {
    const { token, match } = await createMatchFixture(app);
    await recordBall(token, match._id, { ballNumber: 1, runs: 6 });
    await completeMatch(token, match._id);

    const saved = await Match.findById(match._id);
    expect(saved.manOfTheMatchSource).toBe('algorithm');
    expect(saved.manOfTheMatchComputed).not.toBeNull();
    // Agreement is now OBSERVABLE rather than indistinguishable from an override.
    expect(String(saved.manOfTheMatch)).toBe(String(saved.manOfTheMatchComputed));
  });

  test('a human override keeps the algorithm pick alongside it', async () => {
    const { token, match } = await createMatchFixture(app);
    await recordBall(token, match._id, { ballNumber: 1, runs: 6 });
    await completeMatch(token, match._id);
    const auto = String((await Match.findById(match._id)).manOfTheMatchComputed);

    const { token: otherToken } = await registerUser(app);
    const other = await registerPlayer(app, otherToken, { battingStyle: 'Left-hand' });
    await request(app).put(`/api/matches/${match._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ manOfTheMatch: other._id });

    const saved = await Match.findById(match._id);
    expect(saved.manOfTheMatchSource).toBe('human');
    expect(String(saved.manOfTheMatch)).toBe(String(other._id));
    // The disagreement is recoverable: what the human chose AND what they overrode.
    expect(String(saved.manOfTheMatchComputed)).toBe(auto);
    expect(String(saved.manOfTheMatch)).not.toBe(String(saved.manOfTheMatchComputed));
    expect(saved.manOfTheMatchSelectedBy).not.toBeNull();
    expect(saved.manOfTheMatchSelectedAt).toBeInstanceOf(Date);
  });

  test('an override supplied at completion time is still marked human', async () => {
    const { token, match } = await createMatchFixture(app);
    await recordBall(token, match._id, { ballNumber: 1, runs: 6 });
    const { token: otherToken } = await registerUser(app);
    const other = await registerPlayer(app, otherToken, { battingStyle: 'Left-hand' });
    await completeMatch(token, match._id, { manOfTheMatch: other._id });

    const saved = await Match.findById(match._id);
    expect(saved.manOfTheMatchSource).toBe('human');
    expect(String(saved.manOfTheMatch)).toBe(String(other._id));
    expect(saved.manOfTheMatchComputed).not.toBeNull();
  });
});

describe('prediction revision history', () => {
  const submit = (token, matchId, winnerId, motmId) =>
    request(app).post('/api/predictions').set('Authorization', `Bearer ${token}`)
      .send({ matchId, predictedWinnerId: winnerId, predictedMotmId: motmId });

  test('a changed forecast preserves the superseded one', async () => {
    const { token, match, team1, team2, player } = await createMatchFixture(app);
    await submit(token, match._id, team1._id, player._id);
    await submit(token, match._id, team2._id, null);

    const p = await Prediction.findOne({ match: match._id });
    expect(String(p.predictedWinner)).toBe(String(team2._id));
    expect(p.revisions).toHaveLength(1);
    expect(String(p.revisions[0].predictedWinner)).toBe(String(team1._id));
    expect(String(p.revisions[0].predictedMotm)).toBe(String(player._id));
    expect(p.revisions[0].revision).toBe(1);
    expect(p.revisions[0].supersededAt).toBeInstanceOf(Date);
  });

  test('re-submitting the SAME forecast is not a revision', async () => {
    const { token, match, team1, player } = await createMatchFixture(app);
    await submit(token, match._id, team1._id, player._id);
    await submit(token, match._id, team1._id, player._id);
    await submit(token, match._id, team1._id, player._id);

    const p = await Prediction.findOne({ match: match._id });
    expect(p.revisions).toHaveLength(0);
  });

  test('revisions accumulate in order and the live value stays current', async () => {
    const { token, match, team1, team2 } = await createMatchFixture(app);
    await submit(token, match._id, team1._id, null);
    await submit(token, match._id, team2._id, null);
    await submit(token, match._id, team1._id, null);

    const p = await Prediction.findOne({ match: match._id });
    expect(p.revisions.map((r) => r.revision)).toEqual([1, 2]);
    expect(String(p.revisions[0].predictedWinner)).toBe(String(team1._id));
    expect(String(p.revisions[1].predictedWinner)).toBe(String(team2._id));
    expect(String(p.predictedWinner)).toBe(String(team1._id));
  });
});

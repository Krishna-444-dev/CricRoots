// Builds real test state through the real API (register -> register player -> create team ->
// create match), the same way every live-verification pass this session has - not inserted
// directly via Mongoose model.create(), so these fixtures also incidentally exercise the real
// validation/authorization each endpoint already enforces rather than bypassing it.
const request = require('supertest');

let counter = 0;
function unique(prefix) {
  counter += 1;
  return `${prefix}${Date.now()}${counter}`;
}

async function registerUser(app, overrides = {}) {
  const email = overrides.email || `${unique('user')}@test.com`;
  const res = await request(app).post('/api/auth/register').send({
    name: overrides.name || 'Test User',
    email,
    password: overrides.password || 'TestPass123!',
    role: overrides.role || 'player'
  });
  if (!res.body.success) throw new Error(`registerUser failed: ${res.body.message}`);
  return { token: res.body.token, user: res.body.user };
}

async function registerPlayer(app, token, overrides = {}) {
  const res = await request(app)
    .post('/api/players/register')
    .set('Authorization', `Bearer ${token}`)
    .send({
      specialization: overrides.specialization || 'All-rounder',
      battingStyle: overrides.battingStyle || 'Right-hand',
      bowlingStyle: overrides.bowlingStyle
    });
  if (!res.body.success) throw new Error(`registerPlayer failed: ${res.body.message}`);
  return res.body.player;
}

async function createTeam(app, token, overrides = {}) {
  const res = await request(app)
    .post('/api/teams')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: overrides.name || unique('Team'),
      city: overrides.city || 'Test City'
    });
  if (!res.body.success) throw new Error(`createTeam failed: ${res.body.message}`);
  return res.body.team;
}

async function createMatch(app, token, team1Id, team2Id, overrides = {}) {
  const res = await request(app)
    .post('/api/matches')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: overrides.title || unique('Match'),
      team1Id,
      team2Id,
      venue: overrides.venue || 'Test Ground',
      scheduledDate: overrides.scheduledDate || '2026-08-15T10:00:00.000Z',
      matchType: overrides.matchType || 'T20',
      totalOvers: overrides.totalOvers || 4
    });
  if (!res.body.success) throw new Error(`createMatch failed: ${res.body.message}`);
  return res.body.match;
}

// Registers a user + player profile + two teams (same user captains both, simplest valid
// fixture for scoring tests that don't care about roster membership - recordBall doesn't
// cross-check batsman/bowler ids against either team's roster) + a match between them, all
// through the real API. Returns everything a scoring test typically needs.
async function createMatchFixture(app, overrides = {}) {
  const { token, user } = await registerUser(app, overrides.user);
  const player = await registerPlayer(app, token, overrides.player);
  const team1 = await createTeam(app, token, { name: unique('Team A ') });
  const team2 = await createTeam(app, token, { name: unique('Team B ') });
  const match = await createMatch(app, token, team1._id, team2._id, overrides.match);
  return { token, user, player, team1, team2, match };
}

module.exports = { registerUser, registerPlayer, createTeam, createMatch, createMatchFixture, unique };

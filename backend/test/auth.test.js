// Integration tests for the auth flow (register/login) and the `protect` middleware every
// private route in this app depends on, plus one resource-ownership check (appointing an
// umpire) as a concrete example of "authenticated, but not the right person" - distinct from
// "not authenticated at all", which is what most of this file covers.
const request = require('supertest');
const { startTestDB, stopTestDB, clearTestDB, getApp } = require('./setup');
const { registerUser, createMatchFixture } = require('./fixtures');

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

describe('registration and login', () => {
  test('registering with valid data returns a token and the created user', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Auth Test',
      email: 'auth.test@example.com',
      password: 'TestPass123!',
      role: 'player'
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.email).toBe('auth.test@example.com');
    // The password must never come back in the response, in any form.
    expect(res.body.user.password).toBeUndefined();
  });

  test('registering with an already-used email is rejected, not silently overwritten', async () => {
    const email = 'duplicate@example.com';
    await request(app).post('/api/auth/register').send({ name: 'First', email, password: 'TestPass123!', role: 'player' });
    const second = await request(app).post('/api/auth/register').send({ name: 'Second', email, password: 'DifferentPass456!', role: 'player' });
    expect(second.status).not.toBe(201);
    expect(second.body.success).toBe(false);
  });

  test('logging in with the correct password succeeds', async () => {
    await request(app).post('/api/auth/register').send({ name: 'Login Test', email: 'login.test@example.com', password: 'TestPass123!', role: 'player' });
    const res = await request(app).post('/api/auth/login').send({ email: 'login.test@example.com', password: 'TestPass123!' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.token).toBe('string');
  });

  test('logging in with the wrong password is rejected', async () => {
    await request(app).post('/api/auth/register').send({ name: 'Login Test 2', email: 'login.test2@example.com', password: 'TestPass123!', role: 'player' });
    const res = await request(app).post('/api/auth/login').send({ email: 'login.test2@example.com', password: 'WrongPassword!' });
    expect(res.status).not.toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.token).toBeUndefined();
  });

  test('logging in with a nonexistent email is rejected the same way as a wrong password (no user enumeration)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'never.registered@example.com', password: 'whatever123' });
    expect(res.status).not.toBe(200);
    expect(res.body.success).toBe(false);
  });
});

describe('protect middleware', () => {
  test('a request with no Authorization header is rejected with 401', async () => {
    const res = await request(app).get('/api/players/me/profile');
    expect(res.status).toBe(401);
  });

  test('a malformed/garbage token is rejected with 401, not a 500', async () => {
    const res = await request(app).get('/api/players/me/profile').set('Authorization', 'Bearer not-a-real-jwt');
    expect(res.status).toBe(401);
  });

  test('a well-formed but invalid-signature token is rejected with 401', async () => {
    // A JWT signed with a different secret than this server's JWT_SECRET - structurally valid,
    // cryptographically wrong. jsonwebtoken is already a dependency here, so this uses the real
    // library rather than hand-rolling a fake token string.
    const jwt = require('jsonwebtoken');
    const fakeToken = jwt.sign({ id: '000000000000000000000000' }, 'a-completely-different-secret');
    const res = await request(app).get('/api/players/me/profile').set('Authorization', `Bearer ${fakeToken}`);
    expect(res.status).toBe(401);
  });

  test('a valid token for a real user is accepted', async () => {
    const { token } = await registerUser(app);
    const res = await request(app).get('/api/players/me/profile').set('Authorization', `Bearer ${token}`);
    // No player profile registered yet, so this specific route may 404 - the point of this
    // test is that authentication itself succeeded (not blocked at the protect middleware),
    // which a 404 (reached the handler) demonstrates just as well as a 200 would.
    expect(res.status).not.toBe(401);
  });
});

describe('resource ownership (appointing a match umpire is creator-only)', () => {
  test('the match creator can appoint an umpire', async () => {
    const { token: creatorToken, match } = await createMatchFixture(app);
    const { user: someUser } = await registerUser(app);
    const res = await request(app)
      .post(`/api/matches/${match._id}/umpires`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ userId: someUser.id });
    expect(res.status).toBe(200);
  });

  test('a non-creator cannot appoint an umpire, even with a valid token for a real user', async () => {
    const { match } = await createMatchFixture(app);
    const { token: otherToken } = await registerUser(app);
    const { user: someUser } = await registerUser(app);
    const res = await request(app)
      .post(`/api/matches/${match._id}/umpires`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ userId: someUser.id });
    expect(res.status).toBe(403);
  });
});

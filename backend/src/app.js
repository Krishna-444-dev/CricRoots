const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Any call on this object - .emit(), .emitBallRecorded(), whatever a controller reaches for
// next - is a no-op that returns itself, so it never matters which subset of the real
// io/SocketManager interface a given route happens to touch. Built once controllers turned out
// to call more than just `.emit()` (recordBall calls `req.socketManager.emitBallRecorded(...)`
// unconditionally, with no null-check) - a fixed list of stubbed methods would have needed
// updating every time a new emit* method was added; this doesn't.
function noopEmitter() {
  return new Proxy(() => noopEmitter(), { get: () => noopEmitter() });
}

// Wide open (`origin: true`, reflects whatever Origin the request sent) outside production -
// local dev hits this from web-app's dev server, the Expo mobile client, and ad-hoc curl/
// Playwright verification, none of which have a single fixed origin worth pinning down. In
// production, restricted to FRONTEND_URL specifically (already the same env var socket.io's own
// CORS config uses) - and if that isn't set, `origin: false` blocks every cross-origin request
// rather than silently falling back to wide-open, which is what `cors()` with no options at all
// would otherwise do. A misconfigured FRONTEND_URL breaks the frontend loudly (visible failed
// requests) instead of quietly leaving the API open to any origin.
function resolveCorsOrigin() {
  if (process.env.NODE_ENV !== 'production') return true;
  if (!process.env.FRONTEND_URL) {
    console.warn('CORS: FRONTEND_URL is not set in production - blocking all cross-origin requests until it is.');
    return false;
  }
  return process.env.FRONTEND_URL;
}

// Builds the configured Express app - all middleware and routes - without connecting to the
// database, creating an HTTP server, or attaching Socket.IO. Extracted out of index.js so tests
// (see test/setup.js) can exercise real routes against a real, independent MongoDB instance via
// supertest, without needing a live socket server or the production database. `ioHolder` is a
// plain mutable object rather than passing `io`/`socketManager` directly: index.js needs to
// create this app before it can create the HTTP server that socket.io itself wraps, so `io`
// doesn't exist yet when the app (and its req.io-attaching middleware) is built. The middleware
// reads ioHolder.io fresh on every request, so index.js can populate ioHolder.io *after*
// creating the app - by the time any real request arrives (after server.listen()), it's already
// set. Tests simply omit ioHolder, which falls back to the no-op emitter above.
function createApp({ ioHolder } = {}) {
  const app = express();

  app.use((req, res, next) => {
    req.io = ioHolder?.io || noopEmitter();
    req.socketManager = ioHolder?.socketManager || noopEmitter();
    next();
  });

  app.use(helmet());
  app.use(cors({ origin: resolveCorsOrigin() }));
  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Uploaded group-chat attachments (see middleware/upload.js). helmet's default
  // Cross-Origin-Resource-Policy header blocks a frontend on a different origin from loading
  // these as <img>/<video> sources, so it's relaxed specifically for this static route.
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
    setHeaders: (res) => res.set('Cross-Origin-Resource-Policy', 'cross-origin')
  }));

  app.get('/', (req, res) => {
    res.json({
      message: 'Welcome to CricRoots API',
      version: '1.0.0',
      status: 'Running',
      websocket: 'Enabled'
    });
  });

  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/users', require('./routes/userRoutes'));
  app.use('/api/players', require('./routes/playerRoutes'));
  app.use('/api/player-stats', require('./routes/playerStatsRoutes'));
  app.use('/api/teams', require('./routes/teamRoutes'));
  app.use('/api/matches', require('./routes/matchRoutes'));
  app.use('/api/tournaments', require('./routes/tournamentRoutes'));
  app.use('/api/leagues', require('./routes/leagueRoutes'));
  app.use('/api/lessons', require('./routes/lessonRoutes'));
  app.use('/api/news', require('./routes/newsRoutes'));
  app.use('/api/products', require('./routes/productRoutes'));
  app.use('/api/orders', require('./routes/orderRoutes'));
  app.use('/api/insights', require('./routes/insightsRoutes'));
  app.use('/api/predictions', require('./routes/predictionRoutes'));
  app.use('/api/messages', require('./routes/directMessageRoutes'));
  app.use('/api/groups', require('./routes/groupRoutes'));
  app.use('/api/assistant', require('./routes/assistantRoutes'));
  app.use('/api/notifications', require('./routes/notificationRoutes'));
  app.use('/api/polls', require('./routes/pollRoutes'));
  app.use('/api/trivia', require('./routes/triviaRoutes'));

  // Error Handling Middleware
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Something went wrong!'
    });
  });

  // 404 Handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found'
    });
  });

  return app;
}

module.exports = { createApp };

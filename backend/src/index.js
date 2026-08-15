const http = require('http');
const socketIo = require('socket.io');
const dotenv = require('dotenv');
const connectDB = require('./config/database');
const SocketManager = require('./utils/socketManager');
const { createApp } = require('./app');
const { assertProductionSecretsConfigured } = require('./config/assertSecrets');

// Load environment variables
dotenv.config();

assertProductionSecretsConfigured();

// See app.js's comment on ioHolder for why this is a mutable holder rather than passing `io`
// directly - the app (and its req.io-attaching middleware) has to be built before the HTTP
// server that socket.io wraps can exist, so `io` isn't available yet at createApp() time.
const ioHolder = {};
const app = createApp({ ioHolder });
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

// Connect to database
connectDB();

// Initialize Socket Manager
ioHolder.io = io;
ioHolder.socketManager = new SocketManager(io);

// Start Server
server.listen(PORT, () => {
  console.log(`CricRoots Backend running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
});

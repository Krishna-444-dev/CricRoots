const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const connectDB = require('./config/database');
const SocketManager = require('./utils/socketManager');

// Load environment variables
dotenv.config();

const app = express();
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
const socketManager = new SocketManager(io);

// Make socketManager available to routes
app.use((req, res, next) => {
  req.io = io;
  req.socketManager = socketManager;
  next();
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic Route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to CricSync API',
    version: '1.0.0',
    status: 'Running',
    websocket: 'Enabled'
  });
});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/players', require('./routes/playerRoutes'));
app.use('/api/player-stats', require('./routes/playerStatsRoutes'));
app.use('/api/teams', require('./routes/teamRoutes'));
app.use('/api/matches', require('./routes/matchRoutes'));
app.use('/api/tournaments', require('./routes/tournamentRoutes'));
// app.use('/api/shop', require('./routes/shopRoutes'));

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

// Start Server
server.listen(PORT, () => {
  console.log(`CricSync Backend running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
});

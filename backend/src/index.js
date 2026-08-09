const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Basic Route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to CricSync API',
    version: '1.0.0',
    status: 'Running'
  });
});

// API Routes (Placeholder)
// app.use('/api/auth', require('./routes/authRoutes'));
// app.use('/api/players', require('./routes/playerRoutes'));
// app.use('/api/teams', require('./routes/teamRoutes'));
// app.use('/api/matches', require('./routes/matchRoutes'));
// app.use('/api/shop', require('./routes/shopRoutes'));

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

// Start Server
app.listen(PORT, () => {
  console.log(`CricSync Backend running on port ${PORT}`);
});

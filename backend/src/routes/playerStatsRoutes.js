const express = require('express');
const { validateObjectIdParams } = require('../middleware/validateObjectId');
const router = express.Router();

// 400 instead of a 500 + raw CastError when a route param is not an ObjectId.
validateObjectIdParams(router);
const {
  getPlayerStats,
  getAllPlayerStats,
  getTopBatsmen,
  getTopBowlers,
  getPlayerTrends,
  updatePlayerStats,
  comparePlayerStats
} = require('../controllers/playerStatsController');
const { protect } = require('../middleware/auth');

// Public routes
router.get('/', getAllPlayerStats);
router.get('/rankings/batsmen', getTopBatsmen);
router.get('/rankings/bowlers', getTopBowlers);
router.get('/compare', comparePlayerStats);
router.get('/:playerId', getPlayerStats);
router.get('/:playerId/trends', getPlayerTrends);

// Protected routes
router.post('/:playerId/update', protect, updatePlayerStats);

module.exports = router;

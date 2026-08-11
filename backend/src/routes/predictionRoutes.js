const express = require('express');
const router = express.Router();
const {
  submitPrediction,
  getMatchPrediction,
  getMyPredictions,
  getLeaderboard
} = require('../controllers/predictionController');
const { protect, optionalAuth } = require('../middleware/auth');

router.get('/leaderboard', getLeaderboard);
router.get('/me', protect, getMyPredictions);
router.get('/match/:matchId', optionalAuth, getMatchPrediction);
router.post('/', protect, submitPrediction);

module.exports = router;

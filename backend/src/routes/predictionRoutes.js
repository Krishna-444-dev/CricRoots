const express = require('express');
const { validateObjectIdParams } = require('../middleware/validateObjectId');
const router = express.Router();

// 400 instead of a 500 + raw CastError when a route param is not an ObjectId.
validateObjectIdParams(router);
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

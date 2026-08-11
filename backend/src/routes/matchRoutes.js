const express = require('express');
const router = express.Router();
const {
  createMatch,
  getAllMatches,
  getMatch,
  updateMatch,
  recordBall,
  getScorecard,
  getMatchCharts,
  getAIInsights,
  deleteMatch
} = require('../controllers/matchController');
const { protect } = require('../middleware/auth');

// Public routes
router.get('/', getAllMatches);
router.get('/:id', getMatch);
router.get('/:id/scorecard', getScorecard);
router.get('/:id/charts', getMatchCharts);
router.get('/:id/ai-insights', getAIInsights);

// Protected routes
router.post('/', protect, createMatch);
router.put('/:id', protect, updateMatch);
router.post('/:id/record-ball', protect, recordBall);
router.delete('/:id', protect, deleteMatch);

module.exports = router;

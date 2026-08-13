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
  getKeyMomentsForMatch,
  getPlayerPerformanceReport,
  applyInterruption,
  deleteMatch,
  addUmpire,
  removeUmpire
} = require('../controllers/matchController');
const { protect } = require('../middleware/auth');

// Public routes
router.get('/', getAllMatches);
router.get('/:id', getMatch);
router.get('/:id/scorecard', getScorecard);
router.get('/:id/charts', getMatchCharts);
router.get('/:id/ai-insights', getAIInsights);
router.get('/:id/key-moments', getKeyMomentsForMatch);
router.get('/:matchId/performance-report/:playerId', getPlayerPerformanceReport);

// Protected routes
router.post('/', protect, createMatch);
router.put('/:id', protect, updateMatch);
router.post('/:id/record-ball', protect, recordBall);
router.post('/:id/apply-interruption', protect, applyInterruption);
router.post('/:id/umpires', protect, addUmpire);
router.delete('/:id/umpires/:userId', protect, removeUmpire);
router.delete('/:id', protect, deleteMatch);

module.exports = router;

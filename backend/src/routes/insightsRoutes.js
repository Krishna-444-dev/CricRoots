const express = require('express');
const router = express.Router();
const {
  getShotAdvice,
  getBowlingPlan,
  getFieldingPlan,
  getBowlerScouting,
  getMatchupPlan,
  getLiveMatchupPlan
} = require('../controllers/insightsController');

router.get('/batsman/:playerId/shot-advice', getShotAdvice);
router.get('/batsman/:playerId/bowling-plan', getBowlingPlan);
router.get('/batsman/:playerId/fielding-plan', getFieldingPlan);
router.get('/teams/:teamId/bowler-scouting', getBowlerScouting);
router.get('/matchup/:batsmanId/:bowlerId/bowling-plan', getMatchupPlan);
router.get('/matchup/:batsmanId/:bowlerId/live-bowling-plan', getLiveMatchupPlan);

module.exports = router;

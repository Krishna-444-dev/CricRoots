const express = require('express');
const { validateObjectIdParams } = require('../middleware/validateObjectId');
const router = express.Router();

// 400 instead of a 500 + raw CastError when a route param is not an ObjectId.
validateObjectIdParams(router);
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

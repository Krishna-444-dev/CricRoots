const express = require('express');
const { validateObjectIdParams } = require('../middleware/validateObjectId');
const router = express.Router();

// 400 instead of a 500 + raw CastError when a route param is not an ObjectId.
validateObjectIdParams(router);
const {
  createMatch,
  getAllMatches,
  getMatch,
  updateMatch,
  recordBall,
  getScorecard,
  getMatchCharts,
  getMatchMVP,
  getPostMatchTacticalReport,
  getAIInsights,
  getNextBowlerRecommendation,
  getKeyMomentsForMatch,
  getPlayerPerformanceReport,
  applyInterruption,
  deleteMatch,
  addUmpire,
  removeUmpire,
  addMatchDocument,
  removeMatchDocument,
  addMatchPhoto,
  removeMatchPhoto,
  acquireScoringLock,
  releaseScoringLock
} = require('../controllers/matchController');
const { protect } = require('../middleware/auth');
const { uploadTournamentDocument, uploadMatchPhoto } = require('../middleware/upload');

// Public routes
router.get('/', getAllMatches);
router.get('/:id', getMatch);
router.get('/:id/scorecard', getScorecard);
router.get('/:id/charts', getMatchCharts);
router.get('/:id/mvp', getMatchMVP);
router.get('/:id/tactical-report', getPostMatchTacticalReport);
router.get('/:id/ai-insights', getAIInsights);
router.get('/:id/next-bowler-recommendation', getNextBowlerRecommendation);
router.get('/:id/key-moments', getKeyMomentsForMatch);
router.get('/:matchId/performance-report/:playerId', getPlayerPerformanceReport);

// Protected routes
router.post('/', protect, createMatch);
router.put('/:id', protect, updateMatch);
router.post('/:id/record-ball', protect, recordBall);
router.post('/:id/apply-interruption', protect, applyInterruption);
router.post('/:id/umpires', protect, addUmpire);
router.delete('/:id/umpires/:userId', protect, removeUmpire);
router.post('/:id/scoring-lock', protect, acquireScoringLock);
router.delete('/:id/scoring-lock', protect, releaseScoringLock);
router.delete('/:id', protect, deleteMatch);

// multer's upload middleware is callback-based, not next()-throwing - wrap it so a rejected
// file (wrong type, too large) comes back as a normal JSON error response, same pattern as
// tournamentRoutes.js's document upload.
router.post('/:id/documents', protect, (req, res, next) => {
  uploadTournamentDocument(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'Upload failed' });
    }
    next();
  });
}, addMatchDocument);
router.delete('/:id/documents/:documentId', protect, removeMatchDocument);

// Same callback-wrapping reason as /documents above - multer's fileFilter/limits rejections are
// callback errors, not thrown/next()-forwarded ones.
router.post('/:id/photos', protect, (req, res, next) => {
  uploadMatchPhoto(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'Upload failed' });
    }
    next();
  });
}, addMatchPhoto);
router.delete('/:id/photos/:photoId', protect, removeMatchPhoto);

module.exports = router;

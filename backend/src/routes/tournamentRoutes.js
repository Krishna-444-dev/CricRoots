const express = require('express');
const router = express.Router();
const {
  createTournament,
  getAllTournaments,
  getMyTournaments,
  getTournament,
  updateTournament,
  registerTeam,
  getTournamentStandings,
  getTournamentMatches,
  getTournamentTeams,
  getTournamentStats,
  assignDivisions,
  assignGroups,
  generateFixtures,
  generateKnockoutStage,
  advanceKnockoutRound,
  computeAwards,
  getTournamentLeaderboard,
  deleteTournament,
  addTournamentDocument,
  removeTournamentDocument
} = require('../controllers/tournamentController');
const { getTournamentMessages, postTournamentMessage } = require('../controllers/messageController');
const { protect } = require('../middleware/auth');
const { uploadTournamentDocument } = require('../middleware/upload');

// Public routes
// /mine must be registered before /:id, or Express would match it as {id: 'mine'} instead
// (same ordering note as leagueRoutes.js's /mine).
router.get('/', getAllTournaments);
router.get('/mine', protect, getMyTournaments);
router.get('/:id', getTournament);
router.get('/:id/standings', getTournamentStandings);
router.get('/:id/matches', getTournamentMatches);
router.get('/:id/teams', getTournamentTeams);
router.get('/:id/statistics', getTournamentStats);
router.get('/:id/leaderboard', getTournamentLeaderboard);
router.get('/:id/messages', getTournamentMessages);

// Protected routes
router.post('/', protect, createTournament);
router.put('/:id', protect, updateTournament);
router.post('/:id/register-team', protect, registerTeam);
router.post('/:id/assign-divisions', protect, assignDivisions);
router.post('/:id/assign-groups', protect, assignGroups);
router.post('/:id/generate-fixtures', protect, generateFixtures);
router.post('/:id/generate-knockout-stage', protect, generateKnockoutStage);
router.post('/:id/advance-knockout-round', protect, advanceKnockoutRound);
router.post('/:id/compute-awards', protect, computeAwards);
router.delete('/:id', protect, deleteTournament);
router.post('/:id/messages', protect, postTournamentMessage);

// multer's upload middleware is callback-based, not next()-throwing - wrap it so a rejected
// file (wrong type, too large) comes back as a normal JSON error response, same pattern as
// groupRoutes.js's attachment upload.
router.post('/:id/documents', protect, (req, res, next) => {
  uploadTournamentDocument(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'Upload failed' });
    }
    next();
  });
}, addTournamentDocument);
router.delete('/:id/documents/:documentId', protect, removeTournamentDocument);

module.exports = router;

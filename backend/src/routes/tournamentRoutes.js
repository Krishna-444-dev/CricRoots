const express = require('express');
const router = express.Router();
const {
  createTournament,
  getAllTournaments,
  getTournament,
  updateTournament,
  registerTeam,
  getTournamentStandings,
  getTournamentMatches,
  getTournamentStats,
  generateFixtures,
  computeAwards,
  deleteTournament
} = require('../controllers/tournamentController');
const { getTournamentMessages, postTournamentMessage } = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

// Public routes
router.get('/', getAllTournaments);
router.get('/:id', getTournament);
router.get('/:id/standings', getTournamentStandings);
router.get('/:id/matches', getTournamentMatches);
router.get('/:id/statistics', getTournamentStats);
router.get('/:id/messages', getTournamentMessages);

// Protected routes
router.post('/', protect, createTournament);
router.put('/:id', protect, updateTournament);
router.post('/:id/register-team', protect, registerTeam);
router.post('/:id/generate-fixtures', protect, generateFixtures);
router.post('/:id/compute-awards', protect, computeAwards);
router.delete('/:id', protect, deleteTournament);
router.post('/:id/messages', protect, postTournamentMessage);

module.exports = router;

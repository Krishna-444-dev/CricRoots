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
  deleteTournament
} = require('../controllers/tournamentController');
const { protect } = require('../middleware/auth');

// Public routes
router.get('/', getAllTournaments);
router.get('/:id', getTournament);
router.get('/:id/standings', getTournamentStandings);
router.get('/:id/matches', getTournamentMatches);
router.get('/:id/statistics', getTournamentStats);

// Protected routes
router.post('/', protect, createTournament);
router.put('/:id', protect, updateTournament);
router.post('/:id/register-team', protect, registerTeam);
router.delete('/:id', protect, deleteTournament);

module.exports = router;

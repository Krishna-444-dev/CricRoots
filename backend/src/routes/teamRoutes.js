const express = require('express');
const router = express.Router();
const {
  createTeam,
  getAllTeams,
  getMyTeams,
  getTeam,
  updateTeam,
  addPlayerToTeam,
  removePlayerFromTeam,
  deleteTeam,
  setViceCaptain,
  addCoach,
  removeCoach
} = require('../controllers/teamController');
const { getTeamMessages, postTeamMessage } = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

// Public routes
// /mine must be registered before /:id, or Express would match it as {id: 'mine'} instead
// (same ordering note as leagueRoutes.js's /mine).
router.get('/', getAllTeams);
router.get('/mine', protect, getMyTeams);
router.get('/:id', getTeam);

// Protected routes
router.post('/', protect, createTeam);
router.put('/:id', protect, updateTeam);
router.delete('/:id', protect, deleteTeam);
router.post('/:id/add-player', protect, addPlayerToTeam);
router.delete('/:id/remove-player/:playerId', protect, removePlayerFromTeam);
router.put('/:id/vice-captain', protect, setViceCaptain);
router.post('/:id/coaches', protect, addCoach);
router.delete('/:id/coaches/:playerId', protect, removeCoach);
router.get('/:id/messages', protect, getTeamMessages);
router.post('/:id/messages', protect, postTeamMessage);

module.exports = router;

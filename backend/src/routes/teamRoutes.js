const express = require('express');
const router = express.Router();
const {
  createTeam,
  getAllTeams,
  getTeam,
  updateTeam,
  addPlayerToTeam,
  removePlayerFromTeam,
  deleteTeam
} = require('../controllers/teamController');
const { getTeamMessages, postTeamMessage } = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

// Public routes
router.get('/', getAllTeams);
router.get('/:id', getTeam);

// Protected routes
router.post('/', protect, createTeam);
router.put('/:id', protect, updateTeam);
router.delete('/:id', protect, deleteTeam);
router.post('/:id/add-player', protect, addPlayerToTeam);
router.delete('/:id/remove-player/:playerId', protect, removePlayerFromTeam);
router.get('/:id/messages', protect, getTeamMessages);
router.post('/:id/messages', protect, postTeamMessage);

module.exports = router;

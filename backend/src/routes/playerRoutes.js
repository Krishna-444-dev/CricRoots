const express = require('express');
const router = express.Router();
const {
  registerPlayer,
  getPlayer,
  getAllPlayers,
  updatePlayer,
  getMyProfile
} = require('../controllers/playerController');
const { protect } = require('../middleware/auth');

// Public routes
router.get('/', getAllPlayers);
router.get('/:id', getPlayer);

// Protected routes
router.post('/register', protect, registerPlayer);
router.put('/:id', protect, updatePlayer);
router.get('/me/profile', protect, getMyProfile);

module.exports = router;

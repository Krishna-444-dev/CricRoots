const express = require('express');
const { validateObjectIdParams } = require('../middleware/validateObjectId');
const router = express.Router();

// 400 instead of a 500 + raw CastError when a route param is not an ObjectId.
validateObjectIdParams(router);
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

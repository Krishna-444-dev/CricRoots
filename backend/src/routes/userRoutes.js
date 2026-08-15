const express = require('express');
const router = express.Router();
const {
  getUser,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  updatePushToken,
  updateNotificationPreferences
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');

// Public routes
router.get('/:id', getUser);
router.get('/:id/followers', getFollowers);
router.get('/:id/following', getFollowing);

// Protected self-service routes - fixed paths ('/push-token', '/notification-preferences'), so
// no ordering conflict with the '/:id' routes above even though Express matches routes in
// registration order (different HTTP methods; there's no GET/PUT ambiguity here either way).
router.put('/push-token', protect, updatePushToken);
router.put('/notification-preferences', protect, updateNotificationPreferences);

router.post('/:id/follow', protect, followUser);
router.delete('/:id/follow', protect, unfollowUser);

module.exports = router;

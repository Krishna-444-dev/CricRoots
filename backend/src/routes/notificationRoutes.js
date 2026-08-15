const express = require('express');
const router = express.Router();
const {
  getMyNotifications,
  getUnreadCount,
  markRead,
  markAllRead
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

// All notification routes are private - there's no public/anonymous access to anyone's feed,
// same as directMessageRoutes.js.
router.use(protect);

// /unread-count and /read-all are their own single-segment paths (not `/:id/...`), so
// registration order relative to `/:id/read` doesn't actually matter here - kept grouped by
// verb for readability, matching directMessageRoutes.js's ordering comment convention anyway.
router.get('/', getMyNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);

module.exports = router;

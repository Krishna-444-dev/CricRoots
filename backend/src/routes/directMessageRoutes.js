const express = require('express');
const { validateObjectIdParams } = require('../middleware/validateObjectId');
const router = express.Router();

// 400 instead of a 500 + raw CastError when a route param is not an ObjectId.
validateObjectIdParams(router);
const {
  getConversations,
  getUnreadCount,
  getThread,
  sendMessage
} = require('../controllers/directMessageController');
const { protect } = require('../middleware/auth');

// All DM routes are private - there's no public/anonymous access to anyone's inbox.
router.use(protect);

// /conversations and /unread-count must be registered before /:userId, or Express would match
// them as a userId param.
router.get('/conversations', getConversations);
router.get('/unread-count', getUnreadCount);
router.get('/:userId', getThread);
router.post('/:userId', sendMessage);

module.exports = router;

const express = require('express');
const router = express.Router();
const {
  getMyGroups,
  createGroup,
  getGroup,
  updateGroup,
  leaveGroup,
  deleteGroup
} = require('../controllers/groupController');
const {
  getGroupMessages,
  postGroupMessage,
  createPoll,
  voteOnPoll,
  postGroupAttachment
} = require('../controllers/groupMessageController');
const { protect } = require('../middleware/auth');
const { uploadGroupAttachment } = require('../middleware/upload');

// All group routes are private - groups are member-only by design, no public/anonymous access.
router.use(protect);

router.get('/', getMyGroups);
router.post('/', createGroup);
router.get('/:id', getGroup);
router.put('/:id', updateGroup);
router.delete('/:id', deleteGroup);
router.post('/:id/leave', leaveGroup);

router.get('/:id/messages', getGroupMessages);
router.post('/:id/messages', postGroupMessage);
router.post('/:id/polls', createPoll);
router.post('/:id/polls/:messageId/vote', voteOnPoll);

// multer's upload middleware is callback-based, not next()-throwing - wrap it so a rejected file
// (wrong type, too large) comes back as a normal JSON error response instead of an Express
// default HTML error page or an unhandled exception.
router.post('/:id/attachments', (req, res, next) => {
  uploadGroupAttachment(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'Upload failed' });
    }
    next();
  });
}, postGroupAttachment);

module.exports = router;

const express = require('express');
const { validateObjectIdParams } = require('../middleware/validateObjectId');
const router = express.Router();

// 400 instead of a 500 + raw CastError when a route param is not an ObjectId.
validateObjectIdParams(router);
const { createPoll, getPolls, votePoll, closePoll } = require('../controllers/pollController');
const { protect, optionalAuth } = require('../middleware/auth');

// Public read (same as tournament announcements) - optionalAuth so an authenticated viewer's
// own vote is included in the response without requiring login just to browse results.
router.get('/', optionalAuth, getPolls);

router.post('/', protect, createPoll);
router.post('/:id/vote', protect, votePoll);
router.patch('/:id/close', protect, closePoll);

module.exports = router;

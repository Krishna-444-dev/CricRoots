const express = require('express');
const { validateObjectIdParams } = require('../middleware/validateObjectId');
const router = express.Router();

// 400 instead of a 500 + raw CastError when a route param is not an ObjectId.
validateObjectIdParams(router);
const { getCurrentTrivia, answerTrivia } = require('../controllers/triviaController');
const { protect, optionalAuth } = require('../middleware/auth');

router.get('/current', optionalAuth, getCurrentTrivia);
router.post('/:id/answer', protect, answerTrivia);

module.exports = router;

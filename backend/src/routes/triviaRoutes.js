const express = require('express');
const router = express.Router();
const { getCurrentTrivia, answerTrivia } = require('../controllers/triviaController');
const { protect, optionalAuth } = require('../middleware/auth');

router.get('/current', optionalAuth, getCurrentTrivia);
router.post('/:id/answer', protect, answerTrivia);

module.exports = router;

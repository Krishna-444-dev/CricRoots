const express = require('express');
const router = express.Router();
const { getAllLessons, getLesson, createLesson, deleteLesson } = require('../controllers/lessonController');
const { protect } = require('../middleware/auth');

// Public routes
router.get('/', getAllLessons);
router.get('/:id', getLesson);

// Protected routes
router.post('/', protect, createLesson);
router.delete('/:id', protect, deleteLesson);

module.exports = router;

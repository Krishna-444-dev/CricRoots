const express = require('express');
const router = express.Router();
const { getAllLessons, getLesson, createLesson, deleteLesson, getPersonalizedLessons } = require('../controllers/lessonController');
const { protect } = require('../middleware/auth');

// /for-me must be registered before /:id, or Express would match "for-me" as an :id param.
router.get('/for-me', protect, getPersonalizedLessons);

// Public routes
router.get('/', getAllLessons);
router.get('/:id', getLesson);

// Protected routes
router.post('/', protect, createLesson);
router.delete('/:id', protect, deleteLesson);

module.exports = router;

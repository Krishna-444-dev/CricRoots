const express = require('express');
const { validateObjectIdParams } = require('../middleware/validateObjectId');
const router = express.Router();

// 400 instead of a 500 + raw CastError when a route param is not an ObjectId.
validateObjectIdParams(router);
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

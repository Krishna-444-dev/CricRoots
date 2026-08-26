const express = require('express');
const { validateObjectIdParams } = require('../middleware/validateObjectId');
const router = express.Router();

// 400 instead of a 500 + raw CastError when a route param is not an ObjectId.
validateObjectIdParams(router);
const { getAllNews, getMyFeed, getNewsPost, createNewsPost, deleteNewsPost } = require('../controllers/newsController');
const { protect } = require('../middleware/auth');

// /feed must be registered before /:id, or Express would match "feed" as an :id param.
router.get('/feed', protect, getMyFeed);

// Public routes
router.get('/', getAllNews);
router.get('/:id', getNewsPost);

// Protected routes
router.post('/', protect, createNewsPost);
router.delete('/:id', protect, deleteNewsPost);

module.exports = router;

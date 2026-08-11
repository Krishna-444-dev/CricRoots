const express = require('express');
const router = express.Router();
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

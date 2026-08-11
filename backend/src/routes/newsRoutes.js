const express = require('express');
const router = express.Router();
const { getAllNews, getNewsPost, createNewsPost, deleteNewsPost } = require('../controllers/newsController');
const { protect } = require('../middleware/auth');

// Public routes
router.get('/', getAllNews);
router.get('/:id', getNewsPost);

// Protected routes
router.post('/', protect, createNewsPost);
router.delete('/:id', protect, deleteNewsPost);

module.exports = router;

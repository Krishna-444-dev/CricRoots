const express = require('express');
const router = express.Router();
const { getAllProducts, getProduct, createProduct, deleteProduct } = require('../controllers/productController');
const { protect } = require('../middleware/auth');

// Public routes
router.get('/', getAllProducts);
router.get('/:id', getProduct);

// Protected routes
router.post('/', protect, createProduct);
router.delete('/:id', protect, deleteProduct);

module.exports = router;

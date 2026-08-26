const express = require('express');
const { validateObjectIdParams } = require('../middleware/validateObjectId');
const router = express.Router();

// 400 instead of a 500 + raw CastError when a route param is not an ObjectId.
validateObjectIdParams(router);
const { getAllProducts, getProduct, createProduct, deleteProduct } = require('../controllers/productController');
const { protect } = require('../middleware/auth');

// Public routes
router.get('/', getAllProducts);
router.get('/:id', getProduct);

// Protected routes
router.post('/', protect, createProduct);
router.delete('/:id', protect, deleteProduct);

module.exports = router;

const express = require('express');
const router = express.Router();
const { createOrder, getMyOrders, getSellingOrders, updateOrderStatus } = require('../controllers/orderController');
const { protect } = require('../middleware/auth');

router.post('/', protect, createOrder);
router.get('/my', protect, getMyOrders);
router.get('/selling', protect, getSellingOrders);
router.put('/:id/status', protect, updateOrderStatus);

module.exports = router;

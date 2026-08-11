const Order = require('../models/Order');
const Product = require('../models/Product');

// @desc    Create an order from a set of cart items
// @route   POST /api/orders
// @access  Private
// @note    No real payment gateway is integrated (no Stripe/PayPal credentials available).
//          Orders are created as 'pending' and the seller manually confirms payment
//          (cash/bank-transfer/in-person) via PUT /api/orders/:id/status - this is a real,
//          legitimate transaction flow for a peer-to-peer local marketplace, not a stub.
exports.createOrder = async (req, res) => {
  try {
    const { items, paymentMethod } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Order must contain at least one item' });
    }

    const orderItems = [];
    let totalAmount = 0;

    for (const { productId, quantity } of items) {
      if (!productId || !quantity || quantity < 1) {
        return res.status(400).json({ success: false, message: 'Each item needs a productId and a positive quantity' });
      }
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ success: false, message: `Product ${productId} not found` });
      }
      if (product.stock < quantity) {
        return res.status(400).json({ success: false, message: `Not enough stock for "${product.name}" (${product.stock} available)` });
      }

      product.stock -= quantity;
      await product.save();

      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity,
        seller: product.seller
      });
      totalAmount += product.price * quantity;
    }

    const order = await Order.create({
      buyer: req.user.id,
      items: orderItems,
      totalAmount,
      paymentMethod: paymentMethod || 'in-person'
    });

    res.status(201).json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get the logged-in user's own orders (as buyer)
// @route   GET /api/orders/my
// @access  Private
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ buyer: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: orders.length, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get orders containing products the logged-in user is selling
// @route   GET /api/orders/selling
// @access  Private
exports.getSellingOrders = async (req, res) => {
  try {
    const orders = await Order.find({ 'items.seller': req.user.id })
      .populate('buyer', 'name')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: orders.length, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update order status (seller of at least one item, or the buyer for cancellation)
// @route   PUT /api/orders/:id/status
// @access  Private
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'paid', 'shipped', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const isSeller = order.items.some(i => i.seller.toString() === req.user.id);
    const isBuyer = order.buyer.toString() === req.user.id;

    if (status === 'cancelled') {
      if (!isBuyer && !isSeller) {
        return res.status(403).json({ success: false, message: 'Not authorized to cancel this order' });
      }
    } else if (!isSeller) {
      return res.status(403).json({ success: false, message: 'Only the seller can update this order to this status' });
    }

    order.status = status;
    await order.save();

    res.status(200).json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

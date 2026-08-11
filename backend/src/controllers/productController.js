const Product = require('../models/Product');

// @desc    Get all products
// @route   GET /api/products
// @access  Public
exports.getAllProducts = async (req, res) => {
  try {
    const { category } = req.query;
    const query = category ? { category } : {};

    const products = await Product.find(query)
      .populate('seller', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: products.length, products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get a single product
// @route   GET /api/products/:id
// @access  Public
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('seller', 'name');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.status(200).json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    List a product for sale
// @route   POST /api/products
// @access  Private
exports.createProduct = async (req, res) => {
  try {
    const { name, description, category, price, stock, imageUrl } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ success: false, message: 'Please provide a name and price' });
    }
    if (price < 0 || (stock !== undefined && stock < 0)) {
      return res.status(400).json({ success: false, message: 'Price and stock must not be negative' });
    }

    let product = await Product.create({
      name, description, category, price, stock: stock ?? 1, imageUrl, seller: req.user.id
    });
    await product.populate('seller', 'name');

    res.status(201).json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a product listing (seller only)
// @route   DELETE /api/products/:id
// @access  Private
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    if (product.seller.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this listing' });
    }
    await Product.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Listing deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

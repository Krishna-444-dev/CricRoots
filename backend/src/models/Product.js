const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a product name'],
      trim: true,
      maxlength: 150
    },
    description: {
      type: String,
      maxlength: 2000
    },
    category: {
      type: String,
      enum: ['equipment', 'apparel', 'accessories', 'other'],
      default: 'other'
    },
    price: {
      type: Number,
      required: [true, 'Please add a price'],
      min: 0
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 1
    },
    imageUrl: {
      type: String,
      default: null
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

productSchema.index({ category: 1, createdAt: -1 });

module.exports = mongoose.model('Product', productSchema);

const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: false // Will be populated after order creation if product exists
  },
  // Store original frontend product ID for reference
  frontendProductId: {
    type: String,
    required: true
  },
  // Store product details directly to ensure data integrity
  productDetails: {
    name: {
      type: String,
      required: true
    },
    size: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    image: String,
    category: String
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true
  },
  total: {
    type: Number,
    required: true
  }
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true // Only allow authenticated user orders
  },
  customer: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: true
    },
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      country: String,
      fullAddress: {
        type: String,
        required: true
      }
    }
  },
  items: [orderItemSchema],
  subtotal: {
    type: Number,
    required: true
  },
  shipping: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['upi', 'card', 'cash', 'bank_transfer', 'cod'],
    default: 'upi'
  },
  paymentDetails: {
    // Razorpay payment details
    razorpay_order_id: String,
    razorpay_payment_id: String,
    razorpay_signature: String,
    payment_method: String,
    vpa: String, // UPI VPA
    bank: String,
    amount_paid: Number,
    fee: Number,
    tax: Number,
    payment_date: Date,
    
    // Legacy fields for backward compatibility
    transactionId: String,
    upiId: String,
    paymentDate: Date,
    
    // Test mode indicator
    test_mode: {
      type: Boolean,
      default: false
    }
  },
  notes: {
    type: String,
    trim: true
  },
  trackingNumber: {
    type: String
  },
  estimatedDelivery: {
    type: Date
  },
  deliveredAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Generate order number before saving
orderSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = `SRR${String(count + 1).padStart(6, '0')}`;
  }
  this.updatedAt = Date.now();
  next();
});

// Calculate totals before saving
orderSchema.pre('save', function(next) {
  this.subtotal = this.items.reduce((sum, item) => sum + item.total, 0);
  this.total = this.subtotal + this.shipping + this.tax;
  next();
});

module.exports = mongoose.model('Order', orderSchema);
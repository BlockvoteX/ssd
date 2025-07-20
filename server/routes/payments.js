const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const User = require('../models/User');
const Product = require('../models/Product');

const router = express.Router();

// Ensure upload directory exists
const uploadDir = 'uploads/payment-screenshots/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'payment-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Apply authentication to all payment routes
// REMOVED: router.use(authenticateToken); - Allow public access to UPI info and order creation

// POST /api/payments/create-upi-order
// Create UPI order with payment screenshot upload
router.post('/create-upi-order', upload.single('paymentScreenshot'), async (req, res) => {
  try {
    const { shippingAddress, notes = '', upiTransactionId = '' } = req.body;

    // Get user details
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's cart
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    // Validate stock availability
    for (const item of cart.items) {
      if (item.product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${item.product.name}`
        });
      }
    }

    // Prepare order items
    const orderItems = cart.items.map(item => ({
      product: item.product._id,
      quantity: item.quantity,
      price: item.price,
      total: item.total
    }));

    // Use shipping address
    const finalAddress = shippingAddress ? {
      ...shippingAddress,
      fullAddress: `${shippingAddress.street}, ${shippingAddress.city}, ${shippingAddress.state} - ${shippingAddress.zipCode}`
    } : {
      street: user.address?.street || 'Not provided',
      city: user.address?.city || 'Not provided',
      state: user.address?.state || 'Not provided',
      pincode: user.address?.pincode || '000000',
      country: user.address?.country || 'India',
      fullAddress: `${user.address?.street || 'Address'}, ${user.address?.city || 'City'}, ${user.address?.state || 'State'} - ${user.address?.pincode || '000000'}`
    };

    // Calculate totals
    const shipping = 50;
    const tax = Math.round(cart.subtotal * 0.05);
    const total = cart.subtotal + shipping + tax;

    // Generate order number
    const orderNumber = `SRR-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    // Create order with UPI payment details
    const order = new Order({
      orderNumber: orderNumber,
      user: req.user._id,
      customer: {
        name: user.fullName || user.name || user.email,
        email: user.email,
        phone: user.phone || 'Not provided',
        address: finalAddress
      },
      items: orderItems,
      subtotal: cart.subtotal,
      shipping: shipping,
      tax: tax,
      total: total,
      paymentMethod: 'upi',
      paymentStatus: 'pending_verification', // Waiting for admin approval
      status: 'payment_pending', // Order pending until payment approved
      paymentDetails: {
        upi_transaction_id: upiTransactionId,
        payment_screenshot: req.file ? req.file.filename : null,
        payment_date: new Date(),
        upi_id: '9490507045-4@ybl', // Your UPI ID
        amount_paid: total,
        verification_status: 'pending'
      },
      notes: notes
    });

    await order.save();

    // Don't update stock or clear cart yet - wait for admin approval

    // Populate the order for response
    await order.populate('items.product');

    res.json({
      success: true,
      message: 'UPI payment order created successfully. Waiting for admin verification.',
      order: order,
      paymentInfo: {
        upiId: '9490507045-4@ybl',
        amount: total,
        orderNumber: orderNumber,
        qrCodeUrl: '/images/upi-qr-code.png' // You'll need to add this image
      }
    });

  } catch (error) {
    console.error('Create UPI order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating UPI order'
    });
  }
});

// POST /api/payments/create-cod-order
// Create Cash on Delivery order
router.post('/create-cod-order', authenticateToken, async (req, res) => {
  try {
    const { shippingAddress, notes = '' } = req.body;

    // Only allow authenticated users to place COD orders
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to place orders.'
      });
    }

    // Get user details
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's cart
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    // Validate stock availability
    for (const item of cart.items) {
      if (item.product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${item.product.name}`
        });
      }
    }

    // Prepare order items
    const orderItems = cart.items.map(item => ({
      product: item.product._id,
      quantity: item.quantity,
      price: item.price,
      total: item.total
    }));

    // Use shipping address
    const finalAddress = shippingAddress ? {
      ...shippingAddress,
      fullAddress: `${shippingAddress.street}, ${shippingAddress.city}, ${shippingAddress.state} - ${shippingAddress.zipCode}`
    } : {
      street: user.address?.street || 'Not provided',
      city: user.address?.city || 'Not provided',
      state: user.address?.state || 'Not provided',
      pincode: user.address?.pincode || '000000',
      country: user.address?.country || 'India',
      fullAddress: `${user.address?.street || 'Address'}, ${user.address?.city || 'City'}, ${user.address?.state || 'State'} - ${user.address?.pincode || '000000'}`
    };

    // Calculate totals
    const shipping = 50;
    const tax = Math.round(cart.subtotal * 0.05);
    const total = cart.subtotal + shipping + tax;

    // Generate order number
    const orderNumber = `SRR-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    // Create COD order
    const order = new Order({
      orderNumber: orderNumber,
      user: req.user._id,
      customer: {
        name: user.fullName || user.name || user.email,
        email: user.email,
        phone: user.phone || 'Not provided',
        address: finalAddress
      },
      items: orderItems,
      subtotal: cart.subtotal,
      shipping: shipping,
      tax: tax,
      total: total,
      paymentMethod: 'cash',
      paymentStatus: 'pending', // Will be paid on delivery
      status: 'confirmed', // COD orders are automatically confirmed
      paymentDetails: {
        payment_method: 'cash_on_delivery',
        amount_to_collect: total
      },
      notes: notes
    });

    await order.save();

    // Update product stock for COD orders
    for (const item of cart.items) {
      await Product.findByIdAndUpdate(
        item.product._id,
        { $inc: { stock: -item.quantity } }
      );
    }

    // Clear user's cart
    await cart.clearCart();

    // Populate the order for response
    await order.populate('items.product');

    res.json({
      success: true,
      message: 'Cash on Delivery order created successfully',
      order: order
    });

  } catch (error) {
    console.error('Create COD order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating COD order'
    });
  }
});

// GET /api/payments/order/:orderId
// Get payment details for an order
router.get('/order/:orderId', async (req, res) => {
  try {
    const order = await Order.findOne({
      $or: [
        { _id: req.params.orderId },
        { orderNumber: req.params.orderId }
      ],
      user: req.user._id
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      order: {
        orderNumber: order.orderNumber,
        total: order.total,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        paymentDetails: order.paymentDetails,
        status: order.status,
        createdAt: order.createdAt
      }
    });

  } catch (error) {
    console.error('Get payment order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment details'
    });
  }
});

// GET /api/payments/upi-info
// Get UPI payment information (QR code, UPI ID)
router.get('/upi-info', (req, res) => {
  res.json({
    success: true,
    upiInfo: {
      upiId: '9490507045-4@ybl',
      merchantName: 'SRR Farms',
      qrCodeUrl: '/images/upi-qr-code.svg',
      instructions: [
        'Scan the QR code or use the UPI ID to make payment',
        'Enter the exact order amount',
        'Take a screenshot of the successful payment',
        'Upload the screenshot when placing the order',
        'Your order will be confirmed after admin verification'
      ]
    }
  });
});

// Admin routes for payment verification
router.use(requireAdmin);

// GET /api/payments/admin/pending-verifications
// Get all UPI payments pending verification
router.get('/admin/pending-verifications', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const pendingOrders = await Order.find({
      paymentMethod: 'upi',
      paymentStatus: 'pending_verification'
    })
    .populate('user', 'fullName email phone')
    .populate('items.product', 'name image')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await Order.countDocuments({
      paymentMethod: 'upi',
      paymentStatus: 'pending_verification'
    });

    res.json({
      success: true,
      orders: pendingOrders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get pending verifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending verifications'
    });
  }
});

// POST /api/payments/admin/verify-payment/:orderId
// Approve or reject UPI payment
router.post('/admin/verify-payment/:orderId', async (req, res) => {
  try {
    const { action, adminNotes = '' } = req.body; // action: 'approve' or 'reject'

    const order = await Order.findById(req.params.orderId).populate('items.product');
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (action === 'approve') {
      // Approve payment
      order.paymentStatus = 'paid';
      order.status = 'confirmed';
      order.paymentDetails.verification_status = 'approved';
      order.paymentDetails.verified_by = req.user._id;
      order.paymentDetails.verified_at = new Date();
      order.paymentDetails.admin_notes = adminNotes;

      // Update product stock
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product._id,
          { $inc: { stock: -item.quantity } }
        );
      }

      // Clear user's cart if it exists
      await Cart.findOneAndUpdate(
        { user: order.user },
        { $set: { items: [], subtotal: 0, itemCount: 0 } }
      );

    } else if (action === 'reject') {
      // Reject payment
      order.paymentStatus = 'failed';
      order.status = 'cancelled';
      order.paymentDetails.verification_status = 'rejected';
      order.paymentDetails.verified_by = req.user._id;
      order.paymentDetails.verified_at = new Date();
      order.paymentDetails.admin_notes = adminNotes;
    }

    await order.save();

    res.json({
      success: true,
      message: `Payment ${action}d successfully`,
      order: order
    });

  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying payment'
    });
  }
});

// POST /api/payments/admin/mark-delivered/:orderId
// Mark order as delivered
router.post('/admin/mark-delivered/:orderId', async (req, res) => {
  try {
    const { deliveryNotes = '' } = req.body;

    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Order must be confirmed before marking as delivered'
      });
    }

    order.status = 'delivered';
    order.deliveredAt = new Date();
    order.deliveryNotes = deliveryNotes;

    // If it was COD, mark payment as completed
    if (order.paymentMethod === 'cash') {
      order.paymentStatus = 'paid';
    }

    await order.save();

    res.json({
      success: true,
      message: 'Order marked as delivered successfully',
      order: order
    });

  } catch (error) {
    console.error('Mark delivered error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking order as delivered'
    });
  }
});

// Test endpoint to verify the payment system is working
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Payment system is operational',
    features: ['UPI with screenshot upload', 'COD payments', 'Admin verification']
  });
});

module.exports = router;

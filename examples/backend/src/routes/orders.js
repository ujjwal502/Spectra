const express = require('express');
const { body, validationResult } = require('express-validator');
const { db, utils } = require('../data/db');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const router = express.Router();

/**
 * @route   GET /api/orders
 * @desc    Get all orders (admin) or user's orders
 * @access  Private
 */
router.get('/', verifyToken, (req, res) => {
  let orders;

  if (req.user.role === 'admin') {
    // Admin can see all orders
    orders = [...db.orders];
  } else {
    // Regular user can only see their own orders
    orders = db.orders.filter((order) => order.userId === req.user.id);
  }

  // Add more details to the orders
  const detailedOrders = orders.map((order) => {
    // Add product details to order items
    const items = order.items.map((item) => {
      const product = db.products.find((p) => p.id === item.productId);
      return {
        ...item,
        product: product
          ? {
              id: product.id,
              name: product.name,
              price: product.price,
              category: product.category,
            }
          : { id: item.productId, name: 'Product not found' },
      };
    });

    // Add user details
    const user = db.users.find((u) => u.id === order.userId);

    return {
      ...order,
      items,
      user: user
        ? {
            id: user.id,
            username: user.username,
            email: user.email,
          }
        : { id: order.userId, username: 'User not found' },
    };
  });

  res.json(detailedOrders);
});

/**
 * @route   GET /api/orders/:id
 * @desc    Get order by ID
 * @access  Private
 */
router.get('/:id', verifyToken, (req, res) => {
  const order = db.orders.find((order) => order.id === req.params.id);

  if (!order) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Order not found',
    });
  }

  // Check if user has permission to view this order
  if (req.user.role !== 'admin' && order.userId !== req.user.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have permission to view this order',
    });
  }

  // Add product details to order items
  const items = order.items.map((item) => {
    const product = db.products.find((p) => p.id === item.productId);
    return {
      ...item,
      product: product
        ? {
            id: product.id,
            name: product.name,
            price: product.price,
            category: product.category,
          }
        : { id: item.productId, name: 'Product not found' },
    };
  });

  // Add user details
  const user = db.users.find((u) => u.id === order.userId);

  const detailedOrder = {
    ...order,
    items,
    user: user
      ? {
          id: user.id,
          username: user.username,
          email: user.email,
        }
      : { id: order.userId, username: 'User not found' },
  };

  res.json(detailedOrder);
});

/**
 * @route   POST /api/orders
 * @desc    Create a new order
 * @access  Private
 */
router.post(
  '/',
  [
    verifyToken,
    body('items', 'Items must be an array').isArray(),
    body('items.*.productId', 'Product ID is required').not().isEmpty(),
    body('items.*.quantity', 'Quantity must be a positive integer').isInt({ min: 1 }),
    body('shippingAddress', 'Shipping address is required').not().isEmpty(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        errors: errors.array(),
      });
    }

    const { items, shippingAddress } = req.body;

    // Validate products and calculate total
    let totalAmount = 0;
    const validatedItems = [];

    for (const item of items) {
      const product = db.products.find((p) => p.id === item.productId);

      if (!product) {
        return res.status(400).json({
          error: 'Invalid Product',
          message: `Product with ID ${item.productId} not found`,
        });
      }

      if (!product.inStock || product.quantity < item.quantity) {
        return res.status(400).json({
          error: 'Insufficient Stock',
          message: `Not enough stock for product: ${product.name}`,
        });
      }

      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      validatedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
        total: itemTotal,
      });

      // Update product quantity
      const productIndex = db.products.findIndex((p) => p.id === item.productId);
      db.products[productIndex].quantity -= item.quantity;

      // Update inStock status if needed
      if (db.products[productIndex].quantity <= 0) {
        db.products[productIndex].inStock = false;
      }
    }

    // Create new order
    const newOrder = {
      id: utils.generateId(),
      userId: req.user.id,
      items: validatedItems,
      totalAmount,
      shippingAddress,
      status: 'pending',
      createdAt: utils.now(),
      updatedAt: utils.now(),
    };

    // Add to database
    db.orders.push(newOrder);

    res.status(201).json(newOrder);
  },
);

/**
 * @route   PATCH /api/orders/:id/status
 * @desc    Update order status
 * @access  Private (Admin only)
 */
router.patch(
  '/:id/status',
  [
    verifyToken,
    verifyAdmin,
    body('status', 'Status is required').isIn([
      'pending',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
    ]),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        errors: errors.array(),
      });
    }

    const orderIndex = db.orders.findIndex((order) => order.id === req.params.id);

    if (orderIndex === -1) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Order not found',
      });
    }

    const order = db.orders[orderIndex];

    // Handle cancellation logic - restore product quantities
    if (req.body.status === 'cancelled' && order.status !== 'cancelled') {
      for (const item of order.items) {
        const productIndex = db.products.findIndex((p) => p.id === item.productId);
        if (productIndex !== -1) {
          db.products[productIndex].quantity += item.quantity;
          db.products[productIndex].inStock = true;
        }
      }
    }

    // Update order
    db.orders[orderIndex] = {
      ...order,
      status: req.body.status,
      updatedAt: utils.now(),
    };

    res.json(db.orders[orderIndex]);
  },
);

/**
 * @route   DELETE /api/orders/:id
 * @desc    Delete an order (admin only)
 * @access  Private (Admin only)
 */
router.delete('/:id', [verifyToken, verifyAdmin], (req, res) => {
  const orderIndex = db.orders.findIndex((order) => order.id === req.params.id);

  if (orderIndex === -1) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Order not found',
    });
  }

  // Get order before deletion
  const order = db.orders[orderIndex];

  // Restore product quantities if order was not cancelled
  if (order.status !== 'cancelled') {
    for (const item of order.items) {
      const productIndex = db.products.findIndex((p) => p.id === item.productId);
      if (productIndex !== -1) {
        db.products[productIndex].quantity += item.quantity;
        db.products[productIndex].inStock = true;
      }
    }
  }

  // Remove from database
  db.orders.splice(orderIndex, 1);

  res.json({
    message: 'Order deleted successfully',
  });
});

module.exports = router;

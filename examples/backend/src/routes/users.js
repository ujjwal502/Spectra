const express = require('express');
const { body, validationResult } = require('express-validator');
const { db, utils } = require('../data/db');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const router = express.Router();

/**
 * @route   GET /api/users
 * @desc    Get all users
 * @access  Private (Admin only)
 */
router.get('/', [verifyToken, verifyAdmin], (req, res) => {
  // Remove password from each user
  const users = db.users.map((user) => {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  });

  res.json(users);
});

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private
 */
router.get('/:id', verifyToken, (req, res) => {
  const user = db.users.find((user) => user.id === req.params.id);

  if (!user) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'User not found',
    });
  }

  // Only allow admin or the user themselves to see their details
  if (req.user.role !== 'admin' && req.user.id !== user.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have permission to view this user',
    });
  }

  // Remove password from response
  const { password, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
});

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Private
 */
router.put(
  '/:id',
  [
    verifyToken,
    body('username').optional().not().isEmpty().withMessage('Username cannot be empty'),
    body('email').optional().isEmail().withMessage('Must be a valid email'),
  ],
  (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        errors: errors.array(),
      });
    }

    // Find user
    const userIndex = db.users.findIndex((user) => user.id === req.params.id);
    if (userIndex === -1) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    // Only allow admin or the user themselves to update their details
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to update this user',
      });
    }

    const user = db.users[userIndex];

    // Update user (excluding sensitive fields)
    const updatedUser = {
      ...user,
      username: req.body.username || user.username,
      email: req.body.email || user.email,
      // Only admin can update role
      role: req.user.role === 'admin' && req.body.role ? req.body.role : user.role,
      updatedAt: utils.now(),
    };

    // Save updated user
    db.users[userIndex] = updatedUser;

    // Remove password from response
    const { password, ...userWithoutPassword } = updatedUser;
    res.json(userWithoutPassword);
  },
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user
 * @access  Private (Admin or self)
 */
router.delete('/:id', verifyToken, (req, res) => {
  const userIndex = db.users.findIndex((user) => user.id === req.params.id);

  if (userIndex === -1) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'User not found',
    });
  }

  // Only allow admin or the user themselves to delete their account
  if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have permission to delete this user',
    });
  }

  // Remove user
  db.users.splice(userIndex, 1);

  res.json({
    message: 'User deleted successfully',
  });
});

/**
 * @route   POST /api/users
 * @desc    Create a new user (admin only)
 * @access  Private (Admin only)
 */
router.post(
  '/',
  [
    verifyToken,
    verifyAdmin,
    body('username', 'Username is required').not().isEmpty(),
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
    body('role').optional().isIn(['admin', 'user']).withMessage('Role must be admin or user'),
  ],
  (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        errors: errors.array(),
      });
    }

    const { username, email, password, role = 'user' } = req.body;

    // Check if user already exists
    if (db.users.some((user) => user.email === email)) {
      return res.status(400).json({
        error: 'Creation Failed',
        message: 'User already exists with this email',
      });
    }

    // Create new user
    const newUser = {
      id: utils.generateId(),
      username,
      email,
      password, // In a real app, would hash this
      role,
      createdAt: utils.now(),
    };

    // Add to database
    db.users.push(newUser);

    // Remove password from response
    const { password: pw, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
  },
);

module.exports = router;

const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { db, utils } = require('../data/db');
const router = express.Router();

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get token
 * @access  Public
 */
router.post(
  '/login',
  [
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Password is required').exists(),
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

    const { email, password } = req.body;

    // Find user by email
    const user = db.users.find((user) => user.email === email);
    if (!user) {
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid credentials',
      });
    }

    // Simple password check (in a real app, would use bcrypt)
    if (user.password !== password) {
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid credentials',
      });
    }

    // Create payload for JWT
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    // Sign the token
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }, (err, token) => {
      if (err) throw err;
      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      });
    });
  },
);

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  [
    body('username', 'Username is required').not().isEmpty(),
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
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

    const { username, email, password } = req.body;

    // Check if user already exists
    if (db.users.some((user) => user.email === email)) {
      return res.status(400).json({
        error: 'Registration Failed',
        message: 'User already exists with this email',
      });
    }

    // Create new user
    const newUser = {
      id: utils.generateId(),
      username,
      email,
      password, // In a real app, would hash this
      role: 'user',
      createdAt: utils.now(),
    };

    // Add to database
    db.users.push(newUser);

    // Create payload for JWT
    const payload = {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
    };

    // Sign the token
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }, (err, token) => {
      if (err) throw err;
      res.status(200).json({
        message: 'User registered successfully',
        token,
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role,
        },
      });
    });
  },
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'No token provided or invalid token format',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user by id
    const user = db.users.find((user) => user.id === decoded.id);
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    // Return user without password
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }
});

module.exports = router;

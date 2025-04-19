const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { db, utils } = require('../data/db');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const router = express.Router();

/**
 * @route   GET /api/products
 * @desc    Get all products with optional filtering
 * @access  Public
 */
router.get(
  '/',
  [
    query('category').optional(),
    query('minPrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Min price must be a positive number'),
    query('maxPrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Max price must be a positive number'),
    query('inStock').optional().isBoolean().withMessage('inStock must be a boolean'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        errors: errors.array(),
      });
    }

    let filteredProducts = [...db.products];

    // Apply filters if provided
    if (req.query.category) {
      filteredProducts = filteredProducts.filter(
        (p) => p.category.toLowerCase() === req.query.category.toLowerCase(),
      );
    }

    if (req.query.minPrice) {
      filteredProducts = filteredProducts.filter((p) => p.price >= parseFloat(req.query.minPrice));
    }

    if (req.query.maxPrice) {
      filteredProducts = filteredProducts.filter((p) => p.price <= parseFloat(req.query.maxPrice));
    }

    if (req.query.inStock !== undefined) {
      const inStock = req.query.inStock === 'true';
      filteredProducts = filteredProducts.filter((p) => p.inStock === inStock);
    }

    // Add pagination metadata
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = filteredProducts.length;

    // Paginate results
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

    res.json({
      products: paginatedProducts,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  },
);

/**
 * @route   GET /api/products/:id
 * @desc    Get product by ID
 * @access  Public
 */
router.get('/:id', (req, res) => {
  const product = db.products.find((p) => p.id === req.params.id);

  if (!product) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Product not found',
    });
  }

  res.json(product);
});

/**
 * @route   POST /api/products
 * @desc    Create a new product
 * @access  Private (Admin only)
 */
router.post(
  '/',
  [
    verifyToken,
    verifyAdmin,
    body('name', 'Name is required').not().isEmpty(),
    body('description', 'Description is required').not().isEmpty(),
    body('price', 'Price must be a positive number').isFloat({ min: 0 }),
    body('category', 'Category is required').not().isEmpty(),
    body('quantity', 'Quantity must be a positive integer').optional().isInt({ min: 0 }),
    body('inStock', 'inStock must be a boolean').optional().isBoolean(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        errors: errors.array(),
      });
    }

    const { name, description, price, category, quantity = 0, inStock = true } = req.body;

    const newProduct = {
      id: utils.generateId(),
      name,
      description,
      price: parseFloat(price),
      category,
      quantity: parseInt(quantity),
      inStock: Boolean(inStock),
      createdAt: utils.now(),
    };

    db.products.push(newProduct);

    res.status(201).json(newProduct);
  },
);

/**
 * @route   PUT /api/products/:id
 * @desc    Update a product
 * @access  Private (Admin only)
 */
router.put(
  '/:id',
  [
    verifyToken,
    verifyAdmin,
    body('name').optional().not().isEmpty().withMessage('Name cannot be empty'),
    body('description').optional().not().isEmpty().withMessage('Description cannot be empty'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('category').optional().not().isEmpty().withMessage('Category cannot be empty'),
    body('quantity')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Quantity must be a positive integer'),
    body('inStock').optional().isBoolean().withMessage('inStock must be a boolean'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        errors: errors.array(),
      });
    }

    const productIndex = db.products.findIndex((p) => p.id === req.params.id);

    if (productIndex === -1) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Product not found',
      });
    }

    const product = db.products[productIndex];

    const updatedProduct = {
      ...product,
      name: req.body.name || product.name,
      description: req.body.description || product.description,
      price: req.body.price !== undefined ? parseFloat(req.body.price) : product.price,
      category: req.body.category || product.category,
      quantity: req.body.quantity !== undefined ? parseInt(req.body.quantity) : product.quantity,
      inStock: req.body.inStock !== undefined ? Boolean(req.body.inStock) : product.inStock,
      updatedAt: utils.now(),
    };

    db.products[productIndex] = updatedProduct;

    res.json(updatedProduct);
  },
);

/**
 * @route   DELETE /api/products/:id
 * @desc    Delete a product
 * @access  Private (Admin only)
 */
router.delete('/:id', [verifyToken, verifyAdmin], (req, res) => {
  const productIndex = db.products.findIndex((p) => p.id === req.params.id);

  if (productIndex === -1) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Product not found',
    });
  }

  db.products.splice(productIndex, 1);

  res.json({
    message: 'Product deleted successfully',
  });
});

/**
 * @route   GET /api/products/category/:category
 * @desc    Get products by category
 * @access  Public
 */
router.get('/category/:category', (req, res) => {
  const categoryProducts = db.products.filter(
    (p) => p.category.toLowerCase() === req.params.category.toLowerCase(),
  );

  res.json(categoryProducts);
});

/**
 * @route   PATCH /api/products/:id/stock
 * @desc    Update product stock
 * @access  Private (Admin only)
 */
router.patch(
  '/:id/stock',
  [
    verifyToken,
    verifyAdmin,
    body('quantity', 'Quantity must be a positive integer').isInt({ min: 0 }),
    body('inStock', 'inStock must be a boolean').optional().isBoolean(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        errors: errors.array(),
      });
    }

    const productIndex = db.products.findIndex((p) => p.id === req.params.id);

    if (productIndex === -1) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Product not found',
      });
    }

    const product = db.products[productIndex];

    // Update stock information
    const updatedProduct = {
      ...product,
      quantity: parseInt(req.body.quantity),
      inStock: req.body.inStock !== undefined ? Boolean(req.body.inStock) : product.inStock,
      updatedAt: utils.now(),
    };

    db.products[productIndex] = updatedProduct;

    res.json(updatedProduct);
  },
);

module.exports = router;

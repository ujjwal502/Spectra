const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { body, param, query, validationResult } = require('express-validator');
const swaggerUi = require('swagger-ui-express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// ============================================
// MULTER CONFIGURATION FOR FILE UPLOADS
// ============================================

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage for uploaded files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter for images
const imageFileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'), false);
    }
};

// Multer upload configurations
const uploadSingle = multer({
    storage: storage,
    fileFilter: imageFileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
}).single('image');

const uploadMultiple = multer({
    storage: storage,
    fileFilter: imageFileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
}).array('images', 5); // Max 5 images

const uploadFields = multer({
    storage: storage,
    fileFilter: imageFileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
}).fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 },
    { name: 'gallery', maxCount: 5 }
]);
const PORT = process.env.PORT || 3000;

// ============================================
// JWT CONFIGURATION
// ============================================

const JWT_SECRET = process.env.JWT_SECRET || 'spectra-demo-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'spectra-demo-refresh-secret-key';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// ============================================
// IN-MEMORY DATA STORES
// ============================================

let users = new Map();
let products = new Map();
let categories = new Map();
let orders = new Map();
let reviews = new Map();
let carts = new Map();
let coupons = new Map();
let addresses = new Map();
let wishlists = new Map();
let notifications = new Map();
let uploadedFiles = new Map(); // Store file metadata
let refreshTokens = new Set(); // Store valid refresh tokens
let blacklistedTokens = new Set(); // Store invalidated access tokens

let nextUserId = 1;
let nextProductId = 1;
let nextCategoryId = 1;
let nextOrderId = 1;
let nextReviewId = 1;
let nextAddressId = 1;
let nextNotificationId = 1;
let nextFileId = 1;

// ============================================
// INITIALIZE DEMO DATA
// ============================================

function initializeDemoData() {
    // Clear all data
    users.clear();
    products.clear();
    categories.clear();
    orders.clear();
    reviews.clear();
    carts.clear();
    coupons.clear();
    addresses.clear();
    wishlists.clear();
    notifications.clear();
    uploadedFiles.clear();
    refreshTokens.clear();
    blacklistedTokens.clear();

    // Default password for all demo users is "password123" (hashed)
    const defaultPasswordHash = bcrypt.hashSync('password123', 10);

    // Initialize Users with passwords
    users.set(1, { id: 1, name: 'John Doe', email: 'john.doe@example.com', password: defaultPasswordHash, age: 30, department: 'Engineering', role: 'admin', createdAt: '2024-01-01T10:00:00Z', isActive: true });
    users.set(2, { id: 2, name: 'Jane Smith', email: 'jane.smith@example.com', password: defaultPasswordHash, age: 28, department: 'Marketing', role: 'user', createdAt: '2024-01-02T10:00:00Z', isActive: true });
    users.set(3, { id: 3, name: 'Bob Johnson', email: 'bob.johnson@example.com', password: defaultPasswordHash, age: 35, department: 'Engineering', role: 'user', createdAt: '2024-01-03T10:00:00Z', isActive: true });
    users.set(4, { id: 4, name: 'Alice Brown', email: 'alice.brown@example.com', password: defaultPasswordHash, age: 32, department: 'Sales', role: 'manager', createdAt: '2024-01-04T10:00:00Z', isActive: true });
    users.set(5, { id: 5, name: 'Charlie Wilson', email: 'charlie.wilson@example.com', password: defaultPasswordHash, age: 45, department: 'HR', role: 'user', createdAt: '2024-01-05T10:00:00Z', isActive: false });
    nextUserId = 6;

    // Initialize Categories
    categories.set(1, { id: 1, name: 'Electronics', description: 'Electronic devices and gadgets', slug: 'electronics', parentId: null, isActive: true });
    categories.set(2, { id: 2, name: 'Clothing', description: 'Apparel and fashion items', slug: 'clothing', parentId: null, isActive: true });
    categories.set(3, { id: 3, name: 'Books', description: 'Books and publications', slug: 'books', parentId: null, isActive: true });
    categories.set(4, { id: 4, name: 'Smartphones', description: 'Mobile phones and accessories', slug: 'smartphones', parentId: 1, isActive: true });
    categories.set(5, { id: 5, name: 'Laptops', description: 'Portable computers', slug: 'laptops', parentId: 1, isActive: true });
    categories.set(6, { id: 6, name: 'Men\'s Clothing', description: 'Clothing for men', slug: 'mens-clothing', parentId: 2, isActive: true });
    categories.set(7, { id: 7, name: 'Women\'s Clothing', description: 'Clothing for women', slug: 'womens-clothing', parentId: 2, isActive: true });
    nextCategoryId = 8;

    // Initialize Products
    products.set(1, { id: 1, name: 'iPhone 15 Pro', description: 'Latest Apple smartphone', price: 999.99, categoryId: 4, stock: 50, sku: 'IPH15PRO', brand: 'Apple', rating: 4.8, reviewCount: 245, isActive: true, createdAt: '2024-01-10T10:00:00Z', tags: ['smartphone', 'apple', 'premium'] });
    products.set(2, { id: 2, name: 'Samsung Galaxy S24', description: 'Samsung flagship phone', price: 899.99, categoryId: 4, stock: 75, sku: 'SGS24', brand: 'Samsung', rating: 4.6, reviewCount: 189, isActive: true, createdAt: '2024-01-11T10:00:00Z', tags: ['smartphone', 'samsung', 'android'] });
    products.set(3, { id: 3, name: 'MacBook Pro 16"', description: 'Apple laptop with M3 chip', price: 2499.99, categoryId: 5, stock: 30, sku: 'MBP16M3', brand: 'Apple', rating: 4.9, reviewCount: 312, isActive: true, createdAt: '2024-01-12T10:00:00Z', tags: ['laptop', 'apple', 'professional'] });
    products.set(4, { id: 4, name: 'Dell XPS 15', description: 'Premium Windows laptop', price: 1799.99, categoryId: 5, stock: 45, sku: 'DXPS15', brand: 'Dell', rating: 4.5, reviewCount: 156, isActive: true, createdAt: '2024-01-13T10:00:00Z', tags: ['laptop', 'dell', 'windows'] });
    products.set(5, { id: 5, name: 'Classic Oxford Shirt', description: 'Men\'s cotton oxford shirt', price: 59.99, categoryId: 6, stock: 200, sku: 'MOXFORD1', brand: 'ClassicWear', rating: 4.3, reviewCount: 89, isActive: true, createdAt: '2024-01-14T10:00:00Z', tags: ['shirt', 'mens', 'formal'] });
    products.set(6, { id: 6, name: 'Summer Floral Dress', description: 'Women\'s casual summer dress', price: 79.99, categoryId: 7, stock: 150, sku: 'WFLORAL1', brand: 'StyleCo', rating: 4.7, reviewCount: 234, isActive: true, createdAt: '2024-01-15T10:00:00Z', tags: ['dress', 'womens', 'summer'] });
    products.set(7, { id: 7, name: 'JavaScript: The Good Parts', description: 'Programming book by Douglas Crockford', price: 29.99, categoryId: 3, stock: 500, sku: 'JSGP1', brand: 'O\'Reilly', rating: 4.4, reviewCount: 1205, isActive: true, createdAt: '2024-01-16T10:00:00Z', tags: ['book', 'programming', 'javascript'] });
    products.set(8, { id: 8, name: 'Clean Code', description: 'A Handbook of Agile Software Craftsmanship', price: 39.99, categoryId: 3, stock: 350, sku: 'CLNCD1', brand: 'Prentice Hall', rating: 4.6, reviewCount: 2341, isActive: true, createdAt: '2024-01-17T10:00:00Z', tags: ['book', 'programming', 'best-practices'] });
    products.set(9, { id: 9, name: 'Wireless Earbuds Pro', description: 'Premium noise-canceling earbuds', price: 199.99, categoryId: 1, stock: 100, sku: 'WEPRO1', brand: 'SoundMax', rating: 4.2, reviewCount: 567, isActive: true, createdAt: '2024-01-18T10:00:00Z', tags: ['audio', 'wireless', 'earbuds'] });
    products.set(10, { id: 10, name: 'Smart Watch Ultra', description: 'Advanced fitness tracking smartwatch', price: 449.99, categoryId: 1, stock: 80, sku: 'SWU1', brand: 'TechFit', rating: 4.5, reviewCount: 432, isActive: true, createdAt: '2024-01-19T10:00:00Z', tags: ['smartwatch', 'fitness', 'wearable'] });
    nextProductId = 11;

    // Initialize Coupons
    coupons.set('SAVE10', { code: 'SAVE10', discount: 10, type: 'percentage', minPurchase: 50, maxUses: 100, usedCount: 45, expiresAt: '2025-12-31T23:59:59Z', isActive: true });
    coupons.set('FLAT20', { code: 'FLAT20', discount: 20, type: 'fixed', minPurchase: 100, maxUses: 50, usedCount: 12, expiresAt: '2025-06-30T23:59:59Z', isActive: true });
    coupons.set('NEWUSER', { code: 'NEWUSER', discount: 15, type: 'percentage', minPurchase: 0, maxUses: 1000, usedCount: 234, expiresAt: '2025-12-31T23:59:59Z', isActive: true });
    coupons.set('EXPIRED', { code: 'EXPIRED', discount: 50, type: 'percentage', minPurchase: 0, maxUses: 100, usedCount: 100, expiresAt: '2023-01-01T23:59:59Z', isActive: false });

    // Initialize Orders
    orders.set(1, { 
        id: 1, 
        userId: 1, 
        items: [{ productId: 1, quantity: 1, price: 999.99 }], 
        subtotal: 999.99, 
        discount: 0, 
        tax: 80.00, 
        total: 1079.99, 
        status: 'delivered', 
        paymentMethod: 'credit_card',
        paymentStatus: 'paid',
        shippingAddress: { street: '123 Main St', city: 'New York', state: 'NY', zipCode: '10001', country: 'USA' },
        createdAt: '2024-02-01T10:00:00Z',
        updatedAt: '2024-02-05T14:00:00Z'
    });
    orders.set(2, { 
        id: 2, 
        userId: 2, 
        items: [{ productId: 3, quantity: 1, price: 2499.99 }, { productId: 7, quantity: 2, price: 29.99 }], 
        subtotal: 2559.97, 
        discount: 255.99, 
        tax: 184.32, 
        total: 2488.30, 
        status: 'shipped', 
        paymentMethod: 'paypal',
        paymentStatus: 'paid',
        couponCode: 'SAVE10',
        shippingAddress: { street: '456 Oak Ave', city: 'Los Angeles', state: 'CA', zipCode: '90001', country: 'USA' },
        createdAt: '2024-02-10T10:00:00Z',
        updatedAt: '2024-02-12T14:00:00Z'
    });
    orders.set(3, { 
        id: 3, 
        userId: 1, 
        items: [{ productId: 5, quantity: 3, price: 59.99 }], 
        subtotal: 179.97, 
        discount: 0, 
        tax: 14.40, 
        total: 194.37, 
        status: 'processing', 
        paymentMethod: 'credit_card',
        paymentStatus: 'paid',
        shippingAddress: { street: '123 Main St', city: 'New York', state: 'NY', zipCode: '10001', country: 'USA' },
        createdAt: '2024-02-15T10:00:00Z',
        updatedAt: '2024-02-15T10:00:00Z'
    });
    orders.set(4, { 
        id: 4, 
        userId: 3, 
        items: [{ productId: 9, quantity: 1, price: 199.99 }], 
        subtotal: 199.99, 
        discount: 0, 
        tax: 16.00, 
        total: 215.99, 
        status: 'pending', 
        paymentMethod: 'credit_card',
        paymentStatus: 'pending',
        shippingAddress: { street: '789 Pine Rd', city: 'Chicago', state: 'IL', zipCode: '60601', country: 'USA' },
        createdAt: '2024-02-20T10:00:00Z',
        updatedAt: '2024-02-20T10:00:00Z'
    });
    orders.set(5, { 
        id: 5, 
        userId: 4, 
        items: [{ productId: 6, quantity: 2, price: 79.99 }, { productId: 10, quantity: 1, price: 449.99 }], 
        subtotal: 609.97, 
        discount: 60.99, 
        tax: 43.92, 
        total: 592.90, 
        status: 'cancelled', 
        paymentMethod: 'paypal',
        paymentStatus: 'refunded',
        couponCode: 'SAVE10',
        shippingAddress: { street: '321 Elm St', city: 'Houston', state: 'TX', zipCode: '77001', country: 'USA' },
        createdAt: '2024-02-22T10:00:00Z',
        updatedAt: '2024-02-23T09:00:00Z'
    });
    nextOrderId = 6;

    // Initialize Reviews
    reviews.set(1, { id: 1, productId: 1, userId: 2, rating: 5, title: 'Amazing phone!', comment: 'Best smartphone I\'ve ever owned. Camera is incredible.', isVerified: true, helpfulCount: 45, createdAt: '2024-02-05T10:00:00Z' });
    reviews.set(2, { id: 2, productId: 1, userId: 3, rating: 4, title: 'Great but expensive', comment: 'Excellent phone but the price is a bit high.', isVerified: true, helpfulCount: 23, createdAt: '2024-02-06T10:00:00Z' });
    reviews.set(3, { id: 3, productId: 3, userId: 1, rating: 5, title: 'Perfect for development', comment: 'The M3 chip is a beast. Compiles code so fast!', isVerified: true, helpfulCount: 89, createdAt: '2024-02-10T10:00:00Z' });
    reviews.set(4, { id: 4, productId: 7, userId: 4, rating: 4, title: 'Must read for JS devs', comment: 'Concise and insightful. A bit dated but still relevant.', isVerified: false, helpfulCount: 156, createdAt: '2024-02-12T10:00:00Z' });
    reviews.set(5, { id: 5, productId: 5, userId: 1, rating: 3, title: 'Decent quality', comment: 'Good shirt but runs a bit small. Order a size up.', isVerified: true, helpfulCount: 34, createdAt: '2024-02-15T10:00:00Z' });
    nextReviewId = 6;

    // Initialize Addresses
    addresses.set(1, { id: 1, userId: 1, label: 'Home', street: '123 Main St', city: 'New York', state: 'NY', zipCode: '10001', country: 'USA', isDefault: true });
    addresses.set(2, { id: 2, userId: 1, label: 'Work', street: '456 Business Ave', city: 'New York', state: 'NY', zipCode: '10002', country: 'USA', isDefault: false });
    addresses.set(3, { id: 3, userId: 2, label: 'Home', street: '456 Oak Ave', city: 'Los Angeles', state: 'CA', zipCode: '90001', country: 'USA', isDefault: true });
    addresses.set(4, { id: 4, userId: 3, label: 'Home', street: '789 Pine Rd', city: 'Chicago', state: 'IL', zipCode: '60601', country: 'USA', isDefault: true });
    nextAddressId = 5;

    // Initialize Wishlists
    wishlists.set(1, [2, 4, 10]); // User 1 wishlist
    wishlists.set(2, [1, 3, 8]); // User 2 wishlist
    wishlists.set(3, [6, 9]); // User 3 wishlist

    // Initialize Carts
    carts.set(1, { userId: 1, items: [{ productId: 2, quantity: 1 }, { productId: 8, quantity: 1 }], updatedAt: '2024-02-25T10:00:00Z' });
    carts.set(2, { userId: 2, items: [{ productId: 10, quantity: 1 }], updatedAt: '2024-02-24T10:00:00Z' });

    // Initialize Notifications
    notifications.set(1, { id: 1, userId: 1, type: 'order_shipped', title: 'Order Shipped', message: 'Your order #2 has been shipped!', isRead: false, createdAt: '2024-02-12T14:00:00Z' });
    notifications.set(2, { id: 2, userId: 1, type: 'promotion', title: 'Flash Sale!', message: 'Get 20% off on all electronics today!', isRead: true, createdAt: '2024-02-10T09:00:00Z' });
    notifications.set(3, { id: 3, userId: 2, type: 'review_helpful', title: 'Your review was helpful', message: '10 people found your review helpful!', isRead: false, createdAt: '2024-02-15T11:00:00Z' });
    nextNotificationId = 4;

    console.log('📦 [NODE-API] Demo data initialized');
}

// Initialize data on startup
initializeDemoData();

// ============================================
// VALIDATION MIDDLEWARE
// ============================================

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log(`❌ [NODE-API] Validation errors: ${JSON.stringify(errors.array())}`);
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    next();
};

const validateUser = [
    body('name').isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
    body('email').isEmail().withMessage('Email must be valid'),
    body('age').optional().isInt({ min: 18, max: 100 }).withMessage('Age must be between 18 and 100'),
    body('department').optional().isString(),
    body('role').optional().isIn(['admin', 'user', 'manager']).withMessage('Role must be admin, user, or manager')
];

const validateProduct = [
    body('name').isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('description').optional().isLength({ max: 1000 }),
    body('price').isFloat({ min: 0.01 }).withMessage('Price must be positive'),
    body('categoryId').isInt({ min: 1 }).withMessage('Category ID must be positive'),
    body('stock').optional().isInt({ min: 0 }).withMessage('Stock cannot be negative'),
    body('sku').optional().isString()
];

const validateCategory = [
    body('name').isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
    body('description').optional().isLength({ max: 500 }),
    body('parentId').optional().isInt({ min: 1 })
];

const validateOrder = [
    body('userId').isInt({ min: 1 }).withMessage('User ID must be positive'),
    body('items').isArray({ min: 1 }).withMessage('Order must have at least one item'),
    body('items.*.productId').isInt({ min: 1 }),
    body('items.*.quantity').isInt({ min: 1 }),
    body('shippingAddress').isObject(),
    body('paymentMethod').isIn(['credit_card', 'paypal', 'bank_transfer'])
];

const validateReview = [
    body('productId').isInt({ min: 1 }),
    body('userId').isInt({ min: 1 }),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('title').isLength({ min: 2, max: 100 }),
    body('comment').optional().isLength({ max: 2000 })
];

const validateId = [param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer')];

// ============================================
// HELPER FUNCTIONS
// ============================================

const isEmailUnique = (email, excludeId = null) => {
    for (const [id, user] of users) {
        if (user.email === email && id !== excludeId) return false;
    }
    return true;
};

const calculateCartTotal = (cartItems) => {
    let subtotal = 0;
    const itemDetails = [];
    for (const item of cartItems) {
        const product = products.get(item.productId);
        if (product && product.isActive) {
            const itemTotal = product.price * item.quantity;
            subtotal += itemTotal;
            itemDetails.push({ ...item, price: product.price, name: product.name, total: itemTotal });
        }
    }
    return { subtotal, itemDetails };
};

const applyCoupon = (code, subtotal) => {
    const coupon = coupons.get(code);
    if (!coupon || !coupon.isActive) return { valid: false, message: 'Invalid coupon code' };
    if (new Date(coupon.expiresAt) < new Date()) return { valid: false, message: 'Coupon has expired' };
    if (coupon.usedCount >= coupon.maxUses) return { valid: false, message: 'Coupon usage limit reached' };
    if (subtotal < coupon.minPurchase) return { valid: false, message: `Minimum purchase of $${coupon.minPurchase} required` };
    
    const discount = coupon.type === 'percentage' ? subtotal * (coupon.discount / 100) : coupon.discount;
    return { valid: true, discount, coupon };
};

// Helper to strip password from user object
const sanitizeUser = (user) => {
    if (!user) return null;
    const { password, ...safeUser } = user;
    return safeUser;
};

// Generate JWT tokens
const generateTokens = (user) => {
    const accessToken = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
    const refreshToken = jwt.sign(
        { userId: user.id, type: 'refresh' },
        JWT_REFRESH_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRY }
    );
    refreshTokens.add(refreshToken);
    return { accessToken, refreshToken };
};

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

// Verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Authentication required', message: 'No token provided' });
    }

    if (blacklistedTokens.has(token)) {
        return res.status(401).json({ error: 'Token revoked', message: 'This token has been invalidated' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token expired', message: 'Access token has expired' });
            }
            return res.status(403).json({ error: 'Invalid token', message: 'Token verification failed' });
        }
        
        const user = users.get(decoded.userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found', message: 'User associated with token no longer exists' });
        }
        if (!user.isActive) {
            return res.status(403).json({ error: 'Account disabled', message: 'Your account has been deactivated' });
        }
        
        req.user = decoded;
    req.token = token;
    next();
    });
};

// Optional authentication - doesn't fail if no token
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        req.user = null;
        return next();
    }

    if (blacklistedTokens.has(token)) {
        req.user = null;
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            req.user = null;
        } else {
            req.user = decoded;
        }
        next();
    });
};

// Role-based authorization
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                error: 'Forbidden', 
                message: `This action requires one of these roles: ${allowedRoles.join(', ')}` 
            });
        }
        next();
    };
};

// Check if user owns the resource or is admin
const requireOwnerOrAdmin = (userIdParam = 'id') => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const resourceUserId = parseInt(req.params[userIdParam] || req.params.userId);
        if (req.user.userId !== resourceUserId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden', message: 'You can only access your own resources' });
        }
        next();
    };
};

// Validation for auth endpoints
const validateRegister = [
    body('name').isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
    body('email').isEmail().withMessage('Email must be valid'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('age').optional().isInt({ min: 18, max: 100 }),
    body('department').optional().isString()
];

const validateLogin = [
    body('email').isEmail().withMessage('Email must be valid'),
    body('password').notEmpty().withMessage('Password is required')
];

const validateChangePassword = [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
];

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// Register new user
app.post('/api/v1/auth/register', validateRegister, handleValidationErrors, async (req, res) => {
    console.log('🔐 [NODE-API] POST /api/v1/auth/register');
    const { name, email, password, age, department } = req.body;

    if (!isEmailUnique(email)) {
        return res.status(400).json({ error: 'Registration failed', message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = nextUserId++;
    const newUser = {
        id, name, email, password: hashedPassword,
        age: age || null, department: department || null,
        role: 'user', createdAt: new Date().toISOString(), isActive: true
    };
    users.set(id, newUser);

    const tokens = generateTokens(newUser);
    console.log(`✅ [NODE-API] User registered: ${email}`);

    res.status(201).json({
        message: 'Registration successful',
        user: sanitizeUser(newUser),
        ...tokens
    });
});

// Login
app.post('/api/v1/auth/login', validateLogin, handleValidationErrors, async (req, res) => {
    console.log('🔐 [NODE-API] POST /api/v1/auth/login');
    const { email, password } = req.body;

    // Find user by email
    let foundUser = null;
    for (const user of users.values()) {
        if (user.email === email) {
            foundUser = user;
            break;
        }
    }

    if (!foundUser) {
        console.log(`❌ [NODE-API] Login failed: User not found - ${email}`);
        return res.status(401).json({ error: 'Authentication failed', message: 'Invalid email or password' });
    }

    if (!foundUser.isActive) {
        console.log(`❌ [NODE-API] Login failed: Account disabled - ${email}`);
        return res.status(403).json({ error: 'Account disabled', message: 'Your account has been deactivated' });
    }

    const validPassword = await bcrypt.compare(password, foundUser.password);
    if (!validPassword) {
        console.log(`❌ [NODE-API] Login failed: Invalid password - ${email}`);
        return res.status(401).json({ error: 'Authentication failed', message: 'Invalid email or password' });
    }

    const tokens = generateTokens(foundUser);
    console.log(`✅ [NODE-API] Login successful: ${email}`);

    res.json({
        message: 'Login successful',
        user: sanitizeUser(foundUser),
        ...tokens
    });
});

// Refresh token
app.post('/api/v1/auth/refresh', (req, res) => {
    console.log('🔐 [NODE-API] POST /api/v1/auth/refresh');
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' });
    }

    if (!refreshTokens.has(refreshToken)) {
        return res.status(403).json({ error: 'Invalid refresh token', message: 'Token not found or already used' });
    }

    jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err, decoded) => {
        if (err) {
            refreshTokens.delete(refreshToken);
            return res.status(403).json({ error: 'Invalid refresh token', message: 'Token verification failed' });
        }

        const user = users.get(decoded.userId);
        if (!user || !user.isActive) {
            refreshTokens.delete(refreshToken);
            return res.status(403).json({ error: 'User not found or disabled' });
        }

        // Remove old refresh token and generate new tokens
        refreshTokens.delete(refreshToken);
        const tokens = generateTokens(user);
        console.log(`✅ [NODE-API] Token refreshed for user: ${user.email}`);

        res.json({
            message: 'Token refreshed successfully',
            ...tokens
        });
    });
});

// Logout
app.post('/api/v1/auth/logout', authenticateToken, (req, res) => {
    console.log('🔐 [NODE-API] POST /api/v1/auth/logout');
    
    // Blacklist the current access token
    blacklistedTokens.add(req.token);
    
    // Remove refresh token if provided
    const { refreshToken } = req.body;
    if (refreshToken) {
        refreshTokens.delete(refreshToken);
    }

    console.log(`✅ [NODE-API] Logout successful for user: ${req.user.email}`);
    res.json({ message: 'Logout successful' });
});

// Logout from all devices
app.post('/api/v1/auth/logout-all', authenticateToken, (req, res) => {
    console.log('🔐 [NODE-API] POST /api/v1/auth/logout-all');
    
    // Blacklist current token
    blacklistedTokens.add(req.token);
    
    // Note: In a real app, you'd track all tokens per user
    // For demo, we'll just acknowledge the request
    console.log(`✅ [NODE-API] Logout from all devices for user: ${req.user.email}`);
    res.json({ message: 'Logged out from all devices' });
});

// Get current user profile
app.get('/api/v1/auth/me', authenticateToken, (req, res) => {
    console.log('🔐 [NODE-API] GET /api/v1/auth/me');
    
    const user = users.get(req.user.userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json(sanitizeUser(user));
});

// Update current user profile
app.patch('/api/v1/auth/me', authenticateToken, (req, res) => {
    console.log('🔐 [NODE-API] PATCH /api/v1/auth/me');
    
    const user = users.get(req.user.userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    const { name, age, department } = req.body;
    
    // Don't allow changing email, password, or role through this endpoint
    if (name) user.name = name;
    if (age !== undefined) user.age = age;
    if (department !== undefined) user.department = department;
    
    users.set(user.id, user);
    res.json(sanitizeUser(user));
});

// Change password
app.post('/api/v1/auth/change-password', authenticateToken, validateChangePassword, handleValidationErrors, async (req, res) => {
    console.log('🔐 [NODE-API] POST /api/v1/auth/change-password');
    
    const user = users.get(req.user.userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    const { currentPassword, newPassword } = req.body;
    
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
        return res.status(400).json({ error: 'Invalid password', message: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    users.set(user.id, user);
    
    // Invalidate current token (force re-login)
    blacklistedTokens.add(req.token);
    
    console.log(`✅ [NODE-API] Password changed for user: ${req.user.email}`);
    res.json({ message: 'Password changed successfully. Please login again.' });
});

// Verify token (useful for frontend to check if token is still valid)
app.get('/api/v1/auth/verify', authenticateToken, (req, res) => {
    console.log('🔐 [NODE-API] GET /api/v1/auth/verify');
    res.json({ 
        valid: true, 
        user: { userId: req.user.userId, email: req.user.email, role: req.user.role }
    });
});

// ============================================
// USER ROUTES (Admin/Manager access for most)
// ============================================

app.get('/api/v1/users', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    console.log('🔍 [NODE-API] GET /api/v1/users');
    const { department, role, isActive, page = 1, limit = 10 } = req.query;
    let userList = Array.from(users.values()).map(sanitizeUser);
    
    if (department) userList = userList.filter(u => u.department?.toLowerCase() === department.toLowerCase());
    if (role) userList = userList.filter(u => u.role === role);
    if (isActive !== undefined) userList = userList.filter(u => u.isActive === (isActive === 'true'));
    
    const total = userList.length;
    const startIndex = (page - 1) * limit;
    const paginatedUsers = userList.slice(startIndex, startIndex + parseInt(limit));
    
    res.json({ data: paginatedUsers, pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) } });
});

app.get('/api/v1/users/:id', authenticateToken, validateId, handleValidationErrors, (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] GET /api/v1/users/${id}`);
    
    // Users can only view themselves unless admin/manager
    if (req.user.userId !== id && !['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only view your own profile' });
    }
    
    if (id === 999) return res.status(500).json({ error: 'Internal Server Error', message: 'Simulated server error' });
    
    const user = users.get(id);
    if (!user) return res.status(404).json({ error: 'User not found', message: `User with ID ${id} does not exist` });
    
    res.json(sanitizeUser(user));
});

app.post('/api/v1/users', authenticateToken, requireRole('admin'), validateUser, handleValidationErrors, async (req, res) => {
    console.log('🔍 [NODE-API] POST /api/v1/users');
    const { name, email, password, age, department, role = 'user' } = req.body;
    
    if (!isEmailUnique(email)) return res.status(400).json({ error: 'Validation failed', message: 'Email already exists' });
    
    const id = nextUserId++;
    const hashedPassword = password ? await bcrypt.hash(password, 10) : await bcrypt.hash('password123', 10);
    const newUser = { id, name, email, password: hashedPassword, age: age || null, department: department || null, role, createdAt: new Date().toISOString(), isActive: true };
    users.set(id, newUser);
    
    res.status(201).json(sanitizeUser(newUser));
});

app.put('/api/v1/users/:id', authenticateToken, requireRole('admin'), validateId, validateUser, handleValidationErrors, (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] PUT /api/v1/users/${id}`);
    
    const existingUser = users.get(id);
    if (!existingUser) return res.status(404).json({ error: 'User not found', message: `User with ID ${id} does not exist` });
    
    const { name, email, age, department, role } = req.body;
    if (!isEmailUnique(email, id)) return res.status(400).json({ error: 'Validation failed', message: 'Email already exists' });
    
    const updatedUser = { ...existingUser, name, email, age: age || existingUser.age, department: department || existingUser.department, role: role || existingUser.role };
    users.set(id, updatedUser);
    
    res.json(sanitizeUser(updatedUser));
});

app.patch('/api/v1/users/:id', authenticateToken, validateId, handleValidationErrors, (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] PATCH /api/v1/users/${id}`);
    
    // Users can only update themselves, admins can update anyone
    if (req.user.userId !== id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only update your own profile' });
    }
    
    const existingUser = users.get(id);
    if (!existingUser) return res.status(404).json({ error: 'User not found', message: `User with ID ${id} does not exist` });
    
    const updates = req.body;
    // Non-admins cannot change role or isActive
    if (req.user.role !== 'admin') {
        delete updates.role;
        delete updates.isActive;
    }
    delete updates.password; // Password changes through /auth/change-password
    
    if (updates.email && !isEmailUnique(updates.email, id)) return res.status(400).json({ error: 'Validation failed', message: 'Email already exists' });
    
    const updatedUser = { ...existingUser, ...updates };
    users.set(id, updatedUser);
    
    res.json(sanitizeUser(updatedUser));
});

app.delete('/api/v1/users/:id', authenticateToken, requireRole('admin'), validateId, handleValidationErrors, (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] DELETE /api/v1/users/${id}`);
    
    if (req.user.userId === id) return res.status(400).json({ error: 'Cannot delete yourself' });
    if (!users.has(id)) return res.status(404).json({ error: 'User not found', message: `User with ID ${id} does not exist` });
    
    users.delete(id);
    res.status(204).send();
});

app.get('/api/v1/users/department/:department', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    const department = req.params.department;
    console.log(`🔍 [NODE-API] GET /api/v1/users/department/${department}`);
    const departmentUsers = Array.from(users.values()).filter(u => u.department?.toLowerCase() === department.toLowerCase()).map(sanitizeUser);
    res.json(departmentUsers);
});

app.get('/api/v1/users/:id/orders', authenticateToken, validateId, handleValidationErrors, (req, res) => {
    const userId = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] GET /api/v1/users/${userId}/orders`);
    
    // Users can only see their own orders unless admin
    if (req.user.userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only view your own orders' });
    }
    
    if (!users.has(userId)) return res.status(404).json({ error: 'User not found' });
    
    const userOrders = Array.from(orders.values()).filter(o => o.userId === userId);
    res.json(userOrders);
});

app.get('/api/v1/users/:id/reviews', authenticateToken, validateId, handleValidationErrors, (req, res) => {
    const userId = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] GET /api/v1/users/${userId}/reviews`);
    
    if (!users.has(userId)) return res.status(404).json({ error: 'User not found' });
    
    const userReviews = Array.from(reviews.values()).filter(r => r.userId === userId);
    res.json(userReviews);
});

// ============================================
// PRODUCT ROUTES (Public read, Admin/Manager write)
// ============================================

app.get('/api/v1/products', optionalAuth, (req, res) => {
    console.log('🔍 [NODE-API] GET /api/v1/products');
    const { categoryId, brand, minPrice, maxPrice, inStock, search, sortBy = 'createdAt', order = 'desc', page = 1, limit = 10 } = req.query;
    let productList = Array.from(products.values()).filter(p => p.isActive);
    
    if (categoryId) productList = productList.filter(p => p.categoryId === parseInt(categoryId));
    if (brand) productList = productList.filter(p => p.brand?.toLowerCase() === brand.toLowerCase());
    if (minPrice) productList = productList.filter(p => p.price >= parseFloat(minPrice));
    if (maxPrice) productList = productList.filter(p => p.price <= parseFloat(maxPrice));
    if (inStock === 'true') productList = productList.filter(p => p.stock > 0);
    if (search) productList = productList.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase()));
    
    productList.sort((a, b) => {
        const aVal = a[sortBy], bVal = b[sortBy];
        return order === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });
    
    const total = productList.length;
    const startIndex = (page - 1) * limit;
    const paginatedProducts = productList.slice(startIndex, startIndex + parseInt(limit));
    
    res.json({ data: paginatedProducts, pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) } });
});

app.get('/api/v1/products/featured', (req, res) => {
    console.log('🔍 [NODE-API] GET /api/v1/products/featured');
    const featured = Array.from(products.values()).filter(p => p.isActive && p.rating >= 4.5).slice(0, 5);
    res.json(featured);
});

app.get('/api/v1/products/search', (req, res) => {
    console.log('🔍 [NODE-API] GET /api/v1/products/search');
    const { q, category, minRating } = req.query;
    
    if (!q) return res.status(400).json({ error: 'Search query required' });
    
    let results = Array.from(products.values()).filter(p => 
        p.isActive && (p.name.toLowerCase().includes(q.toLowerCase()) || 
        p.description.toLowerCase().includes(q.toLowerCase()) ||
        p.tags?.some(t => t.toLowerCase().includes(q.toLowerCase())))
    );
    
    if (category) results = results.filter(p => p.categoryId === parseInt(category));
    if (minRating) results = results.filter(p => p.rating >= parseFloat(minRating));
    
    res.json({ query: q, count: results.length, results });
});

app.get('/api/v1/products/:id', validateId, handleValidationErrors, (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] GET /api/v1/products/${id}`);
    
    const product = products.get(id);
    if (!product) return res.status(404).json({ error: 'Product not found', message: `Product with ID ${id} does not exist` });
    
    res.json(product);
});

app.post('/api/v1/products', authenticateToken, requireRole('admin', 'manager'), validateProduct, handleValidationErrors, (req, res) => {
    console.log('🔍 [NODE-API] POST /api/v1/products');
    const { name, description, price, categoryId, stock = 0, sku, brand, tags } = req.body;
    
    if (!categories.has(categoryId)) return res.status(400).json({ error: 'Invalid category ID' });
    
    const id = nextProductId++;
    const newProduct = { id, name, description, price, categoryId, stock, sku: sku || `PROD${id}`, brand, rating: 0, reviewCount: 0, isActive: true, createdAt: new Date().toISOString(), tags: tags || [] };
    products.set(id, newProduct);
    
    res.status(201).json(newProduct);
});

app.put('/api/v1/products/:id', authenticateToken, requireRole('admin', 'manager'), validateId, validateProduct, handleValidationErrors, (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] PUT /api/v1/products/${id}`);
    
    const existingProduct = products.get(id);
    if (!existingProduct) return res.status(404).json({ error: 'Product not found' });
    
    const { name, description, price, categoryId, stock, sku, brand, tags } = req.body;
    if (!categories.has(categoryId)) return res.status(400).json({ error: 'Invalid category ID' });
    
    const updatedProduct = { ...existingProduct, name, description, price, categoryId, stock: stock ?? existingProduct.stock, sku: sku || existingProduct.sku, brand, tags: tags || existingProduct.tags };
    products.set(id, updatedProduct);
    
    res.json(updatedProduct);
});

app.patch('/api/v1/products/:id', authenticateToken, requireRole('admin', 'manager'), validateId, handleValidationErrors, (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] PATCH /api/v1/products/${id}`);
    
    const existingProduct = products.get(id);
    if (!existingProduct) return res.status(404).json({ error: 'Product not found' });
    
    const updates = req.body;
    if (updates.categoryId && !categories.has(updates.categoryId)) return res.status(400).json({ error: 'Invalid category ID' });
    
    const updatedProduct = { ...existingProduct, ...updates };
    products.set(id, updatedProduct);
    
    res.json(updatedProduct);
});

app.delete('/api/v1/products/:id', authenticateToken, requireRole('admin'), validateId, handleValidationErrors, (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] DELETE /api/v1/products/${id}`);
    
    if (!products.has(id)) return res.status(404).json({ error: 'Product not found' });
    
    products.delete(id);
    res.status(204).send();
});

app.get('/api/v1/products/:id/reviews', validateId, handleValidationErrors, (req, res) => {
    const productId = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] GET /api/v1/products/${productId}/reviews`);
    
    if (!products.has(productId)) return res.status(404).json({ error: 'Product not found' });
    
    const productReviews = Array.from(reviews.values()).filter(r => r.productId === productId);
    res.json(productReviews);
});

app.patch('/api/v1/products/:id/stock', authenticateToken, requireRole('admin', 'manager'), validateId, handleValidationErrors, (req, res) => {
    const id = parseInt(req.params.id);
    const { adjustment } = req.body;
    console.log(`🔍 [NODE-API] PATCH /api/v1/products/${id}/stock`);
    
    const product = products.get(id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    
    const newStock = product.stock + adjustment;
    if (newStock < 0) return res.status(400).json({ error: 'Insufficient stock' });
    
    product.stock = newStock;
    products.set(id, product);
    
    res.json({ productId: id, previousStock: product.stock - adjustment, newStock: product.stock });
});

// ============================================
// CATEGORY ROUTES (Public read, Admin write)
// ============================================

app.get('/api/v1/categories', (req, res) => {
    console.log('🔍 [NODE-API] GET /api/v1/categories');
    const { parentId, includeInactive } = req.query;
    let categoryList = Array.from(categories.values());
    
    if (!includeInactive) categoryList = categoryList.filter(c => c.isActive);
    if (parentId === 'null') categoryList = categoryList.filter(c => c.parentId === null);
    else if (parentId) categoryList = categoryList.filter(c => c.parentId === parseInt(parentId));
    
    res.json(categoryList);
});

app.get('/api/v1/categories/tree', (req, res) => {
    console.log('🔍 [NODE-API] GET /api/v1/categories/tree');
    const buildTree = (parentId = null) => {
        return Array.from(categories.values())
            .filter(c => c.parentId === parentId && c.isActive)
            .map(c => ({ ...c, children: buildTree(c.id) }));
    };
    res.json(buildTree());
});

app.get('/api/v1/categories/:id', validateId, handleValidationErrors, (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] GET /api/v1/categories/${id}`);
    
    const category = categories.get(id);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    
    res.json(category);
});

app.post('/api/v1/categories', authenticateToken, requireRole('admin'), validateCategory, handleValidationErrors, (req, res) => {
    console.log('🔍 [NODE-API] POST /api/v1/categories');
    const { name, description, parentId } = req.body;
    
    if (parentId && !categories.has(parentId)) return res.status(400).json({ error: 'Invalid parent category' });
    
    const id = nextCategoryId++;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const newCategory = { id, name, description, slug, parentId: parentId || null, isActive: true };
    categories.set(id, newCategory);
    
    res.status(201).json(newCategory);
});

app.put('/api/v1/categories/:id', authenticateToken, requireRole('admin'), validateId, validateCategory, handleValidationErrors, (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] PUT /api/v1/categories/${id}`);
    
    const existingCategory = categories.get(id);
    if (!existingCategory) return res.status(404).json({ error: 'Category not found' });
    
    const { name, description, parentId } = req.body;
    if (parentId && !categories.has(parentId)) return res.status(400).json({ error: 'Invalid parent category' });
    if (parentId === id) return res.status(400).json({ error: 'Category cannot be its own parent' });
    
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const updatedCategory = { ...existingCategory, name, description, slug, parentId: parentId || null };
    categories.set(id, updatedCategory);
    
    res.json(updatedCategory);
});

app.delete('/api/v1/categories/:id', authenticateToken, requireRole('admin'), validateId, handleValidationErrors, (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] DELETE /api/v1/categories/${id}`);
    
    if (!categories.has(id)) return res.status(404).json({ error: 'Category not found' });
    
    // Check if category has products
    const hasProducts = Array.from(products.values()).some(p => p.categoryId === id);
    if (hasProducts) return res.status(400).json({ error: 'Cannot delete category with products' });
    
    // Check if category has children
    const hasChildren = Array.from(categories.values()).some(c => c.parentId === id);
    if (hasChildren) return res.status(400).json({ error: 'Cannot delete category with subcategories' });
    
    categories.delete(id);
    res.status(204).send();
});

app.get('/api/v1/categories/:id/products', validateId, handleValidationErrors, (req, res) => {
    const categoryId = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] GET /api/v1/categories/${categoryId}/products`);
    
    if (!categories.has(categoryId)) return res.status(404).json({ error: 'Category not found' });
    
    const categoryProducts = Array.from(products.values()).filter(p => p.categoryId === categoryId && p.isActive);
    res.json(categoryProducts);
});

// ============================================
// ORDER ROUTES (Authenticated)
// ============================================

app.get('/api/v1/orders', authenticateToken, (req, res) => {
    console.log('🔍 [NODE-API] GET /api/v1/orders');
    const { userId, status, startDate, endDate, page = 1, limit = 10 } = req.query;
    let orderList = Array.from(orders.values());
    
    // Non-admins can only see their own orders
    if (req.user.role !== 'admin') {
        orderList = orderList.filter(o => o.userId === req.user.userId);
    } else if (userId) {
        orderList = orderList.filter(o => o.userId === parseInt(userId));
    }
    
    if (status) orderList = orderList.filter(o => o.status === status);
    if (startDate) orderList = orderList.filter(o => new Date(o.createdAt) >= new Date(startDate));
    if (endDate) orderList = orderList.filter(o => new Date(o.createdAt) <= new Date(endDate));
    
    orderList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    const total = orderList.length;
    const startIndex = (page - 1) * limit;
    const paginatedOrders = orderList.slice(startIndex, startIndex + parseInt(limit));
    
    res.json({ data: paginatedOrders, pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) } });
});

app.get('/api/v1/orders/:id', authenticateToken, validateId, handleValidationErrors, (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] GET /api/v1/orders/${id}`);
    
    const order = orders.get(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    // Users can only view their own orders
    if (req.user.role !== 'admin' && order.userId !== req.user.userId) {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only view your own orders' });
    }
    
    // Enrich with product details
    const enrichedItems = order.items.map(item => {
        const product = products.get(item.productId);
        return { ...item, productName: product?.name, productSku: product?.sku };
    });
    
    res.json({ ...order, items: enrichedItems });
});

app.post('/api/v1/orders', authenticateToken, validateOrder, handleValidationErrors, (req, res) => {
    console.log('🔍 [NODE-API] POST /api/v1/orders');
    const { userId, items, shippingAddress, paymentMethod, couponCode } = req.body;
    
    // Users can only create orders for themselves (unless admin)
    const orderUserId = req.user.role === 'admin' ? userId : req.user.userId;
    
    if (!users.has(orderUserId)) return res.status(400).json({ error: 'Invalid user ID' });
    
    // Validate items and calculate totals
    let subtotal = 0;
    const orderItems = [];
    for (const item of items) {
        const product = products.get(item.productId);
        if (!product || !product.isActive) return res.status(400).json({ error: `Product ${item.productId} not found or inactive` });
        if (product.stock < item.quantity) return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
        
        const itemTotal = product.price * item.quantity;
        subtotal += itemTotal;
        orderItems.push({ productId: item.productId, quantity: item.quantity, price: product.price });
    }
    
    // Apply coupon if provided
    let discount = 0;
    if (couponCode) {
        const couponResult = applyCoupon(couponCode, subtotal);
        if (!couponResult.valid) return res.status(400).json({ error: couponResult.message });
        discount = couponResult.discount;
        couponResult.coupon.usedCount++;
    }
    
    const tax = (subtotal - discount) * 0.08; // 8% tax
    const total = subtotal - discount + tax;
    
    // Reduce stock
    for (const item of items) {
        const product = products.get(item.productId);
        product.stock -= item.quantity;
    }
    
    const id = nextOrderId++;
    const newOrder = {
        id, userId: orderUserId, items: orderItems, subtotal: Math.round(subtotal * 100) / 100, discount: Math.round(discount * 100) / 100,
        tax: Math.round(tax * 100) / 100, total: Math.round(total * 100) / 100, status: 'pending', paymentMethod,
        paymentStatus: 'pending', couponCode, shippingAddress, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    orders.set(id, newOrder);
    
    res.status(201).json(newOrder);
});

app.patch('/api/v1/orders/:id/status', authenticateToken, requireRole('admin', 'manager'), validateId, handleValidationErrors, (req, res) => {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    console.log(`🔍 [NODE-API] PATCH /api/v1/orders/${id}/status`);
    
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    
    const order = orders.get(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    // Restore stock if cancelling
    if (status === 'cancelled' && order.status !== 'cancelled') {
        for (const item of order.items) {
            const product = products.get(item.productId);
            if (product) product.stock += item.quantity;
        }
    }
    
    order.status = status;
    order.updatedAt = new Date().toISOString();
    orders.set(id, order);
    
    res.json(order);
});

app.patch('/api/v1/orders/:id/payment', authenticateToken, requireRole('admin', 'manager'), validateId, handleValidationErrors, (req, res) => {
    const id = parseInt(req.params.id);
    const { paymentStatus } = req.body;
    console.log(`🔍 [NODE-API] PATCH /api/v1/orders/${id}/payment`);
    
    const validStatuses = ['pending', 'paid', 'failed', 'refunded'];
    if (!validStatuses.includes(paymentStatus)) return res.status(400).json({ error: 'Invalid payment status' });
    
    const order = orders.get(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    order.paymentStatus = paymentStatus;
    order.updatedAt = new Date().toISOString();
    orders.set(id, order);
    
    res.json(order);
});

app.delete('/api/v1/orders/:id', authenticateToken, validateId, handleValidationErrors, (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] DELETE /api/v1/orders/${id}`);
    
    const order = orders.get(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    // Users can only delete their own pending orders, admins can delete any pending/cancelled
    if (req.user.role !== 'admin' && order.userId !== req.user.userId) {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only delete your own orders' });
    }
    if (!['pending', 'cancelled'].includes(order.status)) return res.status(400).json({ error: 'Can only delete pending or cancelled orders' });
    
    orders.delete(id);
    res.status(204).send();
});

// ============================================
// REVIEW ROUTES (Public read, authenticated write)
// ============================================

app.get('/api/v1/reviews', (req, res) => {
    console.log('🔍 [NODE-API] GET /api/v1/reviews');
    const { productId, userId, minRating, verified, page = 1, limit = 10 } = req.query;
    let reviewList = Array.from(reviews.values());
    
    if (productId) reviewList = reviewList.filter(r => r.productId === parseInt(productId));
    if (userId) reviewList = reviewList.filter(r => r.userId === parseInt(userId));
    if (minRating) reviewList = reviewList.filter(r => r.rating >= parseInt(minRating));
    if (verified === 'true') reviewList = reviewList.filter(r => r.isVerified);
    
    reviewList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    const total = reviewList.length;
    const startIndex = (page - 1) * limit;
    const paginatedReviews = reviewList.slice(startIndex, startIndex + parseInt(limit));
    
    res.json({ data: paginatedReviews, pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) } });
});

app.get('/api/v1/reviews/:id', validateId, handleValidationErrors, (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] GET /api/v1/reviews/${id}`);
    
    const review = reviews.get(id);
    if (!review) return res.status(404).json({ error: 'Review not found' });
    
    res.json(review);
});

app.post('/api/v1/reviews', authenticateToken, validateReview, handleValidationErrors, (req, res) => {
    console.log('🔍 [NODE-API] POST /api/v1/reviews');
    const { productId, rating, title, comment } = req.body;
    const userId = req.user.userId; // Use authenticated user
    
    if (!products.has(productId)) return res.status(400).json({ error: 'Product not found' });
    
    // Check if user already reviewed this product
    const existingReview = Array.from(reviews.values()).find(r => r.productId === productId && r.userId === userId);
    if (existingReview) return res.status(400).json({ error: 'You have already reviewed this product' });
    
    // Check if user has purchased the product
    const userOrders = Array.from(orders.values()).filter(o => o.userId === userId && o.status === 'delivered');
    const hasPurchased = userOrders.some(o => o.items.some(i => i.productId === productId));
    
    const id = nextReviewId++;
    const newReview = { id, productId, userId, rating, title, comment, isVerified: hasPurchased, helpfulCount: 0, createdAt: new Date().toISOString() };
    reviews.set(id, newReview);
    
    // Update product rating
    const productReviews = Array.from(reviews.values()).filter(r => r.productId === productId);
    const avgRating = productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length;
    const product = products.get(productId);
    product.rating = Math.round(avgRating * 10) / 10;
    product.reviewCount = productReviews.length;
    
    res.status(201).json(newReview);
});

app.put('/api/v1/reviews/:id', authenticateToken, validateId, handleValidationErrors, (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] PUT /api/v1/reviews/${id}`);
    
    const existingReview = reviews.get(id);
    if (!existingReview) return res.status(404).json({ error: 'Review not found' });
    
    // Users can only edit their own reviews (admins can edit any)
    if (req.user.role !== 'admin' && existingReview.userId !== req.user.userId) {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only edit your own reviews' });
    }
    
    const { rating, title, comment } = req.body;
    if (rating && (rating < 1 || rating > 5)) return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    
    const updatedReview = { ...existingReview, rating: rating || existingReview.rating, title: title || existingReview.title, comment: comment !== undefined ? comment : existingReview.comment };
    reviews.set(id, updatedReview);
    
    // Update product rating
    const productReviews = Array.from(reviews.values()).filter(r => r.productId === existingReview.productId);
    const avgRating = productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length;
    const product = products.get(existingReview.productId);
    product.rating = Math.round(avgRating * 10) / 10;
    
    res.json(updatedReview);
});

app.delete('/api/v1/reviews/:id', authenticateToken, validateId, handleValidationErrors, (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] DELETE /api/v1/reviews/${id}`);
    
    const review = reviews.get(id);
    if (!review) return res.status(404).json({ error: 'Review not found' });
    
    // Users can only delete their own reviews (admins can delete any)
    if (req.user.role !== 'admin' && review.userId !== req.user.userId) {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only delete your own reviews' });
    }
    
    reviews.delete(id);
    
    // Update product rating
    const productReviews = Array.from(reviews.values()).filter(r => r.productId === review.productId);
    const product = products.get(review.productId);
    if (productReviews.length > 0) {
        product.rating = Math.round(productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length * 10) / 10;
        product.reviewCount = productReviews.length;
    } else {
        product.rating = 0;
        product.reviewCount = 0;
    }
    
    res.status(204).send();
});

app.post('/api/v1/reviews/:id/helpful', authenticateToken, validateId, handleValidationErrors, (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] POST /api/v1/reviews/${id}/helpful`);
    
    const review = reviews.get(id);
    if (!review) return res.status(404).json({ error: 'Review not found' });
    
    // Can't mark own review as helpful
    if (review.userId === req.user.userId) {
        return res.status(400).json({ error: 'Cannot mark your own review as helpful' });
    }
    
    review.helpfulCount++;
    reviews.set(id, review);
    
    res.json({ message: 'Marked as helpful', helpfulCount: review.helpfulCount });
});

// ============================================
// CART ROUTES (Authenticated, own cart only)
// ============================================

app.get('/api/v1/cart/:userId', authenticateToken, (req, res) => {
    const userId = parseInt(req.params.userId);
    console.log(`🔍 [NODE-API] GET /api/v1/cart/${userId}`);
    
    // Users can only access their own cart
    if (req.user.userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only access your own cart' });
    }
    
    if (!users.has(userId)) return res.status(404).json({ error: 'User not found' });
    
    const cart = carts.get(userId) || { userId, items: [], updatedAt: new Date().toISOString() };
    const { subtotal, itemDetails } = calculateCartTotal(cart.items);
    
    res.json({ ...cart, items: itemDetails, subtotal: Math.round(subtotal * 100) / 100, itemCount: cart.items.reduce((sum, i) => sum + i.quantity, 0) });
});

app.post('/api/v1/cart/:userId/items', authenticateToken, (req, res) => {
    const userId = parseInt(req.params.userId);
    const { productId, quantity = 1 } = req.body;
    console.log(`🔍 [NODE-API] POST /api/v1/cart/${userId}/items`);
    
    if (req.user.userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only modify your own cart' });
    }
    
    if (!users.has(userId)) return res.status(404).json({ error: 'User not found' });
    
    const product = products.get(productId);
    if (!product || !product.isActive) return res.status(400).json({ error: 'Product not found or inactive' });
    if (product.stock < quantity) return res.status(400).json({ error: 'Insufficient stock' });
    
    let cart = carts.get(userId) || { userId, items: [], updatedAt: new Date().toISOString() };
    
    const existingItem = cart.items.find(i => i.productId === productId);
    if (existingItem) {
        if (product.stock < existingItem.quantity + quantity) return res.status(400).json({ error: 'Insufficient stock' });
        existingItem.quantity += quantity;
    } else {
        cart.items.push({ productId, quantity });
    }
    
    cart.updatedAt = new Date().toISOString();
    carts.set(userId, cart);
    
    const { subtotal, itemDetails } = calculateCartTotal(cart.items);
    res.json({ ...cart, items: itemDetails, subtotal: Math.round(subtotal * 100) / 100 });
});

app.put('/api/v1/cart/:userId/items/:productId', authenticateToken, (req, res) => {
    const userId = parseInt(req.params.userId);
    const productId = parseInt(req.params.productId);
    const { quantity } = req.body;
    console.log(`🔍 [NODE-API] PUT /api/v1/cart/${userId}/items/${productId}`);
    
    if (req.user.userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only modify your own cart' });
    }
    
    if (!users.has(userId)) return res.status(404).json({ error: 'User not found' });
    
    const cart = carts.get(userId);
    if (!cart) return res.status(404).json({ error: 'Cart not found' });
    
    const item = cart.items.find(i => i.productId === productId);
    if (!item) return res.status(404).json({ error: 'Item not in cart' });
    
    const product = products.get(productId);
    if (product.stock < quantity) return res.status(400).json({ error: 'Insufficient stock' });
    
    if (quantity <= 0) {
        cart.items = cart.items.filter(i => i.productId !== productId);
    } else {
        item.quantity = quantity;
    }
    
    cart.updatedAt = new Date().toISOString();
    carts.set(userId, cart);
    
    const { subtotal, itemDetails } = calculateCartTotal(cart.items);
    res.json({ ...cart, items: itemDetails, subtotal: Math.round(subtotal * 100) / 100 });
});

app.delete('/api/v1/cart/:userId/items/:productId', authenticateToken, (req, res) => {
    const userId = parseInt(req.params.userId);
    const productId = parseInt(req.params.productId);
    console.log(`🔍 [NODE-API] DELETE /api/v1/cart/${userId}/items/${productId}`);
    
    if (req.user.userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only modify your own cart' });
    }
    
    const cart = carts.get(userId);
    if (!cart) return res.status(404).json({ error: 'Cart not found' });
    
    cart.items = cart.items.filter(i => i.productId !== productId);
    cart.updatedAt = new Date().toISOString();
    carts.set(userId, cart);
    
    res.status(204).send();
});

app.delete('/api/v1/cart/:userId', authenticateToken, (req, res) => {
    const userId = parseInt(req.params.userId);
    console.log(`🔍 [NODE-API] DELETE /api/v1/cart/${userId}`);
    
    if (req.user.userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only clear your own cart' });
    }
    
    carts.delete(userId);
    res.status(204).send();
});

// ============================================
// COUPON ROUTES (Admin for management, authenticated for validate)
// ============================================

app.get('/api/v1/coupons', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    console.log('🔍 [NODE-API] GET /api/v1/coupons');
    const couponList = Array.from(coupons.values());
    res.json(couponList);
});

app.get('/api/v1/coupons/:code', (req, res) => {
    const code = req.params.code.toUpperCase();
    console.log(`🔍 [NODE-API] GET /api/v1/coupons/${code}`);
    
    const coupon = coupons.get(code);
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
    
    // Public endpoint but hide sensitive data
    res.json({ code: coupon.code, discount: coupon.discount, type: coupon.type, minPurchase: coupon.minPurchase, isActive: coupon.isActive });
});

app.post('/api/v1/coupons/validate', authenticateToken, (req, res) => {
    const { code, subtotal } = req.body;
    console.log(`🔍 [NODE-API] POST /api/v1/coupons/validate`);
    
    if (!code || subtotal === undefined) return res.status(400).json({ error: 'Code and subtotal required' });
    
    const result = applyCoupon(code.toUpperCase(), subtotal);
    if (!result.valid) return res.status(400).json({ error: result.message });
    
    res.json({ valid: true, discount: Math.round(result.discount * 100) / 100, finalTotal: Math.round((subtotal - result.discount) * 100) / 100 });
});

app.post('/api/v1/coupons', authenticateToken, requireRole('admin'), (req, res) => {
    console.log('🔍 [NODE-API] POST /api/v1/coupons');
    const { code, discount, type, minPurchase = 0, maxUses = 100, expiresAt } = req.body;
    
    if (!code || !discount || !type) return res.status(400).json({ error: 'Code, discount, and type are required' });
    if (!['percentage', 'fixed'].includes(type)) return res.status(400).json({ error: 'Type must be percentage or fixed' });
    if (coupons.has(code.toUpperCase())) return res.status(400).json({ error: 'Coupon code already exists' });
    
    const newCoupon = { code: code.toUpperCase(), discount, type, minPurchase, maxUses, usedCount: 0, expiresAt: expiresAt || '2025-12-31T23:59:59Z', isActive: true };
    coupons.set(code.toUpperCase(), newCoupon);
    
    res.status(201).json(newCoupon);
});

app.delete('/api/v1/coupons/:code', authenticateToken, requireRole('admin'), (req, res) => {
    const code = req.params.code.toUpperCase();
    console.log(`🔍 [NODE-API] DELETE /api/v1/coupons/${code}`);
    
    if (!coupons.has(code)) return res.status(404).json({ error: 'Coupon not found' });
    
    coupons.delete(code);
    res.status(204).send();
});

// ============================================
// ADDRESS ROUTES (Authenticated, own addresses only)
// ============================================

app.get('/api/v1/users/:userId/addresses', authenticateToken, (req, res) => {
    const userId = parseInt(req.params.userId);
    console.log(`🔍 [NODE-API] GET /api/v1/users/${userId}/addresses`);
    
    if (req.user.userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only view your own addresses' });
    }
    
    if (!users.has(userId)) return res.status(404).json({ error: 'User not found' });
    
    const userAddresses = Array.from(addresses.values()).filter(a => a.userId === userId);
    res.json(userAddresses);
});

app.get('/api/v1/addresses/:id', authenticateToken, validateId, handleValidationErrors, (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] GET /api/v1/addresses/${id}`);
    
    const address = addresses.get(id);
    if (!address) return res.status(404).json({ error: 'Address not found' });
    
    if (req.user.userId !== address.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only view your own addresses' });
    }
    
    res.json(address);
});

app.post('/api/v1/users/:userId/addresses', authenticateToken, (req, res) => {
    const userId = parseInt(req.params.userId);
    console.log(`🔍 [NODE-API] POST /api/v1/users/${userId}/addresses`);
    
    if (req.user.userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only add addresses to your own account' });
    }
    
    if (!users.has(userId)) return res.status(404).json({ error: 'User not found' });
    
    const { label, street, city, state, zipCode, country, isDefault = false } = req.body;
    if (!street || !city || !state || !zipCode || !country) return res.status(400).json({ error: 'Missing required address fields' });
    
    // If setting as default, unset other defaults
    if (isDefault) {
        for (const [id, addr] of addresses) {
            if (addr.userId === userId) addr.isDefault = false;
        }
    }
    
    const id = nextAddressId++;
    const newAddress = { id, userId, label: label || 'Address', street, city, state, zipCode, country, isDefault };
    addresses.set(id, newAddress);
    
    res.status(201).json(newAddress);
});

app.put('/api/v1/addresses/:id', authenticateToken, validateId, handleValidationErrors, (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] PUT /api/v1/addresses/${id}`);
    
    const existingAddress = addresses.get(id);
    if (!existingAddress) return res.status(404).json({ error: 'Address not found' });
    
    if (req.user.userId !== existingAddress.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only update your own addresses' });
    }
    
    const { label, street, city, state, zipCode, country, isDefault } = req.body;
    
    // If setting as default, unset other defaults
    if (isDefault) {
        for (const [aid, addr] of addresses) {
            if (addr.userId === existingAddress.userId && aid !== id) addr.isDefault = false;
        }
    }
    
    const updatedAddress = { ...existingAddress, label: label || existingAddress.label, street: street || existingAddress.street, city: city || existingAddress.city, state: state || existingAddress.state, zipCode: zipCode || existingAddress.zipCode, country: country || existingAddress.country, isDefault: isDefault !== undefined ? isDefault : existingAddress.isDefault };
    addresses.set(id, updatedAddress);
    
    res.json(updatedAddress);
});

app.delete('/api/v1/addresses/:id', authenticateToken, validateId, handleValidationErrors, (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] DELETE /api/v1/addresses/${id}`);
    
    const address = addresses.get(id);
    if (!address) return res.status(404).json({ error: 'Address not found' });
    
    if (req.user.userId !== address.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only delete your own addresses' });
    }
    
    addresses.delete(id);
    res.status(204).send();
});

// ============================================
// WISHLIST ROUTES (Authenticated, own wishlist only)
// ============================================

app.get('/api/v1/users/:userId/wishlist', authenticateToken, (req, res) => {
    const userId = parseInt(req.params.userId);
    console.log(`🔍 [NODE-API] GET /api/v1/users/${userId}/wishlist`);
    
    if (req.user.userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only view your own wishlist' });
    }
    
    if (!users.has(userId)) return res.status(404).json({ error: 'User not found' });
    
    const wishlist = wishlists.get(userId) || [];
    const wishlistProducts = wishlist.map(productId => products.get(productId)).filter(Boolean);
    
    res.json(wishlistProducts);
});

app.post('/api/v1/users/:userId/wishlist', authenticateToken, (req, res) => {
    const userId = parseInt(req.params.userId);
    const { productId } = req.body;
    console.log(`🔍 [NODE-API] POST /api/v1/users/${userId}/wishlist`);
    
    if (req.user.userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only modify your own wishlist' });
    }
    
    if (!users.has(userId)) return res.status(404).json({ error: 'User not found' });
    if (!products.has(productId)) return res.status(400).json({ error: 'Product not found' });
    
    let wishlist = wishlists.get(userId) || [];
    if (wishlist.includes(productId)) return res.status(400).json({ error: 'Product already in wishlist' });
    
    wishlist.push(productId);
    wishlists.set(userId, wishlist);
    
    res.status(201).json({ message: 'Added to wishlist', productId });
});

app.delete('/api/v1/users/:userId/wishlist/:productId', authenticateToken, (req, res) => {
    const userId = parseInt(req.params.userId);
    const productId = parseInt(req.params.productId);
    console.log(`🔍 [NODE-API] DELETE /api/v1/users/${userId}/wishlist/${productId}`);
    
    if (req.user.userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only modify your own wishlist' });
    }
    
    let wishlist = wishlists.get(userId) || [];
    if (!wishlist.includes(productId)) return res.status(404).json({ error: 'Product not in wishlist' });
    
    wishlist = wishlist.filter(id => id !== productId);
    wishlists.set(userId, wishlist);
    
    res.status(204).send();
});

// ============================================
// NOTIFICATION ROUTES (Authenticated, own notifications only)
// ============================================

app.get('/api/v1/users/:userId/notifications', authenticateToken, (req, res) => {
    const userId = parseInt(req.params.userId);
    const { unreadOnly } = req.query;
    console.log(`🔍 [NODE-API] GET /api/v1/users/${userId}/notifications`);
    
    if (req.user.userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only view your own notifications' });
    }
    
    if (!users.has(userId)) return res.status(404).json({ error: 'User not found' });
    
    let userNotifications = Array.from(notifications.values()).filter(n => n.userId === userId);
    if (unreadOnly === 'true') userNotifications = userNotifications.filter(n => !n.isRead);
    
    userNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({ notifications: userNotifications, unreadCount: userNotifications.filter(n => !n.isRead).length });
});

app.patch('/api/v1/notifications/:id/read', authenticateToken, validateId, handleValidationErrors, (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] PATCH /api/v1/notifications/${id}/read`);
    
    const notification = notifications.get(id);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    
    if (req.user.userId !== notification.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only mark your own notifications as read' });
    }
    
    notification.isRead = true;
    notifications.set(id, notification);
    
    res.json(notification);
});

app.post('/api/v1/users/:userId/notifications/mark-all-read', authenticateToken, (req, res) => {
    const userId = parseInt(req.params.userId);
    console.log(`🔍 [NODE-API] POST /api/v1/users/${userId}/notifications/mark-all-read`);
    
    if (req.user.userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only mark your own notifications as read' });
    }
    
    if (!users.has(userId)) return res.status(404).json({ error: 'User not found' });
    
    for (const [id, notification] of notifications) {
        if (notification.userId === userId) notification.isRead = true;
    }
    
    res.json({ message: 'All notifications marked as read' });
});

// ============================================
// FILE UPLOAD ROUTES (Multipart/Form-Data)
// ============================================

// Helper middleware to handle multer errors
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large', message: 'Maximum file size is 5MB' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ error: 'Too many files', message: 'Maximum number of files exceeded' });
        }
        return res.status(400).json({ error: 'Upload error', message: err.message });
    }
    if (err) {
        return res.status(400).json({ error: 'Upload error', message: err.message });
    }
    next();
};

// Upload single image
app.post('/api/v1/uploads/image', authenticateToken, (req, res) => {
    console.log('📷 [NODE-API] POST /api/v1/uploads/image');
    
    uploadSingle(req, res, (err) => {
        if (err) {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'File too large', message: 'Maximum file size is 5MB' });
                }
                return res.status(400).json({ error: 'Upload error', message: err.message });
            }
            return res.status(400).json({ error: 'Upload error', message: err.message });
        }
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded', message: 'Please provide an image file in the "image" field' });
        }
        
        const fileId = nextFileId++;
        const fileData = {
            id: fileId,
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            path: `/uploads/${req.file.filename}`,
            uploadedBy: req.user.userId,
            uploadedAt: new Date().toISOString()
        };
        
        uploadedFiles.set(fileId, fileData);
        console.log(`✅ [NODE-API] Image uploaded: ${req.file.filename}`);
        
        res.status(201).json({
            message: 'Image uploaded successfully',
            file: fileData
        });
    });
});

// Upload multiple images
app.post('/api/v1/uploads/images', authenticateToken, (req, res) => {
    console.log('📷 [NODE-API] POST /api/v1/uploads/images');
    
    uploadMultiple(req, res, (err) => {
        if (err) {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'File too large', message: 'Maximum file size is 5MB per file' });
                }
                if (err.code === 'LIMIT_FILE_COUNT') {
                    return res.status(400).json({ error: 'Too many files', message: 'Maximum 5 images allowed' });
                }
                return res.status(400).json({ error: 'Upload error', message: err.message });
            }
            return res.status(400).json({ error: 'Upload error', message: err.message });
        }
        
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded', message: 'Please provide image files in the "images" field' });
        }
        
        const uploadedFilesList = req.files.map(file => {
            const fileId = nextFileId++;
            const fileData = {
                id: fileId,
                filename: file.filename,
                originalName: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                path: `/uploads/${file.filename}`,
                uploadedBy: req.user.userId,
                uploadedAt: new Date().toISOString()
            };
            uploadedFiles.set(fileId, fileData);
            return fileData;
        });
        
        console.log(`✅ [NODE-API] ${uploadedFilesList.length} images uploaded`);
        
        res.status(201).json({
            message: `${uploadedFilesList.length} images uploaded successfully`,
            files: uploadedFilesList
        });
    });
});

// Upload user profile with avatar (multipart form with mixed fields)
app.post('/api/v1/uploads/profile', authenticateToken, (req, res) => {
    console.log('📷 [NODE-API] POST /api/v1/uploads/profile');
    
    uploadFields(req, res, (err) => {
        if (err) {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'File too large', message: 'Maximum file size is 5MB per file' });
                }
                return res.status(400).json({ error: 'Upload error', message: err.message });
            }
            return res.status(400).json({ error: 'Upload error', message: err.message });
        }
        
        const { name, bio, website } = req.body;
        const result = {
            userId: req.user.userId,
            name: name || null,
            bio: bio || null,
            website: website || null,
            files: {}
        };
        
        // Process avatar
        if (req.files && req.files.avatar && req.files.avatar[0]) {
            const avatarFile = req.files.avatar[0];
            const fileId = nextFileId++;
            const fileData = {
                id: fileId,
                filename: avatarFile.filename,
                originalName: avatarFile.originalname,
                mimetype: avatarFile.mimetype,
                size: avatarFile.size,
                path: `/uploads/${avatarFile.filename}`,
                uploadedBy: req.user.userId,
                uploadedAt: new Date().toISOString()
            };
            uploadedFiles.set(fileId, fileData);
            result.files.avatar = fileData;
        }
        
        // Process cover image
        if (req.files && req.files.coverImage && req.files.coverImage[0]) {
            const coverFile = req.files.coverImage[0];
            const fileId = nextFileId++;
            const fileData = {
                id: fileId,
                filename: coverFile.filename,
                originalName: coverFile.originalname,
                mimetype: coverFile.mimetype,
                size: coverFile.size,
                path: `/uploads/${coverFile.filename}`,
                uploadedBy: req.user.userId,
                uploadedAt: new Date().toISOString()
            };
            uploadedFiles.set(fileId, fileData);
            result.files.coverImage = fileData;
        }
        
        // Process gallery images
        if (req.files && req.files.gallery && req.files.gallery.length > 0) {
            result.files.gallery = req.files.gallery.map(file => {
                const fileId = nextFileId++;
                const fileData = {
                    id: fileId,
                    filename: file.filename,
                    originalName: file.originalname,
                    mimetype: file.mimetype,
                    size: file.size,
                    path: `/uploads/${file.filename}`,
                    uploadedBy: req.user.userId,
                    uploadedAt: new Date().toISOString()
                };
                uploadedFiles.set(fileId, fileData);
                return fileData;
            });
        }
        
        console.log(`✅ [NODE-API] Profile data uploaded for user ${req.user.userId}`);
        
        res.status(201).json({
            message: 'Profile data uploaded successfully',
            profile: result
        });
    });
});

// Upload product image (for product management)
app.post('/api/v1/products/:id/image', authenticateToken, requireRole('admin', 'manager'), validateId, handleValidationErrors, (req, res) => {
    const productId = parseInt(req.params.id);
    console.log(`📷 [NODE-API] POST /api/v1/products/${productId}/image`);
    
    const product = products.get(productId);
    if (!product) {
        return res.status(404).json({ error: 'Product not found' });
    }
    
    uploadSingle(req, res, (err) => {
        if (err) {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'File too large', message: 'Maximum file size is 5MB' });
                }
                return res.status(400).json({ error: 'Upload error', message: err.message });
            }
            return res.status(400).json({ error: 'Upload error', message: err.message });
        }
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded', message: 'Please provide an image file in the "image" field' });
        }
        
        const fileId = nextFileId++;
        const fileData = {
            id: fileId,
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            path: `/uploads/${req.file.filename}`,
            productId: productId,
            uploadedBy: req.user.userId,
            uploadedAt: new Date().toISOString()
        };
        
        uploadedFiles.set(fileId, fileData);
        
        // Update product with image reference
        if (!product.images) product.images = [];
        product.images.push(fileData.path);
        products.set(productId, product);
        
        console.log(`✅ [NODE-API] Product image uploaded for product ${productId}`);
        
        res.status(201).json({
            message: 'Product image uploaded successfully',
            file: fileData,
            product: product
        });
    });
});

// Get uploaded file info
app.get('/api/v1/uploads/:id', authenticateToken, (req, res) => {
    const fileId = parseInt(req.params.id);
    console.log(`📷 [NODE-API] GET /api/v1/uploads/${fileId}`);
    
    const fileData = uploadedFiles.get(fileId);
    if (!fileData) {
        return res.status(404).json({ error: 'File not found' });
    }
    
    // Users can only see their own files unless admin
    if (req.user.role !== 'admin' && fileData.uploadedBy !== req.user.userId) {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only view your own uploaded files' });
    }
    
    res.json(fileData);
});

// List user's uploaded files
app.get('/api/v1/uploads', authenticateToken, (req, res) => {
    console.log('📷 [NODE-API] GET /api/v1/uploads');
    const { page = 1, limit = 10 } = req.query;
    
    let fileList = Array.from(uploadedFiles.values());
    
    // Non-admins only see their own files
    if (req.user.role !== 'admin') {
        fileList = fileList.filter(f => f.uploadedBy === req.user.userId);
    }
    
    fileList.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    
    const total = fileList.length;
    const startIndex = (page - 1) * limit;
    const paginatedFiles = fileList.slice(startIndex, startIndex + parseInt(limit));
    
    res.json({
        data: paginatedFiles,
        pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) }
    });
});

// Delete uploaded file
app.delete('/api/v1/uploads/:id', authenticateToken, (req, res) => {
    const fileId = parseInt(req.params.id);
    console.log(`📷 [NODE-API] DELETE /api/v1/uploads/${fileId}`);
    
    const fileData = uploadedFiles.get(fileId);
    if (!fileData) {
        return res.status(404).json({ error: 'File not found' });
    }
    
    // Users can only delete their own files unless admin
    if (req.user.role !== 'admin' && fileData.uploadedBy !== req.user.userId) {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only delete your own uploaded files' });
    }
    
    // Delete file from filesystem
    const filePath = path.join(uploadsDir, fileData.filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    
    uploadedFiles.delete(fileId);
    console.log(`✅ [NODE-API] File deleted: ${fileData.filename}`);
    
    res.status(204).send();
});

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// ============================================
// ANALYTICS / STATS ROUTES (Admin/Manager only)
// ============================================

app.get('/api/v1/stats/overview', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    console.log('🔍 [NODE-API] GET /api/v1/stats/overview');
    
    const totalUsers = users.size;
    const activeUsers = Array.from(users.values()).filter(u => u.isActive).length;
    const totalProducts = products.size;
    const activeProducts = Array.from(products.values()).filter(p => p.isActive).length;
    const totalOrders = orders.size;
    const totalRevenue = Array.from(orders.values()).filter(o => o.paymentStatus === 'paid').reduce((sum, o) => sum + o.total, 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalReviews = reviews.size;
    const averageRating = Array.from(reviews.values()).reduce((sum, r) => sum + r.rating, 0) / (totalReviews || 1);
    
    res.json({
        users: { total: totalUsers, active: activeUsers },
        products: { total: totalProducts, active: activeProducts },
        orders: { total: totalOrders, revenue: Math.round(totalRevenue * 100) / 100, averageValue: Math.round(averageOrderValue * 100) / 100 },
        reviews: { total: totalReviews, averageRating: Math.round(averageRating * 10) / 10 }
    });
});

app.get('/api/v1/stats/top-products', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    console.log('🔍 [NODE-API] GET /api/v1/stats/top-products');
    const { limit = 5, sortBy = 'rating' } = req.query;
    
    let productList = Array.from(products.values()).filter(p => p.isActive);
    
    if (sortBy === 'rating') productList.sort((a, b) => b.rating - a.rating);
    else if (sortBy === 'reviews') productList.sort((a, b) => b.reviewCount - a.reviewCount);
    else if (sortBy === 'price') productList.sort((a, b) => b.price - a.price);
    
    res.json(productList.slice(0, parseInt(limit)));
});

app.get('/api/v1/stats/orders-by-status', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    console.log('🔍 [NODE-API] GET /api/v1/stats/orders-by-status');
    
    const statusCounts = {};
    for (const order of orders.values()) {
        statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    }
    
    res.json(statusCounts);
});

app.get('/api/v1/stats/low-stock', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    console.log('🔍 [NODE-API] GET /api/v1/stats/low-stock');
    const { threshold = 10 } = req.query;
    
    const lowStockProducts = Array.from(products.values()).filter(p => p.isActive && p.stock <= parseInt(threshold));
    
    res.json(lowStockProducts);
});

// ============================================
// ADMIN / UTILITY ROUTES (Admin only, except reset which is public for testing)
// ============================================

app.post('/api/v1/admin/reset-test-data', (req, res) => {
    console.log('🔄 [NODE-API] RESET TEST DATA');
    initializeDemoData();
    res.json({ message: 'Test data reset successfully', counts: { users: users.size, products: products.size, categories: categories.size, orders: orders.size, reviews: reviews.size } });
});

app.get('/api/v1/admin/data-counts', authenticateToken, requireRole('admin'), (req, res) => {
    console.log('🔍 [NODE-API] GET /api/v1/admin/data-counts');
    res.json({ users: users.size, products: products.size, categories: categories.size, orders: orders.size, reviews: reviews.size, coupons: coupons.size, addresses: addresses.size });
});

// Keep legacy endpoint for backwards compatibility (public for testing)
app.post('/api/v1/users/reset-test-data', (req, res) => {
    console.log('🔄 [NODE-API] RESET TEST DATA (legacy)');
    initializeDemoData();
    res.json({ message: 'Test data reset successfully', userCount: users.size, availableIds: Array.from(users.keys()) });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString(), uptime: process.uptime(), counts: { users: users.size, products: products.size, orders: orders.size } });
});

// Swagger documentation setup
try {
    const swaggerDocument = require('./openapi.json');
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    console.log('📄 [NODE-API] Swagger UI available at /api-docs');
} catch (error) {
    console.log('⚠️  [NODE-API] OpenAPI spec not found, Swagger UI not available');
}

// Global error handler
app.use((err, req, res, next) => {
    console.error(`❌ [NODE-API] Unexpected error: ${err.message}`);
    res.status(500).json({ error: 'Internal Server Error', message: 'An unexpected error occurred' });
});

// 404 handler
app.use((req, res) => {
    console.log(`❌ [NODE-API] 404 - Route not found: ${req.method} ${req.path}`);
    res.status(404).json({ error: 'Not Found', message: `Route ${req.method} ${req.path} not found` });
});

// Start server
const server = app.listen(PORT, () => {
    console.log('🚀 [NODE-API] =====================================');
    console.log(`🚀 [NODE-API] Spectra Demo API (Node.js Express)`);
    console.log(`🚀 [NODE-API] Server running on port ${PORT}`);
    console.log(`🚀 [NODE-API] Base URL: http://localhost:${PORT}`);
    console.log(`🚀 [NODE-API] Health Check: http://localhost:${PORT}/health`);
    console.log(`🚀 [NODE-API] API Docs: http://localhost:${PORT}/api-docs`);
    console.log('🚀 [NODE-API] =====================================');
    console.log(`📊 [NODE-API] Data initialized:`);
    console.log(`   - Users: ${users.size}`);
    console.log(`   - Products: ${products.size}`);
    console.log(`   - Categories: ${categories.size}`);
    console.log(`   - Orders: ${orders.size}`);
    console.log(`   - Reviews: ${reviews.size}`);
    console.log('🚀 [NODE-API] =====================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 [NODE-API] SIGTERM received, shutting down gracefully');
    server.close(() => console.log('🛑 [NODE-API] Process terminated'));
});

process.on('SIGINT', () => {
    console.log('🛑 [NODE-API] SIGINT received, shutting down gracefully');
    server.close(() => console.log('🛑 [NODE-API] Process terminated'));
});

module.exports = app;

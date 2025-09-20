const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { body, param, validationResult } = require('express-validator');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// In-memory user storage (similar to Java ConcurrentHashMap)
let users = new Map();
let nextId = 1;

// Initialize demo data
function initializeDemoData() {
    users.clear();
    users.set(1, { id: 1, name: 'John Doe', email: 'john.doe@example.com', age: 30, department: 'Engineering' });
    users.set(2, { id: 2, name: 'Jane Smith', email: 'jane.smith@example.com', age: 28, department: 'Marketing' });
    users.set(3, { id: 3, name: 'Bob Johnson', email: 'bob.johnson@example.com', age: 35, department: 'Engineering' });
    nextId = 4;
}

// Initialize data on startup
initializeDemoData();

// Validation middleware
const validateUser = [
    body('name')
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters')
        .notEmpty()
        .withMessage('Name is required'),
    body('email')
        .isEmail()
        .withMessage('Email must be valid')
        .notEmpty()
        .withMessage('Email is required'),
    body('age')
        .optional()
        .isInt({ min: 18, max: 100 })
        .withMessage('Age must be between 18 and 100'),
    body('department')
        .optional()
        .isString()
        .withMessage('Department must be a string')
];

const validateUserId = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('User ID must be a positive integer')
];

const validateDepartment = [
    param('department')
        .isString()
        .notEmpty()
        .withMessage('Department is required')
];

// Error handling middleware
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log(`❌ [NODE-API] Validation errors: ${JSON.stringify(errors.array())}`);
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
        });
    }
    next();
};

// Helper function to check email uniqueness
const isEmailUnique = (email, excludeId = null) => {
    for (const [id, user] of users) {
        if (user.email === email && id !== excludeId) {
            return false;
        }
    }
    return true;
};

// Routes

/**
 * GET /api/v1/users
 * Get all users
 */
app.get('/api/v1/users', (req, res) => {
    console.log('🔍 [NODE-API] GET /api/v1/users - Request received');
    console.log(`🔍 [NODE-API] Current users in database: ${users.size}`);
    
    const userList = Array.from(users.values());
    console.log(`🔍 [NODE-API] Returning ${userList.length} users`);
    console.log('✅ [NODE-API] GET /api/v1/users - Success (200)');
    
    res.json(userList);
});

/**
 * GET /api/v1/users/:id
 * Get user by ID
 */
app.get('/api/v1/users/:id', validateUserId, handleValidationErrors, (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] GET /api/v1/users/${id} - Request received`);
    console.log(`🔍 [NODE-API] Path variable 'id' = ${id} (type: ${typeof id})`);
    console.log(`🔍 [NODE-API] Available user IDs: [${Array.from(users.keys()).join(', ')}]`);
    
    // Simulate server error for ID 999 (for error testing)
    if (id === 999) {
        console.log('❌ [NODE-API] Simulating server error for ID 999');
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Simulated server error for testing'
        });
    }
    
    const user = users.get(id);
    if (!user) {
        console.log(`❌ [NODE-API] User with ID ${id} not found - Returning 404`);
        return res.status(404).json({
            error: 'User not found',
            message: `User with ID ${id} does not exist`
        });
    }
    
    console.log(`✅ [NODE-API] User found: ${user.name} - Returning 200`);
    res.json(user);
});

/**
 * POST /api/v1/users
 * Create a new user
 */
app.post('/api/v1/users', validateUser, handleValidationErrors, (req, res) => {
    console.log('🔍 [NODE-API] POST /api/v1/users - Request received');
    console.log(`🔍 [NODE-API] Request body: ${JSON.stringify(req.body)}`);
    console.log(`🔍 [NODE-API] User data - Name: ${req.body.name}, Email: ${req.body.email}, Age: ${req.body.age}`);
    
    const { name, email, age, department } = req.body;
    
    // Check for duplicate email
    if (!isEmailUnique(email)) {
        console.log(`❌ [NODE-API] Duplicate email detected: ${email} - Returning 400`);
        return res.status(400).json({
            error: 'Validation failed',
            message: 'Email already exists'
        });
    }
    
    // Create new user
    const id = nextId++;
    const newUser = {
        id,
        name,
        email,
        age: age || null,
        department: department || null
    };
    
    users.set(id, newUser);
    
    console.log(`✅ [NODE-API] User created successfully with ID: ${id} - Returning 201`);
    console.log(`🔍 [NODE-API] Total users now: ${users.size}`);
    
    res.status(201).json(newUser);
});

/**
 * PUT /api/v1/users/:id
 * Update an existing user
 */
app.put('/api/v1/users/:id', validateUserId, validateUser, handleValidationErrors, (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] PUT /api/v1/users/${id} - Request received`);
    console.log(`🔍 [NODE-API] Path variable 'id' = ${id} (type: ${typeof id})`);
    console.log(`🔍 [NODE-API] Request body: ${JSON.stringify(req.body)}`);
    console.log(`🔍 [NODE-API] Available user IDs: [${Array.from(users.keys()).join(', ')}]`);
    
    const existingUser = users.get(id);
    if (!existingUser) {
        console.log(`❌ [NODE-API] User with ID ${id} not found - Returning 404`);
        return res.status(404).json({
            error: 'User not found',
            message: `User with ID ${id} does not exist`
        });
    }
    
    console.log(`🔍 [NODE-API] Existing user: ${existingUser.name}`);
    
    const { name, email, age, department } = req.body;
    
    // Check for duplicate email (excluding current user)
    if (!isEmailUnique(email, id)) {
        console.log(`❌ [NODE-API] Duplicate email detected: ${email} - Returning 400`);
        return res.status(400).json({
            error: 'Validation failed',
            message: 'Email already exists'
        });
    }
    
    // Update user
    const updatedUser = {
        id,
        name,
        email,
        age: age || null,
        department: department || null
    };
    
    users.set(id, updatedUser);
    
    console.log(`✅ [NODE-API] User updated successfully - Name: ${updatedUser.name} - Returning 200`);
    
    res.json(updatedUser);
});

/**
 * DELETE /api/v1/users/:id
 * Delete a user
 */
app.delete('/api/v1/users/:id', validateUserId, handleValidationErrors, (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`🔍 [NODE-API] DELETE /api/v1/users/${id} - Request received`);
    console.log(`🔍 [NODE-API] Path variable 'id' = ${id} (type: ${typeof id})`);
    console.log(`🔍 [NODE-API] Available user IDs before deletion: [${Array.from(users.keys()).join(', ')}]`);
    
    const existingUser = users.get(id);
    if (!existingUser) {
        console.log(`❌ [NODE-API] User with ID ${id} not found - Returning 404`);
        return res.status(404).json({
            error: 'User not found',
            message: `User with ID ${id} does not exist`
        });
    }
    
    users.delete(id);
    
    console.log(`✅ [NODE-API] User ${existingUser.name} (ID: ${id}) deleted successfully - Returning 204`);
    console.log(`🔍 [NODE-API] Remaining users: ${users.size}`);
    
    res.status(204).send();
});

/**
 * GET /api/v1/users/department/:department
 * Get users by department
 */
app.get('/api/v1/users/department/:department', validateDepartment, handleValidationErrors, (req, res) => {
    const department = req.params.department;
    console.log(`🔍 [NODE-API] GET /api/v1/users/department/${department} - Request received`);
    console.log(`🔍 [NODE-API] Department parameter: '${department}'`);
    
    const departments = Array.from(users.values()).map(user => user.department).filter(Boolean);
    const uniqueDepartments = [...new Set(departments)];
    console.log(`🔍 [NODE-API] Available departments: [${uniqueDepartments.join(', ')}]`);
    
    const departmentUsers = Array.from(users.values()).filter(user => 
        user.department && user.department.toLowerCase() === department.toLowerCase()
    );
    
    console.log(`✅ [NODE-API] Found ${departmentUsers.length} users in department '${department}' - Returning 200`);
    
    res.json(departmentUsers);
});

/**
 * POST /api/v1/users/reset-test-data
 * Reset demo data for testing
 */
app.post('/api/v1/users/reset-test-data', (req, res) => {
    console.log('🔄 [NODE-API] RESET TEST DATA - Request received');
    
    initializeDemoData();
    
    const response = {
        message: 'Test data reset successfully',
        userCount: users.size,
        availableIds: Array.from(users.keys())
    };
    
    console.log(`✅ [NODE-API] Test data reset completed - Users: [${Array.from(users.keys()).join(', ')}]`);
    
    res.json(response);
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        users: users.size
    });
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
    console.error(`❌ [NODE-API] Stack trace: ${err.stack}`);
    
    res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred'
    });
});

// 404 handler
app.use((req, res) => {
    console.log(`❌ [NODE-API] 404 - Route not found: ${req.method} ${req.path}`);
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`
    });
});

// Start server
const server = app.listen(PORT, () => {
    console.log('🚀 [NODE-API] =====================================');
    console.log(`🚀 [NODE-API] Spectra Demo API (Node.js Express)`);
    console.log(`🚀 [NODE-API] Server running on port ${PORT}`);
    console.log(`🚀 [NODE-API] Base URL: http://localhost:${PORT}`);
    console.log(`🚀 [NODE-API] API Base: http://localhost:${PORT}/api/v1`);
    console.log(`🚀 [NODE-API] Health Check: http://localhost:${PORT}/health`);
    console.log(`🚀 [NODE-API] API Docs: http://localhost:${PORT}/api-docs`);
    console.log(`🚀 [NODE-API] Users initialized: ${users.size}`);
    console.log('🚀 [NODE-API] =====================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 [NODE-API] SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('🛑 [NODE-API] Process terminated');
    });
});

process.on('SIGINT', () => {
    console.log('🛑 [NODE-API] SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('🛑 [NODE-API] Process terminated');
    });
});

module.exports = app;

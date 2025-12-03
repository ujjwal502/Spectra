# Spectra Demo API - E-Commerce Platform (Node.js Express)

A comprehensive REST API built with Node.js and Express, simulating a full e-commerce platform. Designed for demonstrating and testing API testing agents with a wide variety of endpoints, data relationships, and business logic.

## Features

- 🚀 **Express.js** - Fast, unopinionated web framework
- 🛒 **Full E-Commerce** - Users, Products, Orders, Reviews, Cart, Wishlist, Coupons
- ✅ **Input Validation** - Comprehensive request validation using express-validator
- 🔒 **Security** - Security headers with Helmet.js
- 📊 **Analytics** - Statistics and reporting endpoints
- 🌐 **CORS Support** - Cross-Origin Resource Sharing enabled
- 📖 **API Documentation** - Interactive Swagger UI with OpenAPI 3.0
- ❤️ **Health Check** - Built-in health monitoring endpoint
- 🧪 **Test Data Management** - Reset endpoint for test isolation
- 💾 **In-Memory Storage** - No database required, perfect for testing

## Quick Start

### Prerequisites

- Node.js 16.0.0 or higher
- npm 8.0.0 or higher

### Installation

```bash
cd examples/node-express-api
npm install
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## API Endpoints Overview

### Base URL
```
http://localhost:3000/api/v1
```

### Users (9 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users` | Get all users (paginated, filterable) |
| GET | `/users/{id}` | Get user by ID |
| POST | `/users` | Create a new user |
| PUT | `/users/{id}` | Update user (full replacement) |
| PATCH | `/users/{id}` | Partially update user |
| DELETE | `/users/{id}` | Delete user |
| GET | `/users/department/{department}` | Get users by department |
| GET | `/users/{id}/orders` | Get user's orders |
| GET | `/users/{id}/reviews` | Get user's reviews |

### Products (9 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/products` | Get all products (paginated, filterable, sortable) |
| GET | `/products/featured` | Get featured products (rating >= 4.5) |
| GET | `/products/search` | Search products by query |
| GET | `/products/{id}` | Get product by ID |
| POST | `/products` | Create a new product |
| PUT | `/products/{id}` | Update product |
| PATCH | `/products/{id}` | Partially update product |
| DELETE | `/products/{id}` | Delete product |
| GET | `/products/{id}/reviews` | Get product reviews |
| PATCH | `/products/{id}/stock` | Adjust product stock |

### Categories (6 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/categories` | Get all categories |
| GET | `/categories/tree` | Get hierarchical category tree |
| GET | `/categories/{id}` | Get category by ID |
| POST | `/categories` | Create a new category |
| PUT | `/categories/{id}` | Update category |
| DELETE | `/categories/{id}` | Delete category |
| GET | `/categories/{id}/products` | Get products in category |

### Orders (6 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/orders` | Get all orders (paginated, filterable) |
| GET | `/orders/{id}` | Get order by ID (with product details) |
| POST | `/orders` | Create a new order |
| DELETE | `/orders/{id}` | Delete order |
| PATCH | `/orders/{id}/status` | Update order status |
| PATCH | `/orders/{id}/payment` | Update payment status |

### Reviews (6 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/reviews` | Get all reviews (paginated, filterable) |
| GET | `/reviews/{id}` | Get review by ID |
| POST | `/reviews` | Create a review |
| PUT | `/reviews/{id}` | Update review |
| DELETE | `/reviews/{id}` | Delete review |
| POST | `/reviews/{id}/helpful` | Mark review as helpful |

### Shopping Cart (5 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/cart/{userId}` | Get user's cart |
| POST | `/cart/{userId}/items` | Add item to cart |
| PUT | `/cart/{userId}/items/{productId}` | Update cart item quantity |
| DELETE | `/cart/{userId}/items/{productId}` | Remove item from cart |
| DELETE | `/cart/{userId}` | Clear entire cart |

### Coupons (5 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/coupons` | Get all coupons |
| GET | `/coupons/{code}` | Get coupon by code |
| POST | `/coupons` | Create a coupon |
| POST | `/coupons/validate` | Validate a coupon |
| DELETE | `/coupons/{code}` | Delete coupon |

### Addresses (4 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/{userId}/addresses` | Get user's addresses |
| POST | `/users/{userId}/addresses` | Add address for user |
| GET | `/addresses/{id}` | Get address by ID |
| PUT | `/addresses/{id}` | Update address |
| DELETE | `/addresses/{id}` | Delete address |

### Wishlist (3 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/{userId}/wishlist` | Get user's wishlist |
| POST | `/users/{userId}/wishlist` | Add product to wishlist |
| DELETE | `/users/{userId}/wishlist/{productId}` | Remove from wishlist |

### Notifications (3 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/{userId}/notifications` | Get user notifications |
| PATCH | `/notifications/{id}/read` | Mark notification as read |
| POST | `/users/{userId}/notifications/mark-all-read` | Mark all as read |

### Analytics & Stats (4 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stats/overview` | Platform statistics overview |
| GET | `/stats/top-products` | Get top products |
| GET | `/stats/orders-by-status` | Order counts by status |
| GET | `/stats/low-stock` | Low stock products |

### Admin (3 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/reset-test-data` | Reset all test data |
| GET | `/admin/data-counts` | Get entity counts |
| POST | `/users/reset-test-data` | Reset test data (legacy) |

### System (1 endpoint)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |

## API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:3000/api-docs
- **OpenAPI Spec**: [openapi.json](./openapi.json)

## Example Usage

### Products

```bash
# Get all products with filters
curl "http://localhost:3000/api/v1/products?categoryId=4&minPrice=500&maxPrice=1500&inStock=true"

# Search products
curl "http://localhost:3000/api/v1/products/search?q=phone&minRating=4"

# Create a product
curl -X POST http://localhost:3000/api/v1/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Wireless Mouse",
    "description": "Ergonomic wireless mouse",
    "price": 49.99,
    "categoryId": 1,
    "stock": 100,
    "brand": "TechGear"
  }'
```

### Orders

```bash
# Create an order with coupon
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "items": [
      { "productId": 1, "quantity": 1 },
      { "productId": 7, "quantity": 2 }
    ],
    "shippingAddress": {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "country": "USA"
    },
    "paymentMethod": "credit_card",
    "couponCode": "SAVE10"
  }'

# Update order status
curl -X PATCH http://localhost:3000/api/v1/orders/1/status \
  -H "Content-Type: application/json" \
  -d '{ "status": "shipped" }'
```

### Cart

```bash
# Add to cart
curl -X POST http://localhost:3000/api/v1/cart/1/items \
  -H "Content-Type: application/json" \
  -d '{ "productId": 5, "quantity": 2 }'

# Get cart with totals
curl http://localhost:3000/api/v1/cart/1
```

### Coupons

```bash
# Validate a coupon
curl -X POST http://localhost:3000/api/v1/coupons/validate \
  -H "Content-Type: application/json" \
  -d '{ "code": "SAVE10", "subtotal": 150.00 }'
```

### Reviews

```bash
# Create a review
curl -X POST http://localhost:3000/api/v1/reviews \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 1,
    "userId": 2,
    "rating": 5,
    "title": "Excellent product!",
    "comment": "Really happy with this purchase."
  }'

# Mark review as helpful
curl -X POST http://localhost:3000/api/v1/reviews/1/helpful
```

## Demo Data

The API initializes with comprehensive demo data:

### Users (5 users)
- John Doe (admin, Engineering)
- Jane Smith (user, Marketing)
- Bob Johnson (user, Engineering)
- Alice Brown (manager, Sales)
- Charlie Wilson (user, HR, inactive)

### Products (10 products)
- Electronics: iPhone 15 Pro, Samsung Galaxy S24, MacBook Pro, Dell XPS 15, Wireless Earbuds, Smart Watch
- Clothing: Oxford Shirt, Floral Dress
- Books: JavaScript: The Good Parts, Clean Code

### Categories (7 categories)
- Electronics (with subcategories: Smartphones, Laptops)
- Clothing (with subcategories: Men's, Women's)
- Books

### Orders (5 orders)
- Various statuses: delivered, shipped, processing, pending, cancelled

### Reviews (5 reviews)
- Mix of verified and unverified reviews

### Coupons (4 coupons)
- SAVE10: 10% off (min $50)
- FLAT20: $20 off (min $100)
- NEWUSER: 15% off for new users
- EXPIRED: Inactive expired coupon

## Testing Features

### Special Test Cases

- **User ID 999**: Returns 500 error for testing error handling
- **Duplicate Emails**: Returns 400 error for email uniqueness
- **Invalid Data**: Comprehensive validation with detailed errors
- **Coupon Validation**: Tests for expired, used, minimum purchase
- **Stock Management**: Insufficient stock validation
- **Order Cancellation**: Auto-restores stock when cancelled

### Reset Endpoint

Reset all data between test runs:
```bash
curl -X POST http://localhost:3000/api/v1/admin/reset-test-data
```

## Business Logic Highlights

1. **Order Processing**
   - Validates product availability
   - Reduces stock on order creation
   - Restores stock on cancellation
   - Applies coupon discounts with validation
   - Calculates tax (8%)

2. **Review System**
   - Auto-verifies reviews from purchasers
   - Recalculates product ratings on review changes
   - Prevents duplicate reviews per user/product

3. **Cart System**
   - Validates stock availability
   - Calculates totals with product prices
   - Handles quantity updates

4. **Category System**
   - Hierarchical with parent-child relationships
   - Prevents deletion of categories with products/subcategories

## Error Response Format

```json
{
  "error": "Validation failed",
  "message": "Email already exists",
  "details": [
    {
      "type": "field",
      "msg": "Email already exists",
      "path": "email",
      "location": "body"
    }
  ]
}
```

## HTTP Status Codes

- **200**: Success
- **201**: Created
- **204**: No Content (successful deletion)
- **400**: Bad Request (validation errors, business rule violations)
- **404**: Not Found
- **500**: Internal Server Error

## Environment Variables

- `PORT` - Server port (default: 3000)

## License

MIT License - see LICENSE file for details.

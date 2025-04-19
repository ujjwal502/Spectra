# Spectra Test Backend

A comprehensive test backend with a wide variety of API endpoints to test the Spectra API testing framework.

## Features

- **Authentication**: JWT-based auth with register, login, and user management
- **Products**: Full CRUD operations with filtering and pagination
- **Orders**: Create and manage orders with product inventory tracking
- **File Uploads**: Single and multiple file uploads with metadata
- **Weather API**: Test routes with simulated delays and errors
- **Tasks API**: Task management with filtering and sorting
- **ToDo API**: Simple to-do list management
- **Streaming**: Test endpoints for chunked responses and server-sent events

## Getting Started

### Prerequisites

- Node.js 14+ installed
- npm 6+ installed

### Installation

1. Install dependencies:

```bash
npm install
```

2. Run the server:

```bash
npm run dev
```

## API Documentation

The server runs at `http://localhost:3000` by default. You can use the following endpoints to test the Spectra framework:

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and get a JWT token
- `GET /api/auth/me` - Get current user profile (requires auth)

### Users

- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:id` - Get a specific user
- `PUT /api/users/:id` - Update a user
- `DELETE /api/users/:id` - Delete a user
- `POST /api/users` - Create a new user (admin only)

### Products

- `GET /api/products` - Get all products (with filtering and pagination)
- `GET /api/products/:id` - Get a specific product
- `POST /api/products` - Create a new product (admin only)
- `PUT /api/products/:id` - Update a product (admin only)
- `DELETE /api/products/:id` - Delete a product (admin only)
- `GET /api/products/category/:category` - Get products by category
- `PATCH /api/products/:id/stock` - Update product stock (admin only)

### Orders

- `GET /api/orders` - Get all orders (admin) or user's orders
- `GET /api/orders/:id` - Get a specific order
- `POST /api/orders` - Create a new order
- `PATCH /api/orders/:id/status` - Update order status (admin only)
- `DELETE /api/orders/:id` - Delete an order (admin only)

### File Uploads

- `POST /api/uploads/single` - Upload a single file
- `POST /api/uploads/multiple` - Upload multiple files (up to 5)
- `GET /api/uploads` - Get user's uploaded files
- `DELETE /api/uploads/:id` - Delete a file upload
- `POST /api/uploads/form` - Upload a file with additional form data

### Weather API

- `GET /api/weather` - Get all weather data
- `GET /api/weather/:id` - Get weather by ID
- `GET /api/weather/city/:city` - Get weather by city name
- `GET /api/weather/delayed` - Get weather with simulated delay
- `GET /api/weather/error` - Endpoint that simulates errors
- `GET /api/weather/random-error` - Endpoint that randomly succeeds or fails
- `GET /api/weather/timeout` - Endpoint that can timeout

### Tasks API

- `GET /api/tasks` - Get all tasks (with filtering and sorting)
- `GET /api/tasks/:id` - Get a specific task
- `POST /api/tasks` - Create a new task
- `PUT /api/tasks/:id` - Update a task
- `PATCH /api/tasks/:id/status` - Update task status
- `DELETE /api/tasks/:id` - Delete a task
- `GET /api/tasks/due/:days` - Get tasks due in the next X days

### ToDo API

- `GET /api/todos` - Get all todos
- `GET /api/todos/:id` - Get a specific todo
- `POST /api/todos` - Create a new todo
- `PUT /api/todos/:id` - Update a todo
- `PATCH /api/todos/:id/toggle` - Toggle todo completion status
- `DELETE /api/todos/:id` - Delete a todo
- `DELETE /api/todos/completed` - Delete all completed todos
- `PATCH /api/todos` - Toggle all todos completion status

### Streaming API

- `GET /api/streams/chunked` - Stream response in chunks
- `GET /api/streams/sse` - Server-Sent Events endpoint
- `GET /api/streams/large` - Stream a large JSON response
- `GET /api/streams/countdown` - Countdown timer as SSE

## Test Users

The backend comes with two pre-configured users:

1. Admin User:

   - Email: admin@example.com
   - Password: admin123
   - Role: admin

2. Regular User:
   - Email: user@example.com
   - Password: user123
   - Role: user

## Using with Spectra

This backend is designed to work with the Spectra testing framework. You can use it to test various API scenarios including:

- Authentication and authorization
- Error handling
- File uploads
- Delays and timeouts
- Concurrent requests
- Data validation
- Different response formats

For example, to test the Spectra framework with this backend:

```javascript
const { TestEngine, RunnerType } = require('spectra');

const testCase = {
  id: 'get-products',
  feature: {
    title: 'Product API',
    scenarios: [
      {
        title: 'Get all products',
        steps: [
          {
            keyword: 'When',
            text: 'I send a GET request to the products endpoint',
          },
          {
            keyword: 'Then',
            text: 'I should receive a successful response with a list of products',
          },
        ],
      },
    ],
  },
  endpoint: '/api/products',
  method: 'get',
  request: {},
  expectedResponse: {
    status: 200,
  },
};

const engine = new TestEngine({ runnerType: RunnerType.POSTMAN });
engine.executeTests('http://localhost:3000', [testCase.id]);
```

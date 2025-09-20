# Spectra Demo API - Node.js Express

A lightweight REST API built with Node.js and Express, designed for demonstrating Spectra's comprehensive testing capabilities. This API provides full CRUD operations for user management with comprehensive validation and error handling.

## Features

- 🚀 **Express.js** - Fast, unopinionated web framework
- ✅ **Input Validation** - Comprehensive request validation using express-validator
- 🔒 **Security** - Security headers with Helmet.js
- 📊 **Logging** - Request logging with Morgan
- 🌐 **CORS Support** - Cross-Origin Resource Sharing enabled
- 📖 **API Documentation** - Interactive Swagger UI
- ❤️ **Health Check** - Built-in health monitoring endpoint
- 🧪 **Test Data Management** - Reset endpoint for test isolation
- 📝 **OpenAPI 3.0** - Complete API specification

## Quick Start

### Prerequisites

- Node.js 16.0.0 or higher
- npm 8.0.0 or higher

### Installation

1. Navigate to the project directory:
```bash
cd examples/node-express-api
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## API Endpoints

### Base URL
```
http://localhost:3000/api/v1
```

### Users Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users` | Get all users |
| GET | `/users/{id}` | Get user by ID |
| POST | `/users` | Create a new user |
| PUT | `/users/{id}` | Update user |
| DELETE | `/users/{id}` | Delete user |
| GET | `/users/department/{department}` | Get users by department |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/users/reset-test-data` | Reset to demo data |

### System Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |

## API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:3000/api-docs
- **OpenAPI Spec**: [openapi.json](./openapi.json)

## Example Usage

### Create a User
```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Johnson",
    "email": "alice.johnson@example.com",
    "age": 25,
    "department": "Marketing"
  }'
```

### Get All Users
```bash
curl http://localhost:3000/api/v1/users
```

### Get User by ID
```bash
curl http://localhost:3000/api/v1/users/1
```

### Update User
```bash
curl -X PUT http://localhost:3000/api/v1/users/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Smith",
    "email": "john.smith@example.com",
    "age": 31,
    "department": "Engineering"
  }'
```

### Delete User
```bash
curl -X DELETE http://localhost:3000/api/v1/users/1
```

### Get Users by Department
```bash
curl http://localhost:3000/api/v1/users/department/Engineering
```

### Health Check
```bash
curl http://localhost:3000/health
```

### Reset Test Data
```bash
curl -X POST http://localhost:3000/api/v1/users/reset-test-data
```

## Validation Rules

### User Object
- **name**: Required, 2-50 characters
- **email**: Required, valid email format, must be unique
- **age**: Optional, integer between 18-100
- **department**: Optional, string

## Error Handling

The API provides comprehensive error handling with appropriate HTTP status codes:

- **200**: Success
- **201**: Created
- **204**: No Content (successful deletion)
- **400**: Bad Request (validation errors, duplicate email)
- **404**: Not Found (user doesn't exist)
- **500**: Internal Server Error (simulated for ID 999)

### Error Response Format
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

## Demo Data

The API starts with 3 demo users:

1. **John Doe** - john.doe@example.com (Engineering)
2. **Jane Smith** - jane.smith@example.com (Marketing)
3. **Bob Johnson** - bob.johnson@example.com (Engineering)

## Testing Features

### Special Test Cases

- **ID 999**: Returns 500 error for testing error handling
- **Duplicate Emails**: Returns 400 error for email uniqueness validation
- **Invalid Data**: Comprehensive validation with detailed error messages

### Reset Endpoint

Use the reset endpoint to restore demo data between test runs:
```bash
curl -X POST http://localhost:3000/api/v1/users/reset-test-data
```

## Development

### Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload
- `npm test` - Run tests (placeholder)

### Environment Variables

- `PORT` - Server port (default: 3000)

## Architecture

- **Express.js** - Web application framework
- **express-validator** - Input validation and sanitization
- **cors** - CORS middleware
- **helmet** - Security middleware
- **morgan** - HTTP request logging
- **swagger-ui-express** - API documentation

## Comparison with Java Version

This Node.js Express API provides the same functionality as the Java Spring Boot version but with:

- **Different Port**: 3000 (vs 8081 for Java)
- **Different Stack**: Node.js/Express (vs Java/Spring Boot)
- **Same API Contract**: Identical endpoints and behavior
- **Same Validation Rules**: Equivalent input validation
- **Same Error Handling**: Consistent error responses

## License

MIT License - see LICENSE file for details.

## Support

For questions or issues, contact demo@spectra.dev

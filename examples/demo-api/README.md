# Demo API for Spectra Testing

This is a lightweight API designed specifically for demonstrating Spectra's capabilities in a presentation or demo environment.

## Overview

A simple REST API with 4 core endpoints that demonstrate:

- GET operations (data retrieval)
- POST operations (data creation)
- PUT operations (data updates)
- DELETE operations (data removal)
- Different response codes (200, 201, 400, 404, 500)
- Request validation and error handling

## Quick Start

### Prerequisites

- Java 11 or higher
- Maven

### Running the Application

1. Navigate to the demo-api directory:

   ```bash
   cd examples/demo-api
   ```

2. Start the application:

   ```bash
   mvn spring-boot:run
   ```

3. The API will be available at `http://localhost:8081`

## API Endpoints

### Users API

- `GET /api/v1/users` - Get all users
- `POST /api/v1/users` - Create a new user
- `GET /api/v1/users/{id}` - Get user by ID
- `PUT /api/v1/users/{id}` - Update user
- `DELETE /api/v1/users/{id}` - Delete user

## Demo with Spectra

This API is perfect for demonstrating Spectra's capabilities:

### 1. Generate OpenAPI Spec from Source Code

```bash
npm run dev generate-spec examples/demo-api ./examples/demo-api/demo-api-spec.json
```

### 2. Generate Enhanced Tests

```bash
npm run test:demo-api:enhanced:generate
```

### 3. Execute Tests with Intelligent Runner

```bash
npm run test:demo-api:enhanced:execute
```

### 4. Complete Workflow Demo

```bash
npm run test:demo-api:enhanced:workflow
```

## Expected Demo Duration

- Spec Generation: ~30 seconds
- Test Generation: ~2-3 minutes
- Test Execution: ~1-2 minutes
- **Total Demo Time: ~5 minutes**

This makes it perfect for live demonstrations while still showing comprehensive test coverage and AI-powered insights.

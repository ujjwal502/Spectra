# Spectra: AI-Powered API Testing Agent

Spectra is an advanced API testing automation tool that uses AI to generate, manage, and execute comprehensive test suites for your APIs.

## Features

- 🤖 **AI-Powered Test Generation**: Automatically creates Gherkin-format test cases from OpenAPI/Swagger specifications
- 🔄 **Dynamic Updates**: Adapts tests when API specs change
- 🧪 **Comprehensive Testing**: Handles happy paths and edge cases
- 📊 **Detailed Reporting**: Clear insights into test results
- 🛠️ **Mock Data Generation**: Creates realistic test data based on schemas
- 🔌 **Tech-Agnostic**: Works with any API regardless of implementation
- 🚀 **Dual Execution Engines**: Run tests directly via REST client or through Postman/Newman
- 📁 **File Upload Support**: Test APIs that require file uploads with multipart/form-data
- 📈 **Interactive Dashboard**: Visualize test results and regression data through a web interface

## Documentation

- [Newman Integration Guide](./docs/NEWMAN_INTEGRATION.md) - Details on the Postman/Newman integration
- [File Upload Guide](./docs/FILE_UPLOAD_GUIDE.md) - Step-by-step guide for testing file uploads
- [Regression Testing Guide](./docs/REGRESSION_TESTING.md) - How to detect API regressions
- [Example: File Uploads](./examples/file-upload-test.ts) - Complete example of file upload testing
- [Dashboard Guide](./docs/DASHBOARD_GUIDE.md) - How to use the Spectra Dashboard

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/spectra.git
cd spectra

# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

### Configuration

Create a `.env` file in the root directory:

```
API_BASE_URL=https://your-api-url.com
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4  # Optional, defaults to gpt-4
```

### Generating Tests

To generate test cases from an OpenAPI/Swagger specification:

#### Standard Generation

```bash
npm run generate -- path/to/openapi.json ./features
```

#### AI-Enhanced Generation

```bash
npm run generate:ai -- path/to/openapi.json ./features
```

This will:

1. Parse the OpenAPI specification
2. Generate Gherkin feature files for each endpoint
3. Save them to the specified output directory

### Running Tests

#### Direct REST Client

Standard Execution:

```bash
npm run run -- path/to/openapi.json https://api-base-url.com ./results.json
```

AI-Enhanced Execution (with smarter mock data):

```bash
npm run run:ai -- path/to/openapi.json https://api-base-url.com ./results.json
```

#### Postman/Newman Execution

Standard Execution with Postman:

```bash
npm run run:postman -- path/to/openapi.json https://api-base-url.com ./results.json
```

AI-Enhanced Execution with Postman:

```bash
npm run run:ai:postman -- path/to/openapi.json https://api-base-url.com ./results.json
```

#### Regression Testing

Create Baseline:

```bash
npm run regression:baseline -- path/to/openapi.json https://api-base-url.com ./baseline.json
```

Run Regression Tests:

```bash
npm run regression:run -- path/to/openapi.json https://api-base-url.com ./baseline.json ./results.json
```

All execution modes will:

1. Generate test cases from the OpenAPI specification
2. Execute all tests against the specified API
3. Display results in the console
4. Save detailed results to a JSON file

### Dashboard

To access the Spectra Dashboard:

```bash
# Start the dashboard server
npm run dashboard
```

Then open your browser to `http://localhost:5173` to access the dashboard.

## Runner Types

### REST Client

- Direct execution using Axios
- Lightweight and fast execution
- No additional dependencies required

### Postman/Newman

- Executes tests via Newman (Postman CLI)
- Supports Postman Collection format
- Can leverage Postman test scripts
- Offers compatibility with existing Postman workflows

## AI-Enhanced Features

When running with the AI mode enabled:

- **Smarter Test Scenarios**: More comprehensive test cases covering edge cases
- **Enhanced Mock Data**: More realistic, contextually appropriate test data
- **Improved Validation**: Better assertions based on expected behavior

## Advanced Features

### Spectra Dashboard

The Spectra Dashboard provides a modern web interface for visualizing and analyzing your API test results:

- **Test Summary**: Overview of pass/fail rates and test coverage
- **Interactive Charts**: Visual representation of test performance over time
- **Regression Analysis**: Compare test results against baselines to identify changes
- **Detailed Inspection**: Examine API responses, assertions, and failures
- **Filtering and Search**: Quickly find specific test cases or endpoints

The dashboard leverages a modern frontend stack with responsive design for easy access from any device.

### File Uploads

Spectra provides comprehensive support for testing APIs that require file uploads using multipart/form-data requests. This feature is available in both the REST client and Postman/Newman runners.

#### File Upload Interface

The `FileUpload` interface defines the structure for file uploads:

```typescript
interface FileUpload {
  fieldName: string; // Form field name for the file
  filePath: string; // Path to the file on disk
  fileName?: string; // Optional custom filename (defaults to original filename)
  contentType?: string; // Optional MIME type (e.g., 'application/pdf', 'image/jpeg')
}
```

#### Adding Files to Test Cases

To include file uploads in your test cases, add a `files` array to your test case:

```typescript
const testCase = {
  id: 'file-upload-test',
  endpoint: '/upload',
  method: 'post',
  // Regular form fields
  request: {
    description: 'Additional text fields',
  },
  // File upload definitions
  files: [
    {
      fieldName: 'document',
      filePath: '/path/to/file.pdf',
      contentType: 'application/pdf',
    },
    // Add more files as needed
    {
      fieldName: 'image',
      filePath: '/path/to/image.jpg',
      contentType: 'image/jpeg',
    },
  ],
  expectedResponse: {
    status: 200,
  },
};
```

#### Running File Upload Tests

You can run tests with file uploads using any of the execution commands:

```bash
# Using REST client
npm run run -- path/to/openapi.json https://api-base-url.com ./results.json

# Using Postman/Newman
npm run run:postman -- path/to/openapi.json https://api-base-url.com ./results.json
```

The framework will automatically:

1. Verify file existence
2. Create appropriate multipart/form-data requests
3. Set correct content-type headers with boundaries
4. Stream files to the API endpoint
5. Process and validate responses

#### File Upload Example

A complete example is available in the repository:

```bash
# Run the file upload example
npm run example:file-upload
```

This example demonstrates:

- Creating and uploading a text file
- Setting appropriate content types
- Adding form fields alongside file uploads
- Handling the API response

#### Implementation Details

- **REST Client**: Uses Axios with FormData to handle file uploads
- **Postman Runner**: Converts files to Postman's formdata format for Newman execution
- **File Handling**: Uses streams to efficiently handle large files
- **Error Handling**: Validates file existence before attempting uploads

### Regression Testing

Spectra includes robust regression testing capabilities to detect unexpected changes in API behavior:

- **AI-Enhanced Testing**: Uses AI to generate comprehensive test scenarios
- **Postman Integration**: Leverages Postman/Newman for powerful execution and validation
- **Baseline Management**: Establish a baseline of expected behavior
- **Comprehensive Comparison**: Track status codes, response bodies, and assertion results
- **Detailed Reports**: Clear insight into what changed and why
- **CI/CD Integration**: Fail builds when regressions are detected

See the [Regression Testing Guide](./docs/REGRESSION_TESTING.md) for detailed usage instructions.

## Development Roadmap

### Phase 1: Foundation ✅

- Basic test generation from OpenAPI specs
- REST client for test execution
- Gherkin feature file generation

### Phase 2: AI Integration ✅

- Enhanced test scenario generation with AI
- Smart validation rules
- Realistic test data generation

### Phase 3: Advanced Features ✅ (Current)

- Postman/Newman integration for test execution
- File upload support for multipart/form-data requests
- Regression testing for detecting API behavior changes
- Interactive dashboard for test results ✅
- CI/CD integration (Coming soon)

### Phase 4: Enterprise Features

- Multi-environment support
- Performance testing
- Custom validation rules

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the ISC License.

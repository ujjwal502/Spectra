# Spectra: AI-Powered API Testing Agent

Spectra is an advanced API testing automation tool that uses AI to generate, manage, and execute comprehensive test suites for your APIs.

## Features

- 🤖 **AI-Powered Test Generation**: Automatically creates Gherkin-format test cases from OpenAPI/Swagger specifications
- 🔄 **Dynamic Updates**: Adapts tests when API specs change
- 🧪 **Comprehensive Testing**: Handles happy paths and edge cases
- 📊 **Detailed Reporting**: Clear insights into test results
- 🛠️ **Mock Data Generation**: Creates realistic test data based on schemas
- 🔌 **Tech-Agnostic**: Works with any API regardless of implementation

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

To execute tests against an API:

#### Standard Execution

```bash
npm run run -- path/to/openapi.json https://api-base-url.com ./results.json
```

#### AI-Enhanced Execution (with smarter mock data)

```bash
npm run run:ai -- path/to/openapi.json https://api-base-url.com ./results.json
```

This will:

1. Generate test cases from the OpenAPI specification
2. Execute all tests against the specified API
3. Display results in the console
4. Save detailed results to a JSON file

## AI-Enhanced Features

When running with the AI mode enabled:

- **Smarter Test Scenarios**: More comprehensive test cases covering edge cases
- **Enhanced Mock Data**: More realistic, contextually appropriate test data
- **Improved Validation**: Better assertions based on expected behavior

## Development Roadmap

### Phase 1: Foundation ✅

- Basic test generation from OpenAPI specs
- REST client for test execution
- Gherkin feature file generation

### Phase 2: AI Integration 🚀 (Current)

- Enhanced test scenario generation with AI
- Smart validation rules
- Realistic test data generation

### Phase 3: Advanced Features

- Change detection in API specs
- CI/CD integration
- Dashboard for test results

### Phase 4: Enterprise Features

- Multi-environment support
- Performance testing
- Custom validation rules

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the ISC License.

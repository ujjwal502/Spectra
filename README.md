# Spectra

**AI-Powered API Testing Automation Framework**

Spectra is an intelligent API testing automation framework that leverages artificial intelligence to generate comprehensive test suites, execute multi-dimensional testing, and provide real-time insights. It combines the power of OpenAI's GPT models with advanced testing methodologies to create a complete API testing solution.

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [AI-Powered Features](#ai-powered-features)
- [Testing Capabilities](#testing-capabilities)
- [Dashboard & Monitoring](#dashboard--monitoring)
- [Examples](#examples)
- [CLI Reference](#cli-reference)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [License](#license)

## Features

### Core Capabilities

- **AI-Powered Test Generation**: Leverages GPT-4 to create intelligent, comprehensive test cases
- **Automatic Spec Generation**: Analyzes source code to generate OpenAPI specifications
- **Multi-Dimensional Testing**: Functional, security, performance, and reliability testing
- **Gherkin/BDD Integration**: Generates business-readable test scenarios
- **Real-Time Dashboard**: Modern web interface for monitoring test execution
- **Regression Testing**: Baseline comparison and change detection
- **LangGraph Integration**: Multi-agent AI workflow for sophisticated testing strategies

### Testing Types

- **Functional Testing**: Core API functionality validation
- **Security Testing**: SQL injection, XSS, and security header analysis
- **Performance Testing**: Response time and throughput measurement
- **Reliability Testing**: Stability and consistency validation
- **Load Testing**: Concurrent user simulation
- **Boundary Testing**: Edge cases and input validation
- **Error Handling**: Exception and error response testing

### AI Enhancements

- **Intelligent Data Generation**: Context-aware test data creation
- **Pattern Recognition**: Identifies API design patterns and dependencies
- **Risk Assessment**: AI-driven analysis of potential issues
- **Adaptive Testing**: Dynamic test case adjustment based on results
- **Natural Language Reports**: Human-readable test insights and recommendations

## Quick Start

### Prerequisites

- Node.js 14+
- npm or yarn
- OpenAI API key (for AI features)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/spectra.git
cd spectra

# Install dependencies
npm install

# Set up environment variables
cp env.example .env
# Edit .env and add your OPENAI_API_KEY
```

### First Test Run

```bash
# Generate OpenAPI spec from demo API code
npm run generate:spec:demo-api

# Run intelligent testing on the demo API
npm run test:demo-api:intelligent
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Required for AI features
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=o4-mini
```

### Configuration File

The `config/default.json` file contains default settings:

```json
{
  "api": {
    "defaultTimeout": 30000,
    "retryAttempts": 3,
    "retryDelay": 1000
  },
  "openai": {
    "model": "gpt-4",
    "temperature": 0.7,
    "maxCompletionTokens": 1000
  },
  "runner": {
    "parallel": 5,
    "defaultEnvironment": "development"
  }
}
```

## Usage

### Basic Workflow

#### 1. Generate OpenAPI Specification

```bash
# Generate spec from demo API source code
npm run generate:spec:demo-api
```

This analyzes the demo API source code in `examples/demo-api` and generates an OpenAPI specification at `./examples/demo-api/openapi.json`.

#### 2. Run Intelligent Testing

```bash
# Run AI-powered intelligent testing on the demo API
npm run test:demo-api:intelligent
```

This command:

- Loads the generated OpenAPI specification
- Uses AI to create comprehensive test cases
- Executes functional and non-functional tests
- Provides intelligent insights and recommendations

#### 3. View Results (Optional)

```bash
# Launch the real-time dashboard
npm run dashboard
```

### Advanced Usage

#### Custom Spec Generation

```bash
# Generate spec for other APIs (modify source path as needed)
npm run generate-spec examples/your-api ./your-api-spec.json
```

#### Using Generated Specs

The `npm run generate:spec:demo-api` command creates a detailed OpenAPI specification that can be used with other tools:

- **Location**: `./examples/demo-api/openapi.json`
- **Features**: AI-enhanced with comprehensive endpoint documentation
- **Usage**: Can be imported into Postman, Swagger UI, or other API tools

#### Dashboard Features

When running `npm run dashboard`, you get:

- **Real-time test execution monitoring**
- **Interactive test result exploration**
- **AI-generated insights and recommendations**
- **Performance metrics visualization**
- **Exportable test reports**

## AI-Powered Features

### LangGraph Testing Agent

Spectra uses a sophisticated multi-layer AI architecture powered by LangGraph:

#### Layer 1: Understanding Layer

- Maps API system architecture
- Analyzes schemas and data flows
- Identifies dependencies and relationships

#### Layer 2: Testing Layer

- Coordinates specialized testing agents
- Generates scenarios for each endpoint
- Creates comprehensive test strategies

#### Layer 3: Gherkin Generation Layer

- Converts test scenarios to business-readable features
- Creates BDD-style documentation
- Enables stakeholder collaboration

#### Layer 4: Execution Layer

- **Functional Tester**: Core functionality validation
- **Security Tester**: Vulnerability assessment
- **Boundary Tester**: Edge case testing
- **Error Tester**: Exception handling validation

#### Layer 5: Analysis Layer

- Analyzes all test results
- Generates intelligent recommendations
- Provides risk assessments

### AI Test Data Generation

```javascript
// Example of AI-generated test data
{
  "validUser": {
    "name": "John Smith",
    "email": "john.smith@example.com",
    "department": "Engineering",
    "age": 28
  },
  "boundaryCase": {
    "name": "A".repeat(255), // Maximum length testing
    "email": "edge.case@domain.co",
    "age": 18 // Minimum valid age
  }
}
```

## Testing Capabilities

### Functional Testing

- HTTP method validation (GET, POST, PUT, DELETE)
- Request/response schema validation
- Status code verification
- Data integrity checks
- Authentication and authorization

### Security Testing

- SQL injection detection
- Cross-site scripting (XSS) prevention
- Security header validation
- Input sanitization testing
- Authentication bypass attempts

### Performance Testing

- Response time measurement
- Throughput analysis
- Concurrent request handling
- Resource utilization monitoring
- Performance regression detection

### Reliability Testing

- Consistency validation across multiple executions
- Error rate monitoring
- Stability testing under various conditions
- Recovery testing after failures

## Dashboard & Monitoring

### Real-Time Dashboard

Start the monitoring interface:

```bash
npm run dashboard
# Opens at http://localhost:3001
```

### Features

- **Live Test Execution**: Watch tests run in real-time
- **Interactive Results**: Expand/collapse detailed test information
- **Metrics Visualization**: Charts and graphs for test metrics
- **Log Streaming**: Real-time console output
- **Export Capabilities**: Save results in multiple formats

### Demo Mode

Perfect for client presentations:

```bash
npm run demo
```

See `DEMO_UI_GUIDE.md` for comprehensive demo instructions.

## Examples

### Demo API (Java Spring Boot)

The primary example included with Spectra is a Java Spring Boot API with user management endpoints:

```bash
# Generate OpenAPI spec from the demo API source code
npm run generate:spec:demo-api

# Run intelligent testing on the demo API
npm run test:demo-api:intelligent
```

**What gets tested:**

- User creation (POST /users)
- User retrieval (GET /users, GET /users/{id})
- User updates (PUT /users/{id})
- User deletion (DELETE /users/{id})
- Input validation and error handling
- Security vulnerabilities
- Performance characteristics

### Demo API Structure

Located in `examples/demo-api/`, the demo includes:

- **Java Source Code**: Spring Boot controllers and models
- **OpenAPI Spec**: Generated specification file
- **Maven Configuration**: Build and dependency management
- **Test Results**: Generated test reports and insights

### Other Examples

```bash
# Mock API testing (Node.js)
npm run test:mock-api:intelligent

# File upload testing
npm run example:file-upload
```

## CLI Reference

### Primary Commands

```bash
# Generate OpenAPI specification from demo API source code
npm run generate:spec:demo-api

# Run intelligent AI-powered testing on demo API
npm run test:demo-api:intelligent

# Launch real-time dashboard for monitoring
npm run dashboard
```

### Enhanced Commands (Advanced)

```bash
# Spec generation
npm run enhanced generate-spec-enhanced <rootDir> [outputPath]

# Test generation
npm run enhanced generate-tests-enhanced <specPath> [outputDir]

# Test execution
npm run enhanced execute-tests-intelligent <testSuiteDir> --base-url <url>

# Complete workflow
npm run enhanced test-workflow-enhanced <codebaseDir> --base-url <url>

# Information and diagnostics
npm run enhanced info
npm run enhanced check-env
```

### Standard Commands

```bash
# Generate OpenAPI spec from code
npm run generate-spec <sourcePath> [outputPath]

# Generate test cases
npm run generate [specPath] [outputDir]

# Run tests
npm run run [specPath] [baseUrl] [resultsPath]

# Regression testing
npm run regression:baseline [specPath] [baseUrl] [baselinePath]
npm run regression:run [specPath] [baseUrl] [baselinePath] [resultsPath]
```

## Architecture

### Project Structure

```
spectra/
├── src/
│   ├── agents/                    # AI testing agents
│   │   ├── enhancedTestGenerator.ts
│   │   ├── langGraphTestingAgent.ts
│   │   └── ...
│   ├── cli/                       # Command-line interface
│   │   ├── enhanced.ts
│   │   └── enhancedCommands.ts
│   ├── core/                      # Core testing engine
│   │   ├── engine.ts
│   │   ├── parser.ts
│   │   └── gherkinGenerator.ts
│   ├── integrations/              # External integrations
│   ├── runners/                   # Test execution runners
│   ├── services/                  # Supporting services
│   ├── types/                     # TypeScript definitions
│   └── utils/                     # Utility functions
├── examples/                      # Demo applications
│   ├── demo-api/                  # Java Spring Boot API
│   └── mock-api/                  # Node.js mock API
├── config/                        # Configuration files
└── docs/                          # Documentation
```

### Key Components

#### TestEngine

Central testing engine that coordinates all testing activities:

```typescript
const engine = new TestEngine({
  useAI: true,
  enableNonFunctionalTests: true,
  debug: true,
});
```

#### LangGraphTestingAgent

Multi-layer AI agent for sophisticated testing:

```typescript
const agent = new LangGraphTestingAgent();
const results = await agent.executeIntelligentTesting(apiSpec, outputDir);
```

#### EnhancedSpecIntegration

Generates OpenAPI specs from source code:

```typescript
const integration = new EnhancedSpecIntegration(options);
const spec = await integration.generateSpec(sourcePath);
```

#### IntelligentTestRunner

Executes tests with AI-driven adaptation:

```typescript
const runner = new IntelligentTestRunner(baseUrl);
const results = await runner.executeIntelligentTestSuite(testCases);
```

### Data Flow

1. **Input**: Source code or OpenAPI specification
2. **Analysis**: AI-powered API understanding and mapping
3. **Generation**: Comprehensive test case creation
4. **Execution**: Multi-dimensional test running
5. **Analysis**: Results evaluation and insights generation
6. **Reporting**: Dashboard visualization and export

### Integration Points

- **OpenAI API**: For AI-powered features
- **LangGraph**: For multi-agent workflows
- **WebSocket**: For real-time dashboard updates
- **Jest**: For test framework integration
- **cURL**: For HTTP request execution

## File Output Structure

When running enhanced workflows, Spectra creates organized output:

```
project-results/
├── specs/
│   └── api-spec.json              # Generated OpenAPI spec
├── tests/
│   ├── GET_users_tests.json       # Test cases per endpoint
│   ├── POST_users_tests.json
│   └── features/                  # Gherkin feature files
│       ├── users_management.feature
│       └── authentication.feature
├── results/
│   ├── GET_users_results.json     # Execution results
│   ├── POST_users_results.json
│   └── test-results.json          # Consolidated results
└── workflow-summary.json          # Complete workflow summary
```

## Best Practices

### For Development

1. **Generate First**: Always run `npm run generate:spec:demo-api` after code changes
2. **Test Regularly**: Use `npm run test:demo-api:intelligent` for comprehensive validation
3. **Use AI Features**: Ensure OpenAI API key is configured for best results
4. **Monitor Real-Time**: Use `npm run dashboard` during development
5. **Review Results**: Check AI-generated insights and recommendations

### For CI/CD Integration

```yaml
# Example GitHub Actions workflow
- name: Generate API Spec
  run: npm run generate:spec:demo-api

- name: Run Intelligent Tests
  run: npm run test:demo-api:intelligent
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

- name: Upload Test Results
  uses: actions/upload-artifact@v2
  with:
    name: spectra-test-results
    path: examples/demo-api/
```

### For Demonstrations

1. **Prepare Environment**: Ensure all APIs are running
2. **Use Demo Mode**: Leverage the built-in demo UI
3. **Show Progressive Enhancement**: Start basic, add AI features
4. **Highlight Intelligence**: Explain AI-generated content
5. **Interactive Exploration**: Let clients explore results

## Troubleshooting

### Common Issues

#### OpenAI API Issues

```bash
# Check API key
npm run enhanced check-env

# Verify API access
curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models
```

#### Port Conflicts

```bash
# Check what's using ports
lsof -ti:3000,3001,8080,8081

# Kill conflicting processes
lsof -ti:3001 | xargs kill
```

#### Test Execution Failures

- Verify API endpoints are accessible
- Check network connectivity
- Review generated test data validity
- Ensure proper authentication

### Debug Mode

Enable detailed logging:

```bash
DEBUG=spectra:* npm run generate:spec:demo-api
DEBUG=spectra:* npm run test:demo-api:intelligent
```

## Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Development Setup

```bash
# Clone and install
git clone https://github.com/your-org/spectra.git
cd spectra
npm install

# Run tests
npm test

# Run linting
npm run lint

# Format code
npm run format
```

## License

This project is licensed under the ISC License. See the LICENSE file for details.

---

**Built with AI. Tested with Intelligence. 🚀**

## Quick Reference

```bash
# 1. Generate spec from source code
npm run generate:spec:demo-api

# 2. Run intelligent testing
npm run test:demo-api:intelligent

# 3. View results (optional)
npm run dashboard
```

For more detailed guides, see:

- [Demo UI Guide](DEMO_UI_GUIDE.md) - Complete dashboard demonstration guide
- [Backend Test Guide](BACKEND_TEST_UI_GUIDE.md) - Real-time test monitoring
- [Non-Functional Testing](docs/NON_FUNCTIONAL_TESTING.md) - Performance and security testing

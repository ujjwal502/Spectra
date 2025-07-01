# Non-Functional Testing with Spectra

This guide explains how Spectra automatically performs non-functional testing to evaluate performance, security, reliability, and load aspects of your APIs with every test run.

## Overview

While functional testing ensures that your API works correctly according to its specification, non-functional testing focuses on how well the system performs. With every test execution, Spectra automatically runs four key types of non-functional tests:

1. **Performance Testing**: Measures response times and validates against thresholds
2. **Security Testing**: Tests for common vulnerabilities such as SQL injection and XSS
3. **Reliability Testing**: Verifies API stability under repeated calls
4. **Load Testing**: Simulates multiple concurrent users and measures performance under load

## Prerequisites

- Spectra with version 0.3.0 or higher
- A valid OpenAPI/Swagger specification for your API
- API service running and accessible
- Node.js 14 or higher

## Getting Started

### Running Tests (Non-Functional Tests Included)

Every time you run tests with Spectra, non-functional tests are automatically included:

```bash
# Standard test execution (includes non-functional tests)
npm run run -- path/to/openapi.json https://api-base-url.com ./results.json

# AI-enhanced test execution (includes non-functional tests)
npm run run:ai -- path/to/openapi.json https://api-base-url.com ./results.json
```

For testing specific backends in the examples folder:

```bash
# Test the backend example (includes non-functional tests)
npm run test:backend

# Test the mock API (includes non-functional tests)
npm run test:mock-api
```

Spectra selects a subset of your endpoints for non-functional testing to balance thorough testing with execution time.

### Example Directly From Code

Here's how non-functional testing is integrated when using Spectra programmatically:

```typescript
import { TestEngine } from 'spectra';
import { NonFunctionalTestType } from 'spectra/dist/types/nonfunctional';

async function runTests() {
  // Initialize the engine
  const engine = new TestEngine({
    useAI: true,
    // Non-functional testing is enabled by default, but you can customize settings
    nonFunctionalDefaults: {
      performance: {
        maxResponseTime: 1000, // 1s
        repetitions: 5,
      },
      security: {
        sqlInjection: true,
        xss: true,
      },
      // ... other test configurations
    },
  });

  // Load schema and generate test cases
  await engine.loadApiSchema('path/to/openapi.json');
  const testCases = await engine.generateTestCases();

  // Run functional tests on all endpoints
  const functionalResults = await engine.executeTests('https://api-base-url.com');

  // Non-functional test results are included in the test results
  console.log(`Tests completed with ${functionalResults.size} results`);
}
```

## Configuration Options

You can customize each type of non-functional test according to your requirements:

### Performance Testing

```typescript
{
  type: NonFunctionalTestType.PERFORMANCE,
  enabled: true,
  // Maximum acceptable response time in milliseconds
  maxResponseTime: 1000,
  // Number of repetitions to run for averaging response time
  repetitions: 5,
  // Delay between repetitions in milliseconds
  delay: 500
}
```

### Security Testing

```typescript
{
  type: NonFunctionalTestType.SECURITY,
  enabled: true,
  // Enable testing for SQL injection vulnerabilities
  sqlInjection: true,
  // Enable testing for XSS vulnerabilities
  xss: true,
  // Enable testing for insecure headers
  headers: true,
  // Custom security payloads to inject
  customPayloads: {
    'username': ["'; DROP TABLE users; --"]
  }
}
```

### Reliability Testing

```typescript
{
  type: NonFunctionalTestType.RELIABILITY,
  enabled: true,
  // Number of times to execute the request to test reliability
  executions: 10,
  // Minimum acceptable success rate (0-1)
  minSuccessRate: 0.95 // 95% success rate
}
```

### Load Testing

```typescript
{
  type: NonFunctionalTestType.LOAD,
  enabled: true,
  // Number of virtual users
  users: 5,
  // Duration of load test in seconds
  duration: 10,
  // Maximum acceptable response time under load in milliseconds
  maxResponseTime: 3000,
  // Minimum acceptable requests per second
  minRPS: 10
}
```

## Understanding Test Results

Non-functional test results provide detailed metrics for each type of test. Here's an example of what you'll see in the console output:

```
== NON-FUNCTIONAL TEST RESULTS ==

📊 GET /users (test_1):
  Functional Test: ✅ PASS
  Response Time: 157ms
  Non-Functional Tests:
    ✅ performance: Average response time (126.80ms) is within acceptable limit (1000ms)
      Metrics:
        avgResponseTime: 126.8
        minResponseTime: 98
        maxResponseTime: 157
        stdDeviation: 23.18
        totalDuration: 1634
        samples: 5
    ✅ security: No security issues detected
    ✅ reliability: Success rate (100.00%) meets minimum requirement (95.00%)
      Metrics:
        successRate: 1
        successCount: 10
        totalExecutions: 10
        totalDuration: 1245
        errors: 0
    ❌ load: Load test failed: Response time (3245.33ms) exceeds limit (3000ms)
      Metrics:
        totalRequests: 143
        duration: 10.05
        requestsPerSecond: 14.23
        avgResponseTime: 3245.33
      Error: Response time under load exceeds maximum threshold
```

## Best Practices

1. **Start Small**: Begin with a small subset of your API endpoints to avoid long execution times.
2. **Realistic Thresholds**: Set realistic performance thresholds based on your system's capabilities.
3. **Security Focus**: Pay special attention to security tests for endpoints that handle sensitive data.
4. **Production-Like Environment**: Run tests in an environment that closely resembles production.
5. **Regular Testing**: Include non-functional tests in your CI/CD pipeline for continuous monitoring.

## Troubleshooting

### Common Issues

#### Long Execution Times

Non-functional tests, especially load tests, can take a significant amount of time to run. Use the `--url` option to specify the API base URL and limit the number of test cases:

```bash
npm run example:nonfunctional -- --url https://your-api.com
```

#### Timeouts

If you're seeing timeout errors, increase the timeout limit in your engine configuration:

```typescript
const engine = new TestEngine({
  // ...
  timeout: 60000, // 60 seconds
});
```

#### False Positives in Security Tests

Security tests might flag potential issues that aren't actual vulnerabilities. Review the results carefully and adjust the security test configuration as needed.

## Advanced Usage

### CI/CD Integration

Add non-functional testing to your CI/CD pipeline by adding a step to run the tests:

```yaml
# GitHub Actions example
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      - run: npm install
      - run: npm run build
      - run: npm run run:nonfunctional -- ./schemas/api.json https://staging-api.example.com ./results-nonfunctional.json
      - name: Check for failures
        run: node ci/check-nonfunctional-results.js
```

### Custom Validation

You can extend the non-functional testing with custom validation logic:

```typescript
// After running tests
const results = await engine.executeNonFunctionalTests(baseUrl);

// Apply custom validation logic
for (const [id, result] of results.entries()) {
  if (result.nonFunctionalResults) {
    for (const nfResult of result.nonFunctionalResults) {
      if (nfResult.type === NonFunctionalTestType.PERFORMANCE) {
        // Custom validation for specific endpoints
        if (result.testCase.endpoint.includes('/critical')) {
          const avgTime = nfResult.metrics.avgResponseTime;
          if (avgTime > 500) {
            // Stricter threshold for critical endpoints
            console.warn(`Critical endpoint ${result.testCase.endpoint} is slow: ${avgTime}ms`);
          }
        }
      }
    }
  }
}
```

## Conclusion

Non-functional testing is an essential part of a comprehensive API testing strategy. With Spectra, you can easily integrate performance, security, reliability, and load testing into your workflow, ensuring your APIs not only function correctly but also perform well under various conditions.

For further assistance, please submit issues to the Spectra GitHub repository or refer to the other documentation guides.

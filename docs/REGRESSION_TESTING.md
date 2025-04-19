# Regression Testing with Spectra

Regression testing allows you to detect unexpected changes in API behavior by comparing current test results against a known baseline. This is especially useful when:

- Upgrading API dependencies
- Refactoring backend code
- Deploying to a new environment
- Verifying changes didn't affect unrelated endpoints

## How Regression Testing Works

1. A baseline of expected results is established from a known good state
2. Tests are run again after making changes
3. Results are compared against the baseline
4. Any regressions (new failures) are reported

## How AI + Postman Enhance Regression Testing

Spectra's regression testing leverages both AI and Postman for maximum effectiveness:

- **AI-Generated Test Scenarios**: OpenAI crafts comprehensive test cases that cover both happy paths and edge cases
- **Realistic Test Data**: AI generates contextually appropriate mock data based on schema definitions
- **Postman/Newman Execution**: The industry-standard Postman runner provides reliable test execution
- **Powerful Validation**: Postman's validation capabilities ensure thorough assertion checking

## Using Regression Testing

### Basic Workflow

```bash
# First, establish a baseline when the API is in a known good state
npm run regression:baseline path/to/openapi.json https://api.example.com baseline.json

# Later, after making changes, run regression tests
npm run regression:run path/to/openapi.json https://api.example.com baseline.json results.json
```

### Testing the Backend Example

```bash
# First, start the backend server
cd examples/backend
npm install
npm run dev

# In another terminal, create a baseline
npm run test:backend:regression:baseline

# After making changes to the backend, run regression tests
npm run test:backend:regression
```

## Interpreting Results

Regression test results are organized into categories:

- **Regressions**: Tests that passed in the baseline but fail now
- **Improvements**: Tests that failed in the baseline but pass now
- **New Tests**: Tests that weren't in the baseline
- **Removed Tests**: Tests that were in the baseline but are no longer present
- **Unchanged**: Tests with the same result as the baseline

A regression can be identified by:

- A change from a success status (2xx) to an error status
- A change from a client error (4xx) to a server error (5xx)
- A passing test that now fails
- New assertion failures that didn't exist in the baseline

## Example Output

```
== REGRESSION TEST RESULTS ==

Total tests: 15
New tests: 2
Removed tests: 1
Matching tests: 13

Regressions: 2 ❌
Improvements: 1 ✅
Unchanged: 12

=== REGRESSION DETAILS ===

❌ GET /todos
   Status code: 200 → 500

❌ POST /products
   Failed assertions:
     - Status code validation

=== IMPROVEMENTS ===

✅ PATCH /todos/1
   Status code: 404 → 200
   Fixed assertions:
     - Response time validation

=== NEW TESTS ===

✅ GET /health
❌ GET /metrics

=== REMOVED TESTS ===

❌ DELETE /users/1
```

## Continuous Integration

Regression testing is particularly valuable in CI/CD pipelines. In a CI environment:

```yaml
# Example GitHub Actions workflow
jobs:
  regression-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Start API server
        run: npm run start-server & sleep 5

      - name: Run regression tests
        run: npm run regression:run schema.json http://localhost:3000 baseline.json results.json
```

The workflow will fail if regressions are detected, preventing deployment of breaking changes.

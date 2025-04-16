# Newman Integration in Spectra

This document provides detailed information about the Newman integration in Spectra, including file upload capabilities.

## Overview

Spectra supports two execution engines:

1. Direct REST client (using Axios)
2. Postman/Newman runner

The Newman integration allows you to run your tests through Postman collections, which offers several advantages:

- Compatibility with existing Postman workflows
- Support for Postman test scripts
- Consistent results between Postman UI and automated tests
- Leveraging Newman's extensive reporting capabilities

## How It Works

### Architecture

The Newman integration follows these steps:

1. Test cases are converted to Postman Collections (v2.1.0 format)
2. Collections are written to temporary files
3. Newman CLI runner executes the collections
4. Results are processed and mapped back to Spectra's test results format

### PostmanRunner Class

The `PostmanRunner` class (`src/runners/postmanRunner.ts`) handles the execution:

```typescript
export class PostmanRunner {
  /**
   * Execute a test case using Newman
   * @param testCase Test case to execute
   * @returns Test result
   */
  async executeTest(testCase: TestCase): Promise<TestResult> {
    // Convert test case to Postman collection
    // Run it with Newman
    // Process results
  }
}
```

## File Upload Support

Newman supports file uploads through Postman's `formdata` mode. Spectra leverages this capability to test APIs that require file uploads.

### How File Uploads Work

1. When a test case includes the `files` property, Spectra converts it to Postman's formdata format
2. Each file is configured with the appropriate field name, file path, and content type
3. Newman handles the multipart/form-data request creation
4. Responses are processed as with regular requests

### Implementation Details

Converting test cases with file uploads to Postman collections:

```typescript
// From src/runners/postmanRunner.ts
private convertToPostmanCollection(testCase: TestCase): any {
  // ...

  // If files are present, use formdata mode
  if (files && files.length > 0) {
    bodyMode = 'formdata';
    bodyContent = [];

    // Add each file to formdata
    for (const file of files) {
      bodyContent.push({
        key: file.fieldName,
        type: 'file',
        src: file.filePath,
        contentType: file.contentType
      });
    }

    // Add regular fields alongside files
    // ...
  }

  // ...
}
```

### Newman Configuration Options

The Newman runner is configured with the following options:

```typescript
newman.run(
  {
    collection: require(collectionPath),
    environment: require(environmentPath),
    reporters: ['cli'],
    reporter: {
      cli: {
        noSummary: true,
        noBanner: true,
      },
    },
    insecure: true, // Skip SSL verification
    timeout: 60000, // 60 second timeout
    timeoutRequest: 30000, // 30 second request timeout
    timeoutScript: 5000, // 5 second script timeout
    fileResolver: fs, // File system resolver for file uploads
  },
  // ...
);
```

## Using Both Runners

Spectra allows you to choose between runners at runtime:

```typescript
// Using REST client (default)
const engine = new TestEngine();

// Using Newman/Postman
const engine = new TestEngine({ runnerType: RunnerType.POSTMAN });

// Switch runner at runtime
engine.setRunnerType(RunnerType.POSTMAN);
```

## Command Line Options

The following CLI flags control the runner selection:

```bash
# Use REST client (default)
npm run run -- path/to/openapi.json https://api-base-url.com ./results.json

# Use Postman/Newman runner
npm run run:postman -- path/to/openapi.json https://api-base-url.com ./results.json

# Use Postman/Newman runner with AI enhancement
npm run run:ai:postman -- path/to/openapi.json https://api-base-url.com ./results.json
```

## Future Enhancements

Planned improvements for the Newman integration:

1. **Enhanced Reporting**: Support for HTML, JUnit, and other Newman reporters
2. **Collection Persistence**: Option to save collections for later use in Postman
3. **Advanced Scripts**: Support for pre-request scripts and test scripts
4. **Extensive Environment Variables**: More comprehensive environment handling

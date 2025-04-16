# Testing APIs with File Uploads in Spectra

This guide walks you through testing APIs that require file uploads using Spectra.

## Quick Start

The fastest way to see file uploads in action is to run the included example:

```bash
npm run example:file-upload
```

This will:

1. Create a sample text file
2. Create a test case with file upload
3. Execute the test against httpbin.org
4. Display the results

## Step-by-Step Guide for Your Own APIs

### 1. Prepare Your Test Files

First, identify the files you want to upload in your tests:

```typescript
// You can create files dynamically for testing
const createTestFile = () => {
  const filePath = path.join(__dirname, 'test-files', 'sample.json');
  fs.writeFileSync(filePath, JSON.stringify({ test: 'data' }), 'utf8');
  return filePath;
};

// Or use existing files
const pdfPath = path.join(__dirname, 'test-files', 'document.pdf');
const imagePath = path.join(__dirname, 'test-files', 'image.jpg');
```

### 2. Define File Upload Metadata

Create `FileUpload` objects for each file:

```typescript
const documentUpload: FileUpload = {
  fieldName: 'document', // The name of the form field expected by the API
  filePath: pdfPath, // Path to the file on disk
  contentType: 'application/pdf', // MIME type of the file
};

const imageUpload: FileUpload = {
  fieldName: 'image',
  filePath: imagePath,
  fileName: 'custom-name.jpg', // Optional custom filename
  contentType: 'image/jpeg',
};
```

### 3. Create Your Test Case

Add the file uploads to your test case:

```typescript
const testCase: TestCase = {
  id: 'create-user-with-documents',
  feature: {
    title: 'User Document Upload',
    scenarios: [
      {
        title: 'Upload user documents during registration',
        steps: [
          { keyword: 'Given', text: 'I have user registration data' },
          { keyword: 'And', text: 'I have document files to upload' },
          { keyword: 'When', text: 'I submit the registration form with documents' },
          { keyword: 'Then', text: 'The registration should be successful' },
        ],
      },
    ],
  },
  endpoint: '/api/users',
  method: 'post',
  request: {
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
  },
  expectedResponse: {
    status: 201,
  },
  files: [documentUpload, imageUpload], // 👈 Add files here
};
```

### 4. Execute the Test

Choose which runner to use:

```typescript
// Using REST client
const engine = new TestEngine({ runnerType: RunnerType.REST });

// Or using Postman/Newman
const engine = new TestEngine({ runnerType: RunnerType.POSTMAN });

// Run the test
const results = await engine.executeTests('https://your-api.com', [testCase.id]);
```

Alternatively, use the CLI:

```bash
# If your tests are defined in an OpenAPI schema
npm run run:postman -- path/to/openapi.json https://your-api.com ./results.json
```

### 5. Handling Multiple Files

Many APIs need multiple files uploaded in a single request:

```typescript
files: [
  {
    fieldName: 'frontId',
    filePath: '/path/to/front-id.jpg',
    contentType: 'image/jpeg',
  },
  {
    fieldName: 'backId',
    filePath: '/path/to/back-id.jpg',
    contentType: 'image/jpeg',
  },
  {
    fieldName: 'selfie',
    filePath: '/path/to/selfie.jpg',
    contentType: 'image/jpeg',
  },
];
```

### 6. Examining Results

Check for successful file upload:

```typescript
if (result.success) {
  console.log('Files uploaded successfully!');
  console.log('API Response:', result.response);
} else {
  console.log('File upload failed');
  console.log('Error:', result.error);
  console.log(
    'Failed assertions:',
    result.assertions.filter((a) => !a.success).map((a) => a.name),
  );
}
```

## Common Issues and Solutions

### File Not Found

If your test is failing with "File not found" errors:

```
Error: File not found: /path/to/missing-file.pdf
```

Ensure:

- The file path is correct and absolute
- The file exists at the specified location
- The process has read permissions for the file

### Content-Type Errors

If the API rejects your uploads due to incorrect content types:

1. Check your `contentType` property
2. Common content types:
   - PDF: `application/pdf`
   - JPG: `image/jpeg`
   - PNG: `image/png`
   - TXT: `text/plain`
   - JSON: `application/json`
   - Generic binary: `application/octet-stream`

### File Size Limitations

If your files are too large:

1. Newman has a default request size limit
2. Your API might have its own file size limits
3. Consider using smaller test files for automated testing

## Advanced: Custom Validation

For APIs that return details about the uploaded files, add custom validation:

```typescript
const testCase: TestCase = {
  // ... other properties ...

  expectedResponse: {
    status: 200,
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        fileId: { type: 'string' },
        fileSize: { type: 'number' },
        fileName: { type: 'string' },
      },
      required: ['success', 'fileId'],
    },
  },
};
```

/**
 * File Upload Example
 *
 * This example demonstrates how to use Spectra to test API endpoints that require file uploads.
 * It shows how to:
 *  1. Create test files for upload
 *  2. Define file upload metadata using the FileUpload interface
 *  3. Configure test cases with file uploads
 *  4. Execute tests using the CurlRunner
 *
 * To run this example:
 *  npm run example:file-upload
 */

import { TestEngine, RunnerType } from '../src/core/engine';
import { TestCase, FileUpload } from '../src/types';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Creates a sample text file for upload testing
 * @returns Path to the created sample file
 */
const createSampleFile = () => {
  const testFilesDir = path.join(__dirname, 'test-files');
  if (!fs.existsSync(testFilesDir)) {
    fs.mkdirSync(testFilesDir, { recursive: true });
  }

  const filePath = path.join(testFilesDir, 'sample.txt');
  fs.writeFileSync(filePath, 'This is a sample file for testing uploads.', 'utf8');

  return filePath;
};

/**
 * Demonstrates file upload testing with Spectra
 */
async function runFileUploadExample() {
  const sampleFilePath = createSampleFile();
  console.log(`Created sample file at: ${sampleFilePath}`);

  const fileUpload: FileUpload = {
    fieldName: 'file',
    filePath: sampleFilePath,
    contentType: 'text/plain',
  };

  const testCase: TestCase = {
    id: 'file-upload-test',
    feature: {
      title: 'File Upload Test',
      scenarios: [
        {
          title: 'Upload a file to an API endpoint',
          steps: [
            {
              keyword: 'Given',
              text: 'I have a file to upload',
            },
            {
              keyword: 'When',
              text: 'I send the file to the upload endpoint',
            },
            {
              keyword: 'Then',
              text: 'I should receive a successful response',
            },
          ],
        },
      ],
    },
    endpoint: '/post',
    method: 'post',
    request: {
      description: 'Additional form field with the file upload',
    },
    expectedResponse: {
      status: 200,
    },
    files: [fileUpload],
  };

  const engine = new TestEngine();

  console.log('Running file upload test with cURL...');

  const apiUrl = 'https://httpbin.org';

  try {
    const testCases = new Map<string, TestCase>();
    testCases.set(testCase.id, testCase);

    Object.defineProperty(engine, 'testCases', { value: testCases });

    const results = await engine.executeTests(apiUrl, [testCase.id]);

    console.log('\nTest Results:');
    console.log('---------------------------------------------------------');
    for (const [id, result] of results.entries()) {
      console.log(`Test ID: ${id}`);
      console.log(`Success: ${result.success}`);
      console.log(`Duration: ${result.duration}ms`);

      if (result.error) {
        console.log(`Error: ${result.error}`);
      }

      if (result.response) {
        console.log(`Response status: ${result.response.status}`);
        console.log(
          `Response: ${JSON.stringify(result.response.body, null, 2).substring(0, 200)}...`,
        );

        if (result.response.body?.files?.file) {
          console.log('✅ File upload successful!');
        }
      }

      console.log('Assertions:');
      if (result.assertions && result.assertions.length > 0) {
        result.assertions.forEach((assertion) => {
          console.log(`- ${assertion.name}: ${assertion.success ? 'PASS' : 'FAIL'}`);
          if (!assertion.success && assertion.error) {
            console.log(`  Error: ${assertion.error}`);
          }
        });
      } else {
        console.log('- No assertions');
      }

      console.log('---------------------------------------------------------');
    }
  } catch (error) {
    console.error('Error running test:', error);
  }
}

runFileUploadExample().catch(console.error);

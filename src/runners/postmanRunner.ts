// Use require for Newman to avoid type issues
const newman = require('newman');
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { TestCase, TestResult, AssertionResult } from '../types';
import { ResponseValidator } from '../validators/responseValidator';
import { validateSchema } from '../utils/schema';

interface NewmanRunOptions {
  collection: any;
  environment?: any;
  reporters?: string[];
  reporter?: Record<string, any>;
  insecure?: boolean;
  timeout?: number;
  timeoutRequest?: number;
  timeoutScript?: number;
  fileResolver?: any;
}

interface NewmanRun {
  run: {
    executions?: Array<{
      response?: {
        code: number;
        json: () => any;
        text?: () => string;
        stream?: any;
        headers: any;
      };
      assertions?: Array<{
        assertion: string;
        passed: boolean;
        error?: {
          message: string;
        };
      }>;
    }>;
  };
}

interface PostmanUrl {
  raw: string;
  host: string[];
  path: string[];
  variable?: Array<{ key: string; value: string }>;
}

/**
 * Runner that executes tests using Newman (Postman CLI)
 */
export class PostmanRunner {
  private validator: ResponseValidator;
  private tempDir: string;

  constructor(private baseUrl: string = '') {
    this.validator = new ResponseValidator();
    this.tempDir = path.join(process.cwd(), 'temp');

    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Execute a test case using Newman
   * @param testCase Test case to execute
   * @returns Test result
   */
  async executeTest(testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now();
    let assertions: AssertionResult[] = [];
    let responseObj: any = null;
    let success = true;

    try {
      // Setup collection and environment files
      const collection = this.convertToPostmanCollection(testCase);
      const collectionPath = path.join(this.tempDir, `${testCase.id}.json`);
      fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2));

      const environment = {
        name: 'Test Environment',
        values: [{ key: 'baseUrl', value: this.baseUrl, enabled: true }],
      };
      const environmentPath = path.join(this.tempDir, `${testCase.id}_env.json`);
      fs.writeFileSync(environmentPath, JSON.stringify(environment, null, 2));

      // Run Newman
      const newmanResult = await this.runNewman(collectionPath, environmentPath);
      const duration = Date.now() - startTime;

      // Extract the response if available
      if (newmanResult.run?.executions?.[0]?.response) {
        const response = newmanResult.run.executions[0].response;
        let responseBody;

        try {
          responseBody = response.json();
        } catch (e) {
          responseBody = response.stream || response.code.toString();
        }

        responseObj = {
          status: response.code,
          body: responseBody,
          headers: response.headers?.toJSON?.() || response.headers || {},
        };

        // Manually perform schema validation to ensure consistency with RestClient
        if (testCase.expectedResponse?.schema && responseBody) {
          try {
            const validationResult = validateSchema(testCase.expectedResponse.schema, responseBody);

            // Look for existing schema validation assertions
            const existingSchemaAssertion = assertions.find(
              (a) => a.name === 'Response matches schema' || a.name === 'Schema validation',
            );

            // If no schema assertion exists yet, add one
            if (!existingSchemaAssertion) {
              if (!validationResult.valid) {
                const errorMsg = validationResult.errors
                  ? validationResult.errors.map((e) => `${e.instancePath} ${e.message}`).join(', ')
                  : 'Unknown schema validation error';

                assertions.push({
                  name: 'Schema validation',
                  success: false,
                  error: `Schema validation error: ${errorMsg}`,
                });
                success = false;
              } else {
                assertions.push({
                  name: 'Schema validation',
                  success: true,
                });
              }
            }
          } catch (error) {
            // Add explicit schema validation failure
            assertions.push({
              name: 'Schema validation',
              success: false,
              error: `Error validating response: ${error}`,
            });
            success = false;
          }
        } else if (testCase.expectedResponse && !testCase.expectedResponse.schema) {
          // Always add a placeholder schema validation assertion for consistency
          assertions.push({
            name: 'Schema validation',
            success: true,
            info: 'No schema validation performed (no schema specified)',
          });
        }
      }

      // Process Newman assertions - fix the issue with conflicting passed status
      if (newmanResult.run?.executions?.[0]?.assertions) {
        const newmanAssertions = newmanResult.run.executions[0].assertions;

        // Clear any existing assertions
        assertions = [];

        console.log('\nDebug - Newman Assertions:');
        for (const assertion of newmanAssertions) {
          // Look for success symbol in Newman output by checking if assertion has a checkmark in the output
          const wasPassed = !assertion.error; // If there's no error, it passed

          console.log(
            `  ${assertion.assertion}: ${wasPassed ? 'PASSED (no error)' : 'FAILED (has error)'}`,
          );
          console.log(`    Error info: ${assertion.error ? assertion.error.message : 'No error'}`);

          // Add each assertion result in our format
          assertions.push({
            name: assertion.assertion,
            success: wasPassed,
            error: assertion.error?.message,
          });
        }

        // Test is successful only if ALL assertions passed (no errors)
        success = newmanAssertions.every((assertion) => !assertion.error);
      } else {
        // No assertions ran - mark as failed
        success = false;
        assertions = [
          {
            name: 'Test execution',
            success: false,
            error: 'No assertions were executed',
          },
        ];
      }

      // Clean up temp files
      this.cleanupTempFiles(testCase.id);

      // Print final assertions after processing
      console.log('\nAssertions after processing:');
      assertions.forEach((a) => {
        console.log(`  ${a.name}: ${a.success ? 'SUCCESS' : 'FAIL'}`);
      });
      console.log(`Overall test success: ${success ? 'PASS' : 'FAIL'}`);

      // Return result
      return {
        testCase,
        success,
        duration,
        response: responseObj,
        assertions,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.cleanupTempFiles(testCase.id);

      return {
        testCase,
        success: false,
        duration,
        error: error.message,
        assertions: [
          {
            name: 'Test execution',
            success: false,
            error: `Error executing test: ${error.message}`,
          },
        ],
      };
    }
  }

  /**
   * Run Newman on a collection
   */
  private runNewman(collectionPath: string, environmentPath: string): Promise<NewmanRun> {
    return new Promise((resolve, reject) => {
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
          insecure: true,
          timeout: 60000,
          timeoutRequest: 30000,
          timeoutScript: 5000,
          fileResolver: fs,
        } as NewmanRunOptions,
        (err: Error | null, summary: NewmanRun) => {
          if (err) {
            reject(err);
          } else {
            resolve(summary);
          }
        },
      );
    });
  }

  /**
   * Convert a test case to a Postman collection
   */
  private convertToPostmanCollection(testCase: TestCase): any {
    const { endpoint, method, request, files } = testCase;

    let bodyMode = 'raw';
    let bodyContent: any = null;
    let bodyOptions = {
      raw: {
        language: 'json',
      },
    };

    if (files && files.length > 0) {
      bodyMode = 'formdata';
      bodyContent = [];

      for (const file of files) {
        bodyContent.push({
          key: file.fieldName,
          type: 'file',
          src: file.filePath,
          contentType: file.contentType,
        });
      }

      if (request) {
        Object.entries(request).forEach(([key, value]) => {
          if (!files.some((file) => file.fieldName === key)) {
            bodyContent.push({
              key,
              value: typeof value === 'object' ? JSON.stringify(value) : String(value),
              type: 'text',
            });
          }
        });
      }
    } else if (request) {
      bodyMode = 'raw';
      bodyContent = JSON.stringify(request);
    }

    const collection = {
      info: {
        name: testCase.feature.title,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        _postman_id: uuidv4(),
      },
      item: [
        {
          name: testCase.feature.scenarios[0].title,
          request: {
            method: method.toUpperCase(),
            url: {
              raw: `{{baseUrl}}${endpoint}`,
              host: ['{{baseUrl}}'],
              path: endpoint.split('/').filter((p) => p),
            } as PostmanUrl,
            header: [
              {
                key: 'Content-Type',
                value: files && files.length > 0 ? 'multipart/form-data' : 'application/json',
              },
            ],
            body: bodyContent
              ? {
                  mode: bodyMode,
                  [bodyMode]: bodyContent,
                  options: bodyMode === 'raw' ? bodyOptions : undefined,
                }
              : undefined,
          },
          event: [
            {
              listen: 'test',
              script: {
                exec: this.generatePostmanTests(testCase),
              },
            },
          ],
        },
      ],
    };

    if (endpoint.includes('{') && endpoint.includes('}')) {
      const params = endpoint.match(/{([^}]+)}/g) || [];
      const item = collection.item[0];
      const url = item.request.url as PostmanUrl;

      if (!url.variable) {
        url.variable = [];
      }

      for (const param of params) {
        const paramName = param.replace('{', '').replace('}', '');
        const paramValue = request?.[paramName] || '1'; // Default to '1' if not provided

        url.variable.push({
          key: paramName,
          value: paramValue.toString(),
        });
      }
    }

    return collection;
  }

  /**
   * Generate Postman test scripts from test case
   */
  private generatePostmanTests(testCase: TestCase): string[] {
    const expectedStatus = testCase.expectedResponse?.status || 200;
    const tests = [
      `pm.test("Status code is ${expectedStatus}", function() {`,
      `    pm.response.to.have.status(${expectedStatus});`,
      `});`,
      '',
      'pm.test("Response time is acceptable", function() {',
      '    pm.expect(pm.response.responseTime).to.be.below(2000);',
      '});',
    ];

    if (testCase.expectedResponse?.schema) {
      // For schema validation tests, check if the response is valid and status code is successful
      tests.push('');
      tests.push('pm.test("Response matches schema", function() {');

      // Only validate schema for success responses
      if (expectedStatus < 400) {
        tests.push('    const schema = ' + JSON.stringify(testCase.expectedResponse.schema) + ';');
        tests.push('    pm.expect(pm.response.json()).to.be.jsonSchema(schema);');
      } else {
        // For error responses, just validate it's a valid JSON
        tests.push('    pm.expect(() => pm.response.json()).not.to.throw();');
      }

      tests.push('});');
    }

    return tests;
  }

  /**
   * Clean up temporary files
   */
  private cleanupTempFiles(testId: string): void {
    const collectionPath = path.join(this.tempDir, `${testId}.json`);
    const environmentPath = path.join(this.tempDir, `${testId}_env.json`);

    if (fs.existsSync(collectionPath)) {
      fs.unlinkSync(collectionPath);
    }

    if (fs.existsSync(environmentPath)) {
      fs.unlinkSync(environmentPath);
    }
  }

  /**
   * Set base URL for requests
   */
  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }
}

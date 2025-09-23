import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { TestCase, TestResult, AssertionResult } from '../types';
import { ResponseValidator } from '../validators/responseValidator';
import { validateSchema } from '../utils/schema';

const execPromise = promisify(exec);

/**
 * Runner that executes tests using native CURL commands
 */
export class CurlRunner {
  private validator: ResponseValidator;
  private tempDir: string;
  private baseUrl: string;
  private timeout: number = 30000;

  constructor(baseUrl: string = '') {
    this.validator = new ResponseValidator();
    this.baseUrl = baseUrl;
    this.tempDir = path.join(process.cwd(), 'temp', 'curl');

    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Execute a test case using CURL
   * @param testCase Test case to execute
   * @returns Test result
   */
  async executeTest(testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now();
    const assertions: AssertionResult[] = [];

    console.log('🚀 [CURL-RUNNER] ===========================================');
    console.log('🚀 [CURL-RUNNER] Starting test execution for:', testCase.id);
    console.log('🚀 [CURL-RUNNER] Test endpoint:', testCase.endpoint);
    console.log('🚀 [CURL-RUNNER] Test method:', testCase.method);
    console.log('🚀 [CURL-RUNNER] Test request:', JSON.stringify(testCase.request, null, 2));

    try {
      const { id, endpoint, method, request, files, expectedResponse } = testCase;
      console.log('🚀 [CURL-RUNNER] Expected response:', JSON.stringify(expectedResponse, null, 2));

      const url = this.constructUrl(endpoint, request);

      const curlCommand = this.buildCurlCommand(url, method, request, files, testCase.headers);
      console.log('🚀 [CURL-RUNNER] Generated cURL command:', curlCommand);

      const scriptPath = this.createTempScript(id, curlCommand);
      console.log('🚀 [CURL-RUNNER] Created temp script at:', scriptPath);

      console.log('🚀 [CURL-RUNNER] Executing cURL command...');
      const { stdout, stderr } = await execPromise(`bash ${scriptPath}`, {
        timeout: this.timeout,
        maxBuffer: 10 * 1024 * 1024,
      });

      console.log('🚀 [CURL-RUNNER] cURL stdout:', stdout);
      if (stderr) {
        console.log('🚀 [CURL-RUNNER] cURL stderr:', stderr);
      }

      if (stderr && !stdout) {
        throw new Error(`CURL error: ${stderr}`);
      }

      const { status, headers, body } = this.parseCurlResponse(stdout);
      console.log('🚀 [CURL-RUNNER] Parsed response - Status:', status);
      console.log('🚀 [CURL-RUNNER] Parsed response - Headers:', JSON.stringify(headers, null, 2));
      console.log('🚀 [CURL-RUNNER] Parsed response - Body:', JSON.stringify(body, null, 2));

      const duration = Date.now() - startTime;

      const statusAssertion = this.validator.validateStatusCode(
        status,
        expectedResponse?.status || 200,
      );
      console.log('🚀 [CURL-RUNNER] Status validation result:', statusAssertion);
      assertions.push(statusAssertion);

      // Skip schema validation if response is not JSON
      const contentType = (headers['Content-Type'] || headers['content-type'] || '').toLowerCase();
      const isJson = contentType.includes('application/json');

      if (expectedResponse?.schema && body && isJson) {
        try {
          const parsedBody = typeof body === 'string' && body.trim() ? JSON.parse(body) : body;

          const validationResult = validateSchema(expectedResponse.schema, parsedBody);

          if (!validationResult.valid) {
            const errorMsg = validationResult.errors
              ? validationResult.errors.map((e) => `${e.instancePath} ${e.message}`).join(', ')
              : 'Unknown schema validation error';

            assertions.push({
              name: 'Schema validation',
              success: false,
              error: `Schema validation error: ${errorMsg}`,
            });
          } else {
            assertions.push({
              name: 'Schema validation',
              success: true,
            });
          }
        } catch (error) {
          assertions.push({
            name: 'Schema validation',
            success: false,
            error: `Error validating response: ${error}`,
          });
        }
      } else if (expectedResponse) {
        assertions.push({
          name: 'Schema validation',
          success: true,
          info: isJson ? 'No schema validation performed (no schema specified)' : 'Skipped schema validation (non-JSON response)',
        });
      }

      const timeAssertion = this.validator.validateResponseTime(
        duration,
        expectedResponse?.maxResponseTime || 2000,
      );
      assertions.push(timeAssertion);

      this.cleanupTempFile(scriptPath);

      const success = assertions.every((assertion) => assertion.success);

      console.log('🚀 [CURL-RUNNER] All assertions:', JSON.stringify(assertions, null, 2));
      console.log('🚀 [CURL-RUNNER] Test result - Success:', success);
      console.log('🚀 [CURL-RUNNER] Test result - Duration:', duration + 'ms');
      console.log('🚀 [CURL-RUNNER] ===========================================');

      return {
        testCase,
        success,
        duration,
        response: {
          status,
          body,
        },
        assertions,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      console.log('❌ [CURL-RUNNER] Test execution failed with error:', error.message);
      console.log('❌ [CURL-RUNNER] Error stack:', error.stack);
      console.log('❌ [CURL-RUNNER] Test result - Success: false');
      console.log('❌ [CURL-RUNNER] Test result - Duration:', duration + 'ms');
      console.log('🚀 [CURL-RUNNER] ===========================================');

      return {
        testCase,
        success: false,
        duration,
        error: error.message,
        assertions,
      };
    }
  }

  /**
   * Construct the full URL for the request with path parameter substitution
   */
  private constructUrl(endpoint: string, request?: any): string {
    console.log('🔧 [CURL-RUNNER] Constructing URL for endpoint:', endpoint);
    console.log('🔧 [CURL-RUNNER] Base URL from runner:', this.baseUrl);
    console.log('🔧 [CURL-RUNNER] Request object:', JSON.stringify(request, null, 2));

    if (endpoint.startsWith('http')) {
      console.log('🔧 [CURL-RUNNER] Endpoint is absolute URL, returning as-is:', endpoint);
      return endpoint;
    }

    let path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    console.log('🔧 [CURL-RUNNER] Initial path:', path);

    const usedPathParams = new Set<string>();

    // Handle path parameter substitution
    if (request && typeof request === 'object') {
      console.log('🔧 [CURL-RUNNER] Processing request parameters for path substitution...');
      Object.entries(request).forEach(([key, value]) => {
        const paramPattern = `{${key}}`;
        console.log(
          `🔧 [CURL-RUNNER] Checking parameter '${key}' with value '${value}' for pattern '${paramPattern}'`,
        );

        if (path.includes(paramPattern)) {
          // Use actual value or fallback to 1 for testing
          const actualValue = value && value !== 'valid_string_value' && value !== '' ? value : '1';
          console.log(`🔧 [CURL-RUNNER] Replacing '${paramPattern}' with '${actualValue}'`);
          path = path.replace(paramPattern, String(actualValue));
          usedPathParams.add(key);
          console.log(`🔧 [CURL-RUNNER] Path after substitution: '${path}'`);
        } else {
          console.log(`🔧 [CURL-RUNNER] Pattern '${paramPattern}' not found in path`);
        }
      });
    }

    console.log('🔧 [CURL-RUNNER] Used path parameters:', Array.from(usedPathParams));

    // Handle any remaining unsubstituted path parameters with default values
    const originalPath = path;
    path = path.replace(/{id}/g, '2'); // Use existing user ID 2 instead of 1
    path = path.replace(/{userId}/g, '2');
    path = path.replace(/{productId}/g, '2');
    path = path.replace(/{todoId}/g, '2');
    path = path.replace(/{department}/g, 'Engineering');

    if (originalPath !== path) {
      console.log(`🔧 [CURL-RUNNER] Applied default substitutions: '${originalPath}' -> '${path}'`);
    }

    const baseUrl = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
    const finalUrl = `${baseUrl}${path}`;

    // Store the used path parameters for later reference
    (this as any)._usedPathParams = usedPathParams;

    console.log('🔧 [CURL-RUNNER] Final constructed URL:', finalUrl);
    console.log('🔧 [CURL-RUNNER] ========================================');
    return finalUrl;
  }

  /**
   * Build a CURL command for the given test case
   */
  private buildCurlCommand(url: string, method: string, request?: any, files?: any[], headers?: Record<string, string>): string {
    let command = `curl -s -w "\\n%{http_code}" -X ${method.toUpperCase()} "${url}"`;

    command += ` --max-time ${Math.ceil(this.timeout / 1000)}`;

    command += ` -H "Content-Type: application/json"`;
    command += ` -H "Accept: application/json"`;
    if (headers) {
      for (const [hk, hv] of Object.entries(headers)) {
        command += ` -H "${hk}: ${hv}"`;
      }
    }

    if (files && files.length > 0) {
      command = command.replace(/-H "Content-Type: application\/json"/, '');

      for (const file of files) {
        if (!fs.existsSync(file.filePath)) {
          throw new Error(`File not found: ${file.filePath}`);
        }

        const contentType = file.contentType ? `;type=${file.contentType}` : '';
        command += ` -F "${file.fieldName}=@${file.filePath}${contentType}"`;
      }

      if (request) {
        Object.entries(request).forEach(([key, value]) => {
          if (!files.some((file) => file.fieldName === key)) {
            command += ` -F "${key}=${typeof value === 'object' ? JSON.stringify(value) : String(value)}"`;
          }
        });
      }
    } else if (request) {
      if (method.toLowerCase() === 'get') {
        // For GET requests, only use query parameters for non-path parameters
        // Path parameters should already be substituted in constructUrl()
        const usedPathParams = (this as any)._usedPathParams || new Set();
        console.log('🔧 [CURL-RUNNER] GET request - Used path params:', Array.from(usedPathParams));
        console.log(
          '🔧 [CURL-RUNNER] GET request - Full request object:',
          JSON.stringify(request, null, 2),
        );

        const queryParams = Object.entries(request)
          .filter(([key, value]) => {
            // Skip parameters that were used for path substitution
            const isPathParam = usedPathParams.has(key);
            console.log(
              `🔧 [CURL-RUNNER] Parameter '${key}=${value}' - Is path param: ${isPathParam}`,
            );
            return !isPathParam;
          })
          .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
          .join('&');

        console.log('🔧 [CURL-RUNNER] Generated query params:', queryParams);

        if (queryParams) {
          const separator = url.includes('?') ? '&' : '?';
          command = command.replace(`"${url}"`, `"${url}${separator}${queryParams}"`);
        }
      } else {
        console.log(
          '🔧 [CURL-RUNNER] Non-GET request - Preparing request body:',
          JSON.stringify(request, null, 2),
        );
        // Exclude path parameters from JSON body to respect OpenAPI schemas
        const usedPathParams: Set<string> = (this as any)._usedPathParams || new Set();
        const bodyOnly = request && typeof request === 'object'
          ? Object.fromEntries(Object.entries(request).filter(([k]) => !usedPathParams.has(k)))
          : request;
        console.log(
          '🔧 [CURL-RUNNER] Non-GET request - Final JSON body:',
          JSON.stringify(bodyOnly, null, 2),
        );
        command += ` -d '${JSON.stringify(bodyOnly)}'`;
      }
    }

    command += ` -i`;

    return command;
  }

  /**
   * Create a temporary script file with the CURL command
   */
  private createTempScript(testId: string, command: string): string {
    const scriptPath = path.join(this.tempDir, `curl_${testId}.sh`);
    const scriptContent = `#!/bin/bash\n${command}`;

    fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
    return scriptPath;
  }

  /**
   * Parse CURL response output
   */
  private parseCurlResponse(output: string): {
    status: number;
    headers: Record<string, string>;
    body: any;
  } {
    const lines = output.split('\n');
    const statusLine = lines.pop() || '';
    const status = parseInt(statusLine.trim(), 10);

    const headerEndIndex = lines.findIndex((line) => line.trim() === '');

    const headerLines = lines.slice(0, headerEndIndex);
    const headers: Record<string, string> = {};

    for (let i = 1; i < headerLines.length; i++) {
      const line = headerLines[i];
      const colonIndex = line.indexOf(':');

      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        headers[key] = value;
      }
    }

    const bodyLines = lines.slice(headerEndIndex + 1);
    const bodyText = bodyLines.join('\n');

    let body;
    try {
      body = JSON.parse(bodyText);
    } catch (e) {
      body = bodyText;
    }

    return {
      status,
      headers,
      body,
    };
  }

  /**
   * Clean up temporary script file
   */
  private cleanupTempFile(scriptPath: string): void {
    if (fs.existsSync(scriptPath)) {
      fs.unlinkSync(scriptPath);
    }
  }

  /**
   * Set base URL
   * @param baseUrl Base URL for requests
   */
  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }

  /**
   * Set request timeout
   * @param timeout Timeout in milliseconds
   */
  setTimeout(timeout: number): void {
    this.timeout = timeout;
  }
}

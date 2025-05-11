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

    try {
      const { id, endpoint, method, request, files, expectedResponse } = testCase;
      const url = this.constructUrl(endpoint);

      const curlCommand = this.buildCurlCommand(url, method, request, files);

      const scriptPath = this.createTempScript(id, curlCommand);

      const { stdout, stderr } = await execPromise(`bash ${scriptPath}`, {
        timeout: this.timeout,
        maxBuffer: 10 * 1024 * 1024,
      });

      if (stderr && !stdout) {
        throw new Error(`CURL error: ${stderr}`);
      }

      const { status, headers, body } = this.parseCurlResponse(stdout);
      const duration = Date.now() - startTime;

      const statusAssertion = this.validator.validateStatusCode(
        status,
        expectedResponse?.status || 200,
      );
      assertions.push(statusAssertion);

      if (expectedResponse?.schema && body) {
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
          info: 'No schema validation performed (no schema specified)',
        });
      }

      const timeAssertion = this.validator.validateResponseTime(
        duration,
        expectedResponse?.maxResponseTime || 2000,
      );
      assertions.push(timeAssertion);

      this.cleanupTempFile(scriptPath);

      const success = assertions.every((assertion) => assertion.success);

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
   * Construct the full URL for the request
   */
  private constructUrl(endpoint: string): string {
    if (endpoint.startsWith('http')) {
      return endpoint;
    }

    const baseUrl = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    return `${baseUrl}${path}`;
  }

  /**
   * Build a CURL command for the given test case
   */
  private buildCurlCommand(url: string, method: string, request?: any, files?: any[]): string {
    let command = `curl -s -w "\\n%{http_code}" -X ${method.toUpperCase()} "${url}"`;

    command += ` --max-time ${Math.ceil(this.timeout / 1000)}`;

    command += ` -H "Content-Type: application/json"`;
    command += ` -H "Accept: application/json"`;

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
        const queryParams = Object.entries(request)
          .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
          .join('&');

        if (queryParams) {
          const separator = url.includes('?') ? '&' : '?';
          command = command.replace(`"${url}"`, `"${url}${separator}${queryParams}"`);
        }
      } else {
        command += ` -d '${JSON.stringify(request)}'`;
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

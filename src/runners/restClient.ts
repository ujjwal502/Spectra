import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { TestCase, TestResult, AssertionResult } from '../types';
import { ResponseValidator } from '../validators/responseValidator';
import * as fs from 'fs';
import FormData from 'form-data';

export class RestClient {
  private axios: AxiosInstance;
  private validator: ResponseValidator;

  constructor(baseUrl: string = '', headers: Record<string, string> = {}) {
    this.axios = axios.create({
      baseURL: baseUrl,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      timeout: 30000,
    });

    this.validator = new ResponseValidator();
  }

  /**
   * Execute a test case
   * @param testCase Test case to execute
   * @returns Test result
   */
  async executeTest(testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now();
    let response: AxiosResponse;
    const assertions: AssertionResult[] = [];

    try {
      const { endpoint, method, request, files } = testCase;

      const config: AxiosRequestConfig = {
        method,
        url: endpoint,
      };

      if (files && files.length > 0) {
        const formData = new FormData();

        for (const file of files) {
          if (!fs.existsSync(file.filePath)) {
            throw new Error(`File not found: ${file.filePath}`);
          }

          const fileStream = fs.createReadStream(file.filePath);
          formData.append(file.fieldName, fileStream, {
            filename: file.fileName || file.filePath.split('/').pop(),
            contentType: file.contentType,
          });
        }

        if (request) {
          Object.entries(request).forEach(([key, value]) => {
            if (!files.some((file) => file.fieldName === key)) {
              formData.append(
                key,
                typeof value === 'object' ? JSON.stringify(value) : String(value),
              );
            }
          });
        }

        config.data = formData;

        config.headers = {
          ...config.headers,
          ...formData.getHeaders(),
        };
      } else if (request) {
        if (method.toLowerCase() === 'get') {
          config.params = request;
        } else {
          config.data = request;
        }
      }

      response = await this.axios.request(config);

      const duration = Date.now() - startTime;

      const statusAssertion = this.validator.validateStatusCode(
        response.status,
        testCase.expectedResponse?.status || 200,
      );
      assertions.push(statusAssertion);

      if (testCase.expectedResponse?.schema) {
        const schemaAssertion = this.validator.validateAgainstSchema(
          response.data,
          testCase.expectedResponse.schema,
        );
        assertions.push(schemaAssertion);
      }

      const timeAssertion = this.validator.validateResponseTime(
        duration,
        testCase.expectedResponse?.maxResponseTime || 2000,
      );
      assertions.push(timeAssertion);

      const success = assertions.every((assertion) => assertion.success);

      return {
        testCase,
        success,
        duration,
        response: response.data,
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
   * Set request timeout
   * @param timeout Timeout in milliseconds
   */
  setTimeout(timeout: number): void {
    this.axios.defaults.timeout = timeout;
  }

  /**
   * Set base URL
   * @param baseUrl Base URL for requests
   */
  setBaseUrl(baseUrl: string): void {
    this.axios.defaults.baseURL = baseUrl;
  }

  /**
   * Set default headers
   * @param headers Headers to set
   */
  setHeaders(headers: Record<string, string>): void {
    Object.entries(headers).forEach(([key, value]) => {
      this.axios.defaults.headers.common[key] = value;
    });
  }
}

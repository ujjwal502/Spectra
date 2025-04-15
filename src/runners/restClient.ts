import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { TestCase, TestResult, AssertionResult } from '../types';
import { ResponseValidator } from '../validators/responseValidator';

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
      // Extract endpoint and parameters
      const { endpoint, method, request } = testCase;

      // Build request config
      const config: AxiosRequestConfig = {
        method,
        url: endpoint,
      };

      // Add request data if available
      if (request) {
        if (method.toLowerCase() === 'get') {
          config.params = request;
        } else {
          config.data = request;
        }
      }

      // Execute request
      response = await this.axios.request(config);

      // Calculate duration
      const duration = Date.now() - startTime;

      // Validate status code
      const statusAssertion = this.validator.validateStatusCode(
        response.status,
        testCase.expectedResponse?.status || 200,
      );
      assertions.push(statusAssertion);

      // Validate schema if expected response schema exists
      if (testCase.expectedResponse?.schema) {
        const schemaAssertion = this.validator.validateAgainstSchema(
          response.data,
          testCase.expectedResponse.schema,
        );
        assertions.push(schemaAssertion);
      }

      // Validate response time (assumes 2000ms max by default)
      const timeAssertion = this.validator.validateResponseTime(
        duration,
        testCase.expectedResponse?.maxResponseTime || 2000,
      );
      assertions.push(timeAssertion);

      // Determine overall success
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

      // Handle the error and create a test result
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

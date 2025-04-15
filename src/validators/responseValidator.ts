import Ajv from 'ajv';
import { AssertionResult } from '../types';

export class ResponseValidator {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
    });
  }

  /**
   * Validate response against schema
   * @param response API response
   * @param schema JSON schema for validation
   * @returns Validation result
   */
  validateAgainstSchema(response: any, schema: any): AssertionResult {
    try {
      const validate = this.ajv.compile(schema);
      const valid = validate(response);

      if (valid) {
        return {
          name: 'Schema validation',
          success: true,
        };
      } else {
        return {
          name: 'Schema validation',
          success: false,
          error: this.formatValidationErrors(validate.errors || []),
        };
      }
    } catch (error) {
      return {
        name: 'Schema validation',
        success: false,
        error: `Schema validation error: ${error}`,
      };
    }
  }

  /**
   * Validate response status code
   * @param actualStatus Actual status code
   * @param expectedStatus Expected status code
   * @returns Validation result
   */
  validateStatusCode(actualStatus: number, expectedStatus: number): AssertionResult {
    return {
      name: 'Status code validation',
      success: actualStatus === expectedStatus,
      error:
        actualStatus !== expectedStatus
          ? `Expected status code ${expectedStatus}, got ${actualStatus}`
          : undefined,
    };
  }

  /**
   * Validate response headers
   * @param actualHeaders Actual response headers
   * @param expectedHeaders Expected response headers
   * @returns Validation result
   */
  validateHeaders(
    actualHeaders: Record<string, string>,
    expectedHeaders: Record<string, string>,
  ): AssertionResult {
    const errors: string[] = [];

    for (const [key, value] of Object.entries(expectedHeaders)) {
      const headerKey = Object.keys(actualHeaders).find(
        (k) => k.toLowerCase() === key.toLowerCase(),
      );

      if (!headerKey) {
        errors.push(`Missing header: ${key}`);
      } else if (actualHeaders[headerKey] !== value) {
        errors.push(`Header ${key} has value "${actualHeaders[headerKey]}", expected "${value}"`);
      }
    }

    return {
      name: 'Headers validation',
      success: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  }

  /**
   * Validate response time
   * @param responseTime Response time in milliseconds
   * @param maxResponseTime Maximum allowed response time
   * @returns Validation result
   */
  validateResponseTime(responseTime: number, maxResponseTime: number): AssertionResult {
    return {
      name: 'Response time validation',
      success: responseTime <= maxResponseTime,
      error:
        responseTime > maxResponseTime
          ? `Response time ${responseTime}ms exceeds maximum ${maxResponseTime}ms`
          : undefined,
    };
  }

  /**
   * Format validation errors from AJV
   * @param errors AJV validation errors
   * @returns Formatted error string
   */
  private formatValidationErrors(errors: any[]): string {
    return errors
      .map((err) => {
        const path = err.instancePath || '';
        return `${path} ${err.message}`;
      })
      .join('; ');
  }
}

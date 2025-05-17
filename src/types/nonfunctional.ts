/**
 * Types for non-functional testing in Spectra
 */

import { TestCase, TestResult } from './index';

/**
 * Types of non-functional tests supported by Spectra
 */
export enum NonFunctionalTestType {
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  RELIABILITY = 'reliability',
  LOAD = 'load',
}

/**
 * Base interface for all non-functional test configurations
 */
export interface NonFunctionalTestConfig {
  type: NonFunctionalTestType;
  enabled: boolean;
  description?: string;
}

/**
 * Performance test configuration
 */
export interface PerformanceTestConfig extends NonFunctionalTestConfig {
  type: NonFunctionalTestType.PERFORMANCE;

  /**
   * Maximum acceptable response time in milliseconds
   */
  maxResponseTime: number;

  /**
   * Number of repetitions to run for averaging response time
   */
  repetitions: number;

  /**
   * Delay between repetitions in milliseconds
   */
  delay?: number;
}

/**
 * Security test configuration
 */
export interface SecurityTestConfig extends NonFunctionalTestConfig {
  type: NonFunctionalTestType.SECURITY;

  /**
   * Enable testing for SQL injection vulnerabilities
   */
  sqlInjection?: boolean;

  /**
   * Enable testing for XSS vulnerabilities
   */
  xss?: boolean;

  /**
   * Enable testing for insecure headers
   */
  headers?: boolean;

  /**
   * How strict should the security tests be (true for production standards, false for development)
   */
  strictSecurity?: boolean;

  /**
   * Custom security payloads to inject
   */
  customPayloads?: Record<string, string[]>;
}

/**
 * Reliability test configuration
 */
export interface ReliabilityTestConfig extends NonFunctionalTestConfig {
  type: NonFunctionalTestType.RELIABILITY;

  /**
   * Number of times to execute the request to test reliability
   */
  executions: number;

  /**
   * Minimum acceptable success rate (0-1)
   */
  minSuccessRate: number;
}

/**
 * Load test configuration
 */
export interface LoadTestConfig extends NonFunctionalTestConfig {
  type: NonFunctionalTestType.LOAD;

  /**
   * Number of virtual users
   */
  users: number;

  /**
   * Duration of load test in seconds
   */
  duration: number;

  /**
   * Maximum acceptable response time under load in milliseconds
   */
  maxResponseTime: number;

  /**
   * Minimum acceptable requests per second
   */
  minRPS?: number;
}

/**
 * Union type for all non-functional test configurations
 */
export type NonFunctionalConfig =
  | PerformanceTestConfig
  | SecurityTestConfig
  | ReliabilityTestConfig
  | LoadTestConfig;

/**
 * Enhanced TestCase with non-functional testing configurations
 */
export interface EnhancedTestCase extends TestCase {
  nonFunctionalTests?: NonFunctionalConfig[];
}

/**
 * Result of a non-functional test
 */
export interface NonFunctionalTestResult {
  type: NonFunctionalTestType;
  success: boolean;
  metrics: Record<string, any>;
  details?: string;
  error?: string;
}

/**
 * Enhanced TestResult with non-functional test results
 */
export interface EnhancedTestResult extends TestResult {
  nonFunctionalResults?: NonFunctionalTestResult[];
}

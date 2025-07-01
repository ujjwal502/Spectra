import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { TestCase, TestResult } from '../types';
import {
  NonFunctionalTestType,
  NonFunctionalConfig,
  PerformanceTestConfig,
  SecurityTestConfig,
  ReliabilityTestConfig,
  LoadTestConfig,
  NonFunctionalTestResult,
  EnhancedTestCase,
  EnhancedTestResult,
} from '../types/nonfunctional';
import { CurlRunner } from './curlRunner';

const execPromise = promisify(exec);

/**
 * Runner for executing non-functional tests (performance, security, etc.)
 */
export class NonFunctionalRunner {
  private curlRunner: CurlRunner;
  private tempDir: string;
  private baseUrl: string;
  private timeout: number = 60000; // Longer timeout for non-functional tests

  constructor(baseUrl: string = '') {
    this.curlRunner = new CurlRunner(baseUrl);
    this.baseUrl = baseUrl;
    this.tempDir = path.join(process.cwd(), 'temp', 'nonfunctional');

    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Execute all configured non-functional tests for a test case
   * @param testCase Test case with non-functional test configurations
   * @returns Enhanced test result with non-functional test results
   */
  async executeNonFunctionalTests(testCase: EnhancedTestCase): Promise<EnhancedTestResult> {
    // First, run the regular functional test
    const functionalResult = await this.curlRunner.executeTest(testCase);

    // Initialize the enhanced result
    const enhancedResult: EnhancedTestResult = {
      ...functionalResult,
      nonFunctionalResults: [],
    };

    // If no non-functional tests are defined, return just the functional result
    if (!testCase.nonFunctionalTests || testCase.nonFunctionalTests.length === 0) {
      return enhancedResult;
    }

    // Execute each configured non-functional test
    for (const config of testCase.nonFunctionalTests) {
      if (!config.enabled) continue;

      let result: NonFunctionalTestResult;

      try {
        switch (config.type) {
          case NonFunctionalTestType.PERFORMANCE:
            result = await this.runPerformanceTest(testCase, config as PerformanceTestConfig);
            break;
          case NonFunctionalTestType.SECURITY:
            result = await this.runSecurityTest(testCase, config as SecurityTestConfig);
            break;
          case NonFunctionalTestType.RELIABILITY:
            result = await this.runReliabilityTest(testCase, config as ReliabilityTestConfig);
            break;
          case NonFunctionalTestType.LOAD:
            result = await this.runLoadTest(testCase, config as LoadTestConfig);
            break;
          default:
            // Handle unknown test type with type assertion
            const unknownConfig = config as { type: string };
            result = {
              type: unknownConfig.type as NonFunctionalTestType,
              success: false,
              metrics: {},
              error: `Unknown non-functional test type: ${unknownConfig.type}`,
            };
        }
      } catch (error: any) {
        result = {
          type: config.type,
          success: false,
          metrics: {},
          error: `Error executing ${config.type} test: ${error.message}`,
        };
      }

      enhancedResult.nonFunctionalResults?.push(result);

      // If any non-functional test fails, mark the overall test as failed
      if (!result.success) {
        enhancedResult.success = false;
        enhancedResult.error = enhancedResult.error || `Non-functional test failed: ${result.type}`;
      }
    }

    return enhancedResult;
  }

  /**
   * Run performance tests
   * @param testCase Test case
   * @param config Performance test configuration
   * @returns Performance test result
   */
  private async runPerformanceTest(
    testCase: TestCase,
    config: PerformanceTestConfig,
  ): Promise<NonFunctionalTestResult> {
    console.log(
      `Running performance test for ${testCase.method.toUpperCase()} ${testCase.endpoint}`,
    );

    const responseTimes: number[] = [];
    const startTime = Date.now();

    // Run the test multiple times to get average response time
    for (let i = 0; i < config.repetitions; i++) {
      const result = await this.curlRunner.executeTest(testCase);
      responseTimes.push(result.duration);

      // Add delay between requests if specified
      if (config.delay && i < config.repetitions - 1) {
        await new Promise((resolve) => setTimeout(resolve, config.delay));
      }
    }

    const totalDuration = Date.now() - startTime;
    const avgResponseTime =
      responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);

    // Calculate standard deviation
    const variance =
      responseTimes.reduce((sum, time) => sum + Math.pow(time - avgResponseTime, 2), 0) /
      responseTimes.length;
    const stdDeviation = Math.sqrt(variance);

    const success = avgResponseTime <= config.maxResponseTime;

    return {
      type: NonFunctionalTestType.PERFORMANCE,
      success,
      metrics: {
        avgResponseTime,
        minResponseTime,
        maxResponseTime,
        stdDeviation,
        totalDuration,
        samples: responseTimes.length,
      },
      details: success
        ? `Average response time (${avgResponseTime.toFixed(2)}ms) is within acceptable limit (${config.maxResponseTime}ms)`
        : `Average response time (${avgResponseTime.toFixed(2)}ms) exceeds acceptable limit (${config.maxResponseTime}ms)`,
    };
  }

  /**
   * Run security tests
   * @param testCase Test case
   * @param config Security test configuration
   * @returns Security test result
   */
  private async runSecurityTest(
    testCase: TestCase,
    config: SecurityTestConfig,
  ): Promise<NonFunctionalTestResult> {
    console.log(`Running security test for ${testCase.method.toUpperCase()} ${testCase.endpoint}`);

    const securityIssues: string[] = [];
    const testResults: Record<string, boolean> = {};

    // Test for SQL injection if enabled
    if (config.sqlInjection) {
      const sqlInjectionResult = await this.testSqlInjection(testCase);
      testResults.sqlInjection = sqlInjectionResult.success;
      if (!sqlInjectionResult.success) {
        securityIssues.push(sqlInjectionResult.details || 'SQL Injection vulnerability detected');
      }
    }

    // Test for XSS if enabled
    if (config.xss) {
      const xssResult = await this.testXss(testCase);
      testResults.xss = xssResult.success;
      if (!xssResult.success) {
        securityIssues.push(xssResult.details || 'XSS vulnerability detected');
      }
    }

    // Test for insecure headers if enabled
    if (config.headers) {
      const headersResult = await this.testSecurityHeaders(testCase, config);
      testResults.headers = headersResult.success;
      if (!headersResult.success) {
        securityIssues.push(headersResult.details || 'Insecure headers detected');
      }
    }

    // Test custom security payloads if provided
    if (config.customPayloads) {
      const customResult = await this.testCustomPayloads(testCase, config.customPayloads);
      testResults.customPayloads = customResult.success;
      if (!customResult.success) {
        securityIssues.push(customResult.details || 'Custom security test failed');
      }
    }

    const success = securityIssues.length === 0;

    return {
      type: NonFunctionalTestType.SECURITY,
      success,
      metrics: { testResults },
      details: success
        ? 'No security issues detected'
        : `Security issues detected: ${securityIssues.join('; ')}`,
    };
  }

  /**
   * Run reliability tests
   * @param testCase Test case
   * @param config Reliability test configuration
   * @returns Reliability test result
   */
  private async runReliabilityTest(
    testCase: TestCase,
    config: ReliabilityTestConfig,
  ): Promise<NonFunctionalTestResult> {
    console.log(
      `Running reliability test for ${testCase.method.toUpperCase()} ${testCase.endpoint}`,
    );

    let successCount = 0;
    const startTime = Date.now();
    const errors: string[] = [];

    // Run the test multiple times to check reliability
    for (let i = 0; i < config.executions; i++) {
      try {
        const result = await this.curlRunner.executeTest(testCase);
        if (result.success) {
          successCount++;
        } else if (result.error) {
          errors.push(`Execution ${i + 1}: ${result.error}`);
        }
      } catch (error: any) {
        errors.push(`Execution ${i + 1}: ${error.message}`);
      }
    }

    const totalDuration = Date.now() - startTime;
    const successRate = successCount / config.executions;

    const success = successRate >= config.minSuccessRate;

    return {
      type: NonFunctionalTestType.RELIABILITY,
      success,
      metrics: {
        successRate,
        successCount,
        totalExecutions: config.executions,
        totalDuration,
        errors: errors.length,
      },
      details: success
        ? `Success rate (${(successRate * 100).toFixed(2)}%) meets minimum requirement (${(config.minSuccessRate * 100).toFixed(2)}%)`
        : `Success rate (${(successRate * 100).toFixed(2)}%) below minimum requirement (${(config.minSuccessRate * 100).toFixed(2)}%)`,
    };
  }

  /**
   * Run load tests
   * @param testCase Test case
   * @param config Load test configuration
   * @returns Load test result
   */
  private async runLoadTest(
    testCase: TestCase,
    config: LoadTestConfig,
  ): Promise<NonFunctionalTestResult> {
    console.log(`Running load test for ${testCase.method.toUpperCase()} ${testCase.endpoint}`);

    // Create a temporary load test script
    const scriptId = `load_${testCase.id}_${Date.now()}`;
    const scriptPath = await this.createLoadTestScript(scriptId, testCase, config);

    try {
      // Execute the load test script
      const { stdout, stderr } = await execPromise(`bash ${scriptPath}`, {
        timeout: (config.duration + 30) * 1000, // Add 30 seconds buffer
        maxBuffer: 10 * 1024 * 1024,
      });

      if (stderr && !stdout) {
        throw new Error(`Load test error: ${stderr}`);
      }

      // Parse the results
      const results = this.parseLoadTestResults(stdout);

      const avgResponseTime = results.avgResponseTime || 0;
      const rps = results.requestsPerSecond || 0;

      const responseTimeSuccess = avgResponseTime <= config.maxResponseTime;
      const rpsSuccess = config.minRPS ? rps >= config.minRPS : true;

      const success = responseTimeSuccess && rpsSuccess;

      return {
        type: NonFunctionalTestType.LOAD,
        success,
        metrics: {
          ...results,
          users: config.users,
          duration: config.duration,
        },
        details: success
          ? `Load test successful: Avg response time ${avgResponseTime.toFixed(2)}ms, ${rps.toFixed(2)} req/sec`
          : `Load test failed: ${!responseTimeSuccess ? `Response time (${avgResponseTime.toFixed(2)}ms) exceeds limit (${config.maxResponseTime}ms)` : ''}${!rpsSuccess && config.minRPS ? ` RPS (${rps.toFixed(2)}) below minimum (${config.minRPS})` : ''}`,
      };
    } finally {
      // Clean up the script file
      this.cleanupTempFile(scriptPath);
    }
  }

  /**
   * Test for SQL injection vulnerabilities
   */
  private async testSqlInjection(
    testCase: TestCase,
  ): Promise<{ success: boolean; details?: string }> {
    const sqlPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "1'; SELECT * FROM users; --",
      '1 UNION SELECT username, password FROM users',
    ];

    // Create a copy of the test case for security testing
    const securityTestCase = { ...testCase };

    // Apply SQL injection payloads to different parts of the request
    for (const payload of sqlPayloads) {
      // Test query parameters
      if (securityTestCase.method.toLowerCase() === 'get') {
        securityTestCase.request = { ...securityTestCase.request, param: payload };
        const result = await this.curlRunner.executeTest(securityTestCase);

        // Check for signs of SQL injection vulnerability
        if (result.response && this.checkForSqlInjectionSuccess(result.response.body)) {
          return {
            success: false,
            details: `SQL Injection vulnerability detected with payload: ${payload}`,
          };
        }
      }
      // Test request body fields for POST/PUT/PATCH
      else if (
        ['post', 'put', 'patch'].includes(securityTestCase.method.toLowerCase()) &&
        securityTestCase.request
      ) {
        // Try payload in each field of the request body
        for (const key of Object.keys(securityTestCase.request)) {
          const originalValue = securityTestCase.request[key];
          securityTestCase.request[key] = payload;

          const result = await this.curlRunner.executeTest(securityTestCase);

          // Check for signs of SQL injection vulnerability
          if (result.response && this.checkForSqlInjectionSuccess(result.response.body)) {
            return {
              success: false,
              details: `SQL Injection vulnerability detected in field "${key}" with payload: ${payload}`,
            };
          }

          // Restore original value
          securityTestCase.request[key] = originalValue;
        }
      }
    }

    return { success: true };
  }

  /**
   * Test for XSS vulnerabilities
   */
  private async testXss(testCase: TestCase): Promise<{ success: boolean; details?: string }> {
    const xssPayloads = [
      "<script>alert('XSS')</script>",
      "<img src=x onerror=alert('XSS')>",
      "<svg onload=alert('XSS')>",
      "javascript:alert('XSS')",
    ];

    // Create a copy of the test case for security testing
    const securityTestCase = { ...testCase };

    // Apply XSS payloads to different parts of the request
    for (const payload of xssPayloads) {
      // Test query parameters
      if (securityTestCase.method.toLowerCase() === 'get') {
        securityTestCase.request = { ...securityTestCase.request, param: payload };
        const result = await this.curlRunner.executeTest(securityTestCase);

        // Check if the payload is reflected in the response
        if (result.response && this.checkForXssReflection(result.response.body, payload)) {
          return {
            success: false,
            details: `Potential XSS vulnerability detected with payload: ${payload}`,
          };
        }
      }
      // Test request body fields for POST/PUT/PATCH
      else if (
        ['post', 'put', 'patch'].includes(securityTestCase.method.toLowerCase()) &&
        securityTestCase.request
      ) {
        // Try payload in each field of the request body
        for (const key of Object.keys(securityTestCase.request)) {
          const originalValue = securityTestCase.request[key];
          securityTestCase.request[key] = payload;

          const result = await this.curlRunner.executeTest(securityTestCase);

          // Check if the payload is reflected in the response
          if (result.response && this.checkForXssReflection(result.response.body, payload)) {
            return {
              success: false,
              details: `Potential XSS vulnerability detected in field "${key}" with payload: ${payload}`,
            };
          }

          // Restore original value
          securityTestCase.request[key] = originalValue;
        }
      }
    }

    return { success: true };
  }

  /**
   * Test for security headers
   */
  private async testSecurityHeaders(
    testCase: TestCase,
    config?: SecurityTestConfig,
  ): Promise<{ success: boolean; details?: string }> {
    // Create a copy of the test case
    const securityTestCase = { ...testCase };

    // Execute the test case to check headers
    const result = await this.curlRunner.executeTest(securityTestCase);

    if (!result.response) {
      return { success: false, details: 'Failed to get response headers' };
    }

    // Only check critical security headers in non-strict mode
    const securityHeaders = config?.strictSecurity
      ? [
          'X-Content-Type-Options',
          'X-Frame-Options',
          'Content-Security-Policy',
          'Strict-Transport-Security',
          'X-XSS-Protection',
        ]
      : [
          // Only check for critical headers in non-strict mode
          'X-Content-Type-Options',
        ];

    const missingHeaders: string[] = [];

    for (const header of securityHeaders) {
      // Check for headers in a case-insensitive way
      const headerExists = Object.keys(result.response.headers || {}).some(
        (h) => h.toLowerCase() === header.toLowerCase(),
      );

      if (!headerExists) {
        missingHeaders.push(header);
      }
    }

    if (missingHeaders.length > 0) {
      return {
        success: false,
        details: `Missing security headers: ${missingHeaders.join(', ')}`,
      };
    }

    return { success: true };
  }

  /**
   * Test custom security payloads
   */
  private async testCustomPayloads(
    testCase: TestCase,
    customPayloads: Record<string, string[]>,
  ): Promise<{ success: boolean; details?: string }> {
    // Create a copy of the test case
    const securityTestCase = { ...testCase };

    for (const [field, payloads] of Object.entries(customPayloads)) {
      for (const payload of payloads) {
        // Apply payload to the specified field
        if (securityTestCase.request) {
          const originalValue = securityTestCase.request[field];
          securityTestCase.request[field] = payload;

          const result = await this.curlRunner.executeTest(securityTestCase);

          // Simple check: if the request succeeds with a suspicious payload, it might be vulnerable
          if (result.success) {
            return {
              success: false,
              details: `Potential security issue: API accepted suspicious payload "${payload}" in field "${field}"`,
            };
          }

          // Restore original value
          securityTestCase.request[field] = originalValue;
        }
      }
    }

    return { success: true };
  }

  /**
   * Check response for signs of SQL injection vulnerability
   */
  private checkForSqlInjectionSuccess(responseBody: any): boolean {
    if (!responseBody) return false;

    const responseStr =
      typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);

    // Look for signs of successful SQL injection
    const sqlErrorPatterns = [
      'SQLSTATE',
      'ORA-',
      'MySQL',
      'syntax error',
      'SQL syntax',
      'driver error',
      'Incorrect syntax',
      'Warning: mysql_',
      'Warning: pg_',
      'Warning: SQLite3',
      'database error',
      'unclosed quotation mark',
      'You have an error in your SQL syntax',
    ];

    return sqlErrorPatterns.some((pattern) =>
      responseStr.toLowerCase().includes(pattern.toLowerCase()),
    );
  }

  /**
   * Check if XSS payload is reflected in the response
   */
  private checkForXssReflection(responseBody: any, payload: string): boolean {
    if (!responseBody) return false;

    const responseStr =
      typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);

    // Check if the payload appears in the response
    return responseStr.includes(payload);
  }

  /**
   * Create a script for load testing
   */
  private async createLoadTestScript(
    scriptId: string,
    testCase: TestCase,
    config: LoadTestConfig,
  ): Promise<string> {
    const { endpoint, method, request } = testCase;
    const url = this.constructUrl(endpoint);

    // Create a simple load testing script using curl
    let scriptContent = `#!/bin/bash\n\n`;
    scriptContent += `# Load test script for ${method.toUpperCase()} ${endpoint}\n`;
    scriptContent += `echo "Starting load test: ${config.users} users for ${config.duration} seconds"\n\n`;

    // Build the curl command
    let curlCmd = `curl -s -w "%{time_total}\\n" -X ${method.toUpperCase()} "${url}"`;

    if (request && method.toLowerCase() !== 'get') {
      curlCmd += ` -H "Content-Type: application/json" -d '${JSON.stringify(request)}'`;
    }

    // Create wrapper script for concurrent requests
    scriptContent += `start_time=$(date +%s.%N)\n\n`;
    scriptContent += `# Run curl commands in parallel\n`;
    scriptContent += `declare -a pids\n`;
    scriptContent += `declare -a times\n\n`;

    scriptContent += `# Function to run one user's requests\n`;
    scriptContent += `function run_user() {\n`;
    scriptContent += `  local user_id=$1\n`;
    scriptContent += `  local duration=$2\n`;
    scriptContent += `  local start_time=$(date +%s)\n`;
    scriptContent += `  local end_time=$((start_time + duration))\n`;
    scriptContent += `  local request_count=0\n`;
    scriptContent += `  local total_time=0\n\n`;

    scriptContent += `  while [ $(date +%s) -lt $end_time ]; do\n`;
    scriptContent += `    local time=$(${curlCmd} 2>/dev/null)\n`;
    scriptContent += `    if [ $? -eq 0 ] && [ ! -z "$time" ]; then\n`;
    scriptContent += `      request_count=$((request_count + 1))\n`;
    scriptContent += `      total_time=$(echo "$total_time + $time" | bc)\n`;
    scriptContent += `    fi\n`;
    scriptContent += `  done\n\n`;

    scriptContent += `  echo "$user_id,$request_count,$total_time"\n`;
    scriptContent += `}\n\n`;

    scriptContent += `# Start all users\n`;
    scriptContent += `for i in $(seq 1 ${config.users}); do\n`;
    scriptContent += `  run_user $i ${config.duration} > "user_$i.txt" &\n`;
    scriptContent += `  pids[$i]=$!\n`;
    scriptContent += `done\n\n`;

    scriptContent += `# Wait for all users to complete\n`;
    scriptContent += `for pid in \${pids[@]}; do\n`;
    scriptContent += `  wait $pid\n`;
    scriptContent += `done\n\n`;

    scriptContent += `# Collect results\n`;
    scriptContent += `total_requests=0\n`;
    scriptContent += `total_time=0\n`;
    scriptContent += `for i in $(seq 1 ${config.users}); do\n`;
    scriptContent += `  user_data=$(cat "user_$i.txt")\n`;
    scriptContent += `  user_id=$(echo $user_data | cut -d ',' -f 1)\n`;
    scriptContent += `  user_requests=$(echo $user_data | cut -d ',' -f 2)\n`;
    scriptContent += `  user_time=$(echo $user_data | cut -d ',' -f 3)\n`;
    scriptContent += `  total_requests=$((total_requests + user_requests))\n`;
    scriptContent += `  total_time=$(echo "$total_time + $user_time" | bc)\n`;
    scriptContent += `  rm "user_$i.txt"\n`;
    scriptContent += `done\n\n`;

    scriptContent += `end_time=$(date +%s.%N)\n`;
    scriptContent += `duration=$(echo "$end_time - $start_time" | bc)\n\n`;

    scriptContent += `# Calculate metrics\n`;
    scriptContent += `echo "LOADTEST_TOTAL_REQUESTS:$total_requests"\n`;
    scriptContent += `echo "LOADTEST_DURATION:$duration"\n`;
    scriptContent += `echo "LOADTEST_RPS:$(echo "scale=2; $total_requests / $duration" | bc)"\n`;

    scriptContent += `if [ $total_requests -gt 0 ]; then\n`;
    scriptContent += `  avg_time=$(echo "scale=2; ($total_time / $total_requests) * 1000" | bc) # Convert to ms\n`;
    scriptContent += `  echo "LOADTEST_AVG_RESPONSE_TIME:$avg_time"\n`;
    scriptContent += `else\n`;
    scriptContent += `  echo "LOADTEST_AVG_RESPONSE_TIME:0"\n`;
    scriptContent += `fi\n`;

    // Save the script
    const scriptPath = path.join(this.tempDir, `${scriptId}.sh`);
    fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });

    return scriptPath;
  }

  /**
   * Parse load test results from script output
   */
  private parseLoadTestResults(output: string): Record<string, number> {
    const results: Record<string, number> = {};

    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('LOADTEST_')) {
        const [key, value] = line.split(':');
        const normalizedKey = key
          .replace('LOADTEST_', '')
          .toLowerCase()
          .split('_')
          .map((word, index) => (index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
          .join('');

        results[normalizedKey] = parseFloat(value);
      }
    }

    return results;
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
   * Clean up temporary file
   */
  private cleanupTempFile(filePath: string): void {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /**
   * Set base URL
   * @param baseUrl Base URL for requests
   */
  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
    this.curlRunner.setBaseUrl(baseUrl);
  }

  /**
   * Set request timeout
   * @param timeout Timeout in milliseconds
   */
  setTimeout(timeout: number): void {
    this.timeout = timeout;
    this.curlRunner.setTimeout(timeout);
  }
}

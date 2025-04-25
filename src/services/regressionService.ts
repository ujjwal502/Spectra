import fs from 'fs';
import path from 'path';
import {
  TestResult,
  RegressionResult,
  ResponseDiff,
  AssertionDiff,
  RegressionSummary,
} from '../types';

/**
 * Service responsible for regression testing - comparing current test results
 * against a known baseline to detect unexpected changes
 */
export class RegressionService {
  /**
   * Saves test results as a baseline for future regression testing
   * @param results Test results to save as baseline
   * @param baselinePath Path to save the baseline file
   */
  saveBaseline(results: Map<string, TestResult>, baselinePath: string): void {
    const resultsArray = Array.from(results.entries()).map(([id, result]) => ({
      id,
      ...result,
    }));

    // Ensure directory exists
    const dir = path.dirname(baselinePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(baselinePath, JSON.stringify(resultsArray, null, 2), 'utf8');
    console.log(`✅ Regression baseline saved to ${baselinePath}`);
  }

  /**
   * Loads baseline results from file
   * @param baselinePath Path to baseline file
   * @returns Map of baseline test results or null if file doesn't exist
   */
  loadBaseline(baselinePath: string): Map<string, TestResult> | null {
    try {
      if (!fs.existsSync(baselinePath)) {
        return null;
      }

      const jsonContent = fs.readFileSync(baselinePath, 'utf8');
      const resultsArray = JSON.parse(jsonContent);

      const resultsMap = new Map<string, TestResult>();
      resultsArray.forEach((result: any) => {
        const { id, ...testResult } = result;
        resultsMap.set(id, testResult as TestResult);
      });

      return resultsMap;
    } catch (error) {
      console.error(`Error loading baseline from ${baselinePath}:`, error);
      return null;
    }
  }

  /**
   * Compare current test results against baseline to find regressions
   * @param baselineResults Baseline test results
   * @param currentResults Current test results
   * @returns Regression summary with detailed analysis
   */
  compareResults(
    baselineResults: Map<string, TestResult>,
    currentResults: Map<string, TestResult>,
  ): RegressionSummary {
    const regressionDetails: RegressionResult[] = [];
    let newTests = 0;
    let removedTests = 0;
    let regressedTests = 0;
    let improvedTests = 0;
    let unchangedTests = 0;

    // Create maps to match tests by endpoint+method instead of just ID
    const baselineEndpointMethodMap = new Map<string, string>(); // Maps endpoint+method to ID
    const currentEndpointMethodMap = new Map<string, string>(); // Maps endpoint+method to ID
    const processedEndpointMethods = new Set<string>();

    // Build endpoint+method to ID maps
    for (const [id, result] of baselineResults.entries()) {
      const endpointMethod = `${result.testCase.method.toLowerCase()}:${result.testCase.endpoint}`;
      baselineEndpointMethodMap.set(endpointMethod, id);
    }

    for (const [id, result] of currentResults.entries()) {
      const endpointMethod = `${result.testCase.method.toLowerCase()}:${result.testCase.endpoint}`;
      currentEndpointMethodMap.set(endpointMethod, id);
    }

    // Process all current tests
    for (const [currentId, currentResult] of currentResults.entries()) {
      const currentEndpointMethod = `${currentResult.testCase.method.toLowerCase()}:${currentResult.testCase.endpoint}`;
      processedEndpointMethods.add(currentEndpointMethod);

      // Find matching test in baseline by endpoint+method
      const baselineId = baselineEndpointMethodMap.get(currentEndpointMethod);

      if (!baselineId) {
        // New test that didn't exist in baseline
        newTests++;
        regressionDetails.push({
          id: currentId,
          endpoint: currentResult.testCase.endpoint,
          method: currentResult.testCase.method,
          baselineSuccess: false,
          currentSuccess: currentResult.success,
          statusCodeChanged: false,
          responseChanged: false,
          assertionsChanged: false,
          isRegression: false,
        });
        continue;
      }

      // The test exists in both baseline and current results
      const baselineResult = baselineResults.get(baselineId);
      if (!baselineResult) {
        console.error(`Error: Found baselineId ${baselineId} in map but not in results`);
        continue;
      }

      // Compare the matched tests
      const regressionResult = this.compareTestResults(currentId, baselineResult, currentResult);
      regressionDetails.push(regressionResult);

      if (regressionResult.isRegression) {
        regressedTests++;
      } else if (!baselineResult.success && currentResult.success) {
        improvedTests++;
      } else {
        unchangedTests++;
      }
    }

    // Check for tests that exist in baseline but not in current results
    for (const [baselineId, baselineResult] of baselineResults.entries()) {
      const baselineEndpointMethod = `${baselineResult.testCase.method.toLowerCase()}:${baselineResult.testCase.endpoint}`;

      if (!processedEndpointMethods.has(baselineEndpointMethod)) {
        removedTests++;
        regressionDetails.push({
          id: baselineId,
          endpoint: baselineResult.testCase.endpoint,
          method: baselineResult.testCase.method,
          baselineSuccess: baselineResult.success,
          currentSuccess: false,
          statusCodeChanged: true,
          baselineStatus: baselineResult.response?.status,
          responseChanged: true,
          assertionsChanged: true,
          isRegression: baselineResult.success, // If the test was passing and now is removed, it's a regression
        });
      }
    }

    return {
      totalTests: currentResults.size,
      newTests,
      removedTests,
      matchingTests: currentResults.size - newTests,
      regressedTests,
      improvedTests,
      unchangedTests,
      details: regressionDetails,
    };
  }

  /**
   * Compare individual test results to detect changes
   * @param id Test ID
   * @param baselineResult Baseline test result
   * @param currentResult Current test result
   * @returns Detailed regression result
   */
  private compareTestResults(
    id: string,
    baselineResult: TestResult,
    currentResult: TestResult,
  ): RegressionResult {
    const baselineStatus = baselineResult.response?.status;
    const currentStatus = currentResult.response?.status;

    const statusCodeChanged =
      baselineStatus !== undefined &&
      currentStatus !== undefined &&
      baselineStatus !== currentStatus;

    // Check for response body changes
    const responseChanges = this.compareResponses(baselineResult, currentResult);
    const responseChanged = responseChanges.length > 0;

    // Check for assertion changes
    const assertionChanges = this.compareAssertions(baselineResult, currentResult);
    const assertionsChanged = assertionChanges.length > 0;

    // Check specifically for schema validation failures
    const schemaValidationRegression = this.hasSchemaValidationRegression(
      baselineResult,
      currentResult,
    );

    // Check for structural changes in response
    const structuralChangeRegression = this.hasStructuralChanges(responseChanges);

    // Determine if this is a regression:
    // 1. Test was successful in baseline but failed in current run
    // 2. Status code changed to a different one (e.g., 200 -> 400)
    // 3. Schema validation regression detected
    // 4. Response structure changed significantly
    // 5. Critical assertions started failing
    const isRegression =
      (baselineResult.success && !currentResult.success) ||
      (statusCodeChanged && this.isStatusCodeRegression(baselineStatus || 0, currentStatus || 0)) ||
      schemaValidationRegression ||
      structuralChangeRegression;

    return {
      id,
      endpoint: currentResult.testCase.endpoint,
      method: currentResult.testCase.method,
      baselineSuccess: baselineResult.success,
      currentSuccess: currentResult.success,
      statusCodeChanged,
      baselineStatus,
      currentStatus,
      responseChanged,
      responseChanges: responseChanged ? responseChanges : undefined,
      assertionsChanged,
      assertionChanges: assertionsChanged ? assertionChanges : undefined,
      isRegression,
    };
  }

  /**
   * Checks if there's a schema validation regression between baseline and current results
   * @param baselineResult Baseline test result
   * @param currentResult Current test result
   * @returns True if a schema validation regression is detected
   */
  private hasSchemaValidationRegression(
    baselineResult: TestResult,
    currentResult: TestResult,
  ): boolean {
    // Look for schema validation assertions
    const baselineSchemaAssertion = baselineResult.assertions?.find(
      (a) => a.name === 'Schema validation',
    );
    const currentSchemaAssertion = currentResult.assertions?.find(
      (a) => a.name === 'Schema validation',
    );

    // If schema validation was successful in baseline but failed in current result
    return baselineSchemaAssertion?.success === true && currentSchemaAssertion?.success === false;
  }

  /**
   * Compares response bodies to find differences
   * @param baselineResult Baseline test result
   * @param currentResult Current test result
   * @returns Array of response differences
   */
  private compareResponses(baselineResult: TestResult, currentResult: TestResult): ResponseDiff[] {
    const differences: ResponseDiff[] = [];

    if (!baselineResult.response || !currentResult.response) {
      return differences;
    }

    // Parse response bodies
    const baselineBody = baselineResult.response.body || baselineResult.response;
    const currentBody = currentResult.response.body || currentResult.response;

    // If responses are completely different, record the entire difference
    if (JSON.stringify(baselineBody) !== JSON.stringify(currentBody)) {
      // Simple approach: record that responses differ
      differences.push({
        path: 'response.body',
        baselineValue: baselineBody,
        currentValue: currentBody,
      });

      // Try to find specific schema difference by checking schema validation assertions
      const baselineSchemaAssertion = baselineResult.assertions?.find(
        (a) => a.name === 'Schema validation',
      );
      const currentSchemaAssertion = currentResult.assertions?.find(
        (a) => a.name === 'Schema validation',
      );

      if (baselineSchemaAssertion?.success && !currentSchemaAssertion?.success) {
        differences.push({
          path: 'schema.validation',
          baselineValue: 'passed',
          currentValue: currentSchemaAssertion?.error || 'failed',
        });
      } else {
        // Check for structural differences, even if schema validation passed
        // This helps detect property name changes or additions
        try {
          // For objects, we'll check the structure
          if (typeof baselineBody === 'object' && typeof currentBody === 'object') {
            const structuralDiff = this.compareObjectStructure(baselineBody, currentBody);
            if (structuralDiff.length > 0) {
              differences.push({
                path: 'response.structure',
                baselineValue: this.getObjectStructureSummary(baselineBody),
                currentValue: this.getObjectStructureSummary(currentBody),
                details: structuralDiff,
              });
            }
          }
        } catch (error) {
          // In case of error comparing structures, log and continue
          console.warn('Error comparing response structures:', error);
        }
      }
    }

    return differences;
  }

  /**
   * Compare the structure of two objects to find property differences
   * @param baseline Baseline object
   * @param current Current object
   * @param path Current property path
   * @returns Array of structure differences
   */
  private compareObjectStructure(baseline: any, current: any, path: string = ''): string[] {
    const differences: string[] = [];

    // Handle arrays
    if (Array.isArray(baseline) && Array.isArray(current)) {
      // If arrays, check the first item's structure if available
      if (baseline.length > 0 && current.length > 0) {
        const baselineItem = baseline[0];
        const currentItem = current[0];

        if (typeof baselineItem === 'object' && typeof currentItem === 'object') {
          const arrayDiffs = this.compareObjectStructure(
            baselineItem,
            currentItem,
            path ? `${path}[0]` : '[0]',
          );
          differences.push(...arrayDiffs);
        }
      }
      return differences;
    }

    // Handle null
    if (baseline === null || current === null) {
      if (baseline !== current) {
        differences.push(
          `${path}: was ${baseline === null ? 'null' : typeof baseline}, now ${current === null ? 'null' : typeof current}`,
        );
      }
      return differences;
    }

    // Only compare objects
    if (typeof baseline !== 'object' || typeof current !== 'object') {
      if (typeof baseline !== typeof current) {
        differences.push(`${path}: type changed from ${typeof baseline} to ${typeof current}`);
      }
      return differences;
    }

    // Find properties in baseline but not in current
    for (const key of Object.keys(baseline)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (!(key in current)) {
        differences.push(`${currentPath}: removed (was present in baseline)`);
        continue;
      }

      // Check type changes
      if (typeof baseline[key] !== typeof current[key]) {
        differences.push(
          `${currentPath}: type changed from ${typeof baseline[key]} to ${typeof current[key]}`,
        );
        continue;
      }

      // Recursively check nested objects
      if (
        typeof baseline[key] === 'object' &&
        baseline[key] !== null &&
        typeof current[key] === 'object' &&
        current[key] !== null
      ) {
        const nestedDiffs = this.compareObjectStructure(baseline[key], current[key], currentPath);
        differences.push(...nestedDiffs);
      }
    }

    // Find properties in current but not in baseline
    for (const key of Object.keys(current)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (!(key in baseline)) {
        differences.push(`${currentPath}: added (not present in baseline)`);
      }
    }

    return differences;
  }

  /**
   * Get a simple summary of an object's structure
   * @param obj Object to summarize
   * @returns Structure summary
   */
  private getObjectStructureSummary(obj: any): string {
    if (!obj) return 'null or undefined';
    if (typeof obj !== 'object') return typeof obj;

    if (Array.isArray(obj)) {
      return `array with ${obj.length} items`;
    }

    const keys = Object.keys(obj);
    return `object with keys: ${keys.join(', ')}`;
  }

  /**
   * Compares test assertions to find differences
   * @param baselineResult Baseline test result
   * @param currentResult Current test result
   * @returns Array of assertion differences
   */
  private compareAssertions(
    baselineResult: TestResult,
    currentResult: TestResult,
  ): AssertionDiff[] {
    const differences: AssertionDiff[] = [];

    if (!baselineResult.assertions || !currentResult.assertions) {
      return differences;
    }

    // Create maps for easier lookup
    const baselineAssertions = new Map<string, boolean>();
    baselineResult.assertions.forEach((a) => baselineAssertions.set(a.name, a.success));

    const currentAssertions = new Map<string, boolean>();
    currentResult.assertions.forEach((a) => currentAssertions.set(a.name, a.success));

    // Check assertions that exist in both
    for (const [name, baselineSuccess] of baselineAssertions.entries()) {
      const currentSuccess = currentAssertions.get(name);

      if (currentSuccess !== undefined && baselineSuccess !== currentSuccess) {
        differences.push({
          name,
          baselineSuccess,
          currentSuccess,
        });
      }
    }

    // Check for assertions that only exist in one of the results
    for (const [name, currentSuccess] of currentAssertions.entries()) {
      if (!baselineAssertions.has(name)) {
        differences.push({
          name,
          baselineSuccess: false, // Doesn't exist in baseline
          currentSuccess,
        });
      }
    }

    for (const [name, baselineSuccess] of baselineAssertions.entries()) {
      if (!currentAssertions.has(name)) {
        differences.push({
          name,
          baselineSuccess,
          currentSuccess: false, // Doesn't exist in current results
        });
      }
    }

    return differences;
  }

  /**
   * Determines if a status code change is a regression
   * @param baselineStatus Baseline status code
   * @param currentStatus Current status code
   * @returns True if this change is considered a regression
   */
  private isStatusCodeRegression(baselineStatus: number, currentStatus: number): boolean {
    // Successful status codes are 2xx
    const baselineSuccessful = baselineStatus >= 200 && baselineStatus < 300;
    const currentSuccessful = currentStatus >= 200 && currentStatus < 300;

    // It's a regression if:
    // 1. We went from a success status to a non-success status
    // 2. We went from a non-400 error to a 500 error (server error is worse than client error)
    return (
      (baselineSuccessful && !currentSuccessful) || (baselineStatus < 500 && currentStatus >= 500)
    );
  }

  /**
   * Checks if the response has structural changes
   * @param responseChanges Array of response differences
   * @returns True if structural changes are detected
   */
  private hasStructuralChanges(responseChanges: ResponseDiff[] | undefined): boolean {
    if (!responseChanges) return false;

    // Look for structural changes
    return responseChanges.some(
      (change) =>
        change.path === 'response.structure' && change.details && change.details.length > 0,
    );
  }

  /**
   * Format regression results for console output
   * @param summary Regression summary
   * @returns Formatted string for console output
   */
  formatRegressionResults(summary: RegressionSummary): string {
    let output = '\n== REGRESSION TEST RESULTS ==\n\n';

    // Summary section
    output += `Total tests: ${summary.totalTests}\n`;
    output += `New tests: ${summary.newTests}\n`;
    output += `Removed tests: ${summary.removedTests}\n`;
    output += `Matching tests: ${summary.matchingTests}\n\n`;

    output += `Regressions: ${summary.regressedTests} ❌\n`;
    output += `Improvements: ${summary.improvedTests} ✅\n`;
    output += `Unchanged: ${summary.unchangedTests}\n\n`;

    // Detail section - focus on regressions first
    if (summary.regressedTests > 0) {
      output += '=== REGRESSION DETAILS ===\n\n';

      summary.details
        .filter((detail) => detail.isRegression)
        .forEach((detail) => {
          output += `❌ ${detail.method.toUpperCase()} ${detail.endpoint}\n`;

          if (detail.statusCodeChanged) {
            output += `   Status code: ${detail.baselineStatus} → ${detail.currentStatus}\n`;
          }

          // Check for schema validation failures specifically
          const schemaValidationRegressions = detail.responseChanges?.filter(
            (change) => change.path === 'schema.validation',
          );

          if (schemaValidationRegressions && schemaValidationRegressions.length > 0) {
            output += '   Schema validation regressions:\n';
            schemaValidationRegressions.forEach((regression) => {
              output += `     - ${regression.currentValue}\n`;
            });
          }

          // Check for structural differences in responses
          const structuralChanges = detail.responseChanges?.filter(
            (change) => change.path === 'response.structure',
          );

          if (structuralChanges && structuralChanges.length > 0) {
            output += '   Response structure changes:\n';
            structuralChanges.forEach((change) => {
              output += `     - Changed from ${change.baselineValue} to ${change.currentValue}\n`;

              // Show detailed structure differences
              if (change.details && change.details.length > 0) {
                change.details.forEach((diff) => {
                  output += `       • ${diff}\n`;
                });
              }
            });
          }

          if (detail.assertionsChanged && detail.assertionChanges) {
            output += '   Failed assertions:\n';
            detail.assertionChanges
              .filter((a) => a.baselineSuccess && !a.currentSuccess)
              .forEach((a) => {
                output += `     - ${a.name}\n`;
              });
          }

          output += '\n';
        });
    }

    // Show improvements
    if (summary.improvedTests > 0) {
      output += '=== IMPROVEMENTS ===\n\n';

      summary.details
        .filter(
          (detail) => !detail.isRegression && detail.baselineSuccess !== detail.currentSuccess,
        )
        .forEach((detail) => {
          output += `✅ ${detail.method.toUpperCase()} ${detail.endpoint}\n`;

          if (detail.statusCodeChanged) {
            output += `   Status code: ${detail.baselineStatus} → ${detail.currentStatus}\n`;
          }

          if (detail.assertionsChanged && detail.assertionChanges) {
            output += '   Fixed assertions:\n';
            detail.assertionChanges
              .filter((a) => !a.baselineSuccess && a.currentSuccess)
              .forEach((a) => {
                output += `     - ${a.name}\n`;
              });
          }

          output += '\n';
        });
    }

    // Show new tests
    if (summary.newTests > 0) {
      output += '=== NEW TESTS ===\n\n';

      summary.details
        .filter((detail) => !detail.baselineSuccess && !detail.statusCodeChanged)
        .forEach((detail) => {
          const status = detail.currentSuccess ? '✅' : '❌';
          output += `${status} ${detail.method.toUpperCase()} ${detail.endpoint}\n`;
        });

      output += '\n';
    }

    // Show removed tests
    if (summary.removedTests > 0) {
      output += '=== REMOVED TESTS ===\n\n';

      summary.details
        .filter(
          (detail) => detail.baselineSuccess && !detail.currentSuccess && detail.statusCodeChanged,
        )
        .forEach((detail) => {
          output += `❌ ${detail.method.toUpperCase()} ${detail.endpoint}\n`;
        });
    }

    return output;
  }
}

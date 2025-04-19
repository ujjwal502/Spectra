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

    // Determine if this is a regression:
    // 1. Test was successful in baseline but failed in current run
    // 2. Status code changed to a different one (e.g., 200 -> 400)
    // 3. Critical assertions started failing
    const isRegression =
      (baselineResult.success && !currentResult.success) ||
      (statusCodeChanged && this.isStatusCodeRegression(baselineStatus || 0, currentStatus || 0));

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

    // For simplicity, just check if the response is different by comparing JSON strings
    // A more sophisticated implementation would do a deep comparison and identify specific fields
    const baselineBody = baselineResult.response.body || baselineResult.response;
    const currentBody = currentResult.response.body || currentResult.response;

    if (JSON.stringify(baselineBody) !== JSON.stringify(currentBody)) {
      differences.push({
        path: 'response.body',
        baselineValue: baselineBody,
        currentValue: currentBody,
      });
    }

    return differences;
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

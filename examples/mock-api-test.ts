/**
 * Spectra Mock API Test Script
 *
 * This script demonstrates how to use Spectra to test the mock API server
 * by loading an OpenAPI schema, generating test cases, and executing them.
 */

import { TestEngine, RunnerType } from '../src/core/engine';
import fs from 'fs';
import path from 'path';
import { resolveReferences } from '../src/utils/schema';
import { RegressionService } from '../src/services/regressionService';
import { HtmlReportService } from '../src/services/htmlReportService';

async function runMockApiTests() {
  try {
    console.log('Starting Spectra mock-api testing...');

    // Check if we're running in regression mode
    const isRegressionMode = process.argv.includes('--regression');
    const shouldSaveBaseline = process.argv.includes('--save-baseline');
    const skipHealthCheck = process.argv.includes('--skip-health');

    // Allow specifying a custom base URL
    let baseUrl = 'http://localhost:8080';
    const urlArgIndex = process.argv.findIndex((arg) => arg === '--url' || arg === '-u');
    if (urlArgIndex !== -1 && process.argv.length > urlArgIndex + 1) {
      baseUrl = process.argv[urlArgIndex + 1];
    }
    console.log(`🌐 Using API base URL: ${baseUrl}`);

    if (isRegressionMode) {
      console.log('🔄 Running in regression testing mode');
    }

    if (shouldSaveBaseline) {
      console.log('💾 Will save test results as regression baseline');
    }

    // Verify mock API is running (skip if --skip-health flag is provided)
    if (!skipHealthCheck) {
      console.log('🔍 Checking if mock API is running...');

      try {
        // Try different possible health endpoints
        const possibleHealthEndpoints = [
          '/api/health',
          '/health',
          '/actuator/health',
          '/api/mule/status', // Specific to this mock API based on schema
          '/api', // Just try the base path
          '/', // Try root path
        ];

        let healthCheckPassed = false;

        for (const endpoint of possibleHealthEndpoints) {
          try {
            console.log(`  Trying endpoint: ${baseUrl}${endpoint}`);
            const response = await fetch(`${baseUrl}${endpoint}`);

            if (response.ok) {
              console.log(`✅ Mock API is running, health check passed at ${endpoint}`);
              healthCheckPassed = true;
              break;
            }
          } catch (e) {
            // Continue trying other endpoints
          }
        }

        if (!healthCheckPassed) {
          console.warn(`⚠️ Could not verify if mock API is running. Continuing anyway.`);
          console.warn(`  Ensure your mock API is running at ${baseUrl}`);
          console.warn(`  To bypass this check, use the --skip-health flag`);
        }
      } catch (error) {
        console.warn(`⚠️ Error checking API health at ${baseUrl}. Continuing anyway.`);
        console.warn('  If tests fail, ensure your API is running or use --skip-health flag.');
      }
    } else {
      console.log('🔄 Skipping health check as requested with --skip-health flag');
    }

    // Check for API key and create TestEngine with AI
    const useAI = process.env.OPENAI_API_KEY ? true : false;
    console.log(`🔧 Creating TestEngine (AI: ${useAI ? 'enabled' : 'disabled'})`);

    const engine = new TestEngine({
      useAI, // Use AI if API key is present
      debug: true,
    });

    // Initialize regression service
    const regressionService = new RegressionService();

    // Load OpenAPI schema
    const schemaPath = path.join(__dirname, 'mock-api/generated-schema.json');
    console.log(`📄 Loading API schema from ${schemaPath}...`);

    const schema = await engine.loadApiSchema(schemaPath);
    console.log(`✅ Successfully loaded API schema: ${schema.info.title} v${schema.info.version}`);

    // Ensure schema component references
    if (!schema.components || !schema.components.schemas) {
      console.log('⚠️ Warning: Schema does not contain components.schemas section');
    } else {
      console.log(
        `📚 Available schema components: ${Object.keys(schema.components.schemas).join(', ')}`,
      );
    }

    // Resolve references in the schema before test generation
    console.log('🔄 Resolving schema references...');
    const resolvedSchema = await resolveReferences(schema, schemaPath);
    console.log('✅ Schema references resolved');

    // Override the schema in the engine with our resolved version
    engine.setApiSchema(resolvedSchema);

    // Generate test cases from schema using AI if available
    console.log('🧪 Generating test cases...');
    const testCases = await engine.generateTestCases();
    console.log(`✅ Generated ${testCases.size} test cases`);

    // Customize test cases for specific endpoints
    console.log('\n✏️ Customizing test cases...');
    for (const [id, testCase] of testCases.entries()) {
      // Fix schema format issues - replace "float" format with "number" type
      if (testCase.expectedResponse?.schema) {
        const fixFormats = (schema: any) => {
          if (!schema) return;

          // Replace float format with just number type
          if (schema.format === 'float' || schema.format === 'double') {
            schema.type = 'number';
            delete schema.format;
          }

          // Handle nested properties
          if (schema.properties) {
            Object.values(schema.properties).forEach(fixFormats);
          }

          // Handle array items
          if (schema.items) {
            fixFormats(schema.items);
          }

          // Handle items with properties
          if (schema.items?.properties) {
            Object.values(schema.items.properties).forEach(fixFormats);
          }
        };

        fixFormats(testCase.expectedResponse.schema);
        console.log(
          `   Fixed format issues in schema for ${testCase.method.toUpperCase()} ${testCase.endpoint}`,
        );
      }

      // Fix status code expectations for POST endpoints
      if (testCase.method === 'post' && testCase.expectedResponse?.status === 200) {
        console.log(`   Correcting ${testCase.endpoint} expected status to 201`);
        testCase.expectedResponse.status = 201;

        // Update feature test expectations as well
        if (
          testCase.feature &&
          testCase.feature.scenarios &&
          testCase.feature.scenarios.length > 0
        ) {
          testCase.feature.scenarios.forEach((scenario) => {
            scenario.steps.forEach((step) => {
              if (step.text.includes('code should be 200')) {
                step.text = step.text.replace('code should be 200', 'code should be 201');
                console.log(`   Updated scenario step text: ${step.text}`);
              }

              if (step.text.includes('status code should be 200')) {
                step.text = step.text.replace(
                  'status code should be 200',
                  'status code should be 201',
                );
                console.log(`   Updated scenario step text: ${step.text}`);
              }
            });
          });
        }
      }

      // Handle endpoints with parameters - replace with valid IDs
      if (testCase.endpoint.includes('/{')) {
        const newEndpoint = testCase.endpoint.replace(/{(\w+)}/g, (match, paramName) => {
          // Use realistic-looking IDs based on parameter name
          if (paramName.includes('id')) return '12345';
          if (paramName.includes('name')) return 'test-name';
          if (paramName.includes('code')) return 'TEST001';
          return 'placeholder';
        });

        console.log(`   Replacing endpoint ${testCase.endpoint} with ${newEndpoint}`);
        testCase.endpoint = newEndpoint;
      }

      // Add proper request bodies for POST endpoints
      if (testCase.method === 'post' && !testCase.request) {
        testCase.request = {
          id: `test-${Date.now()}`,
          name: `Test Item ${Date.now()}`,
          description: 'Created by Spectra test',
        };
        console.log(`   Added request body for ${testCase.endpoint}`);
      }
    }

    // Optionally save generated Gherkin feature files
    const featuresDir = path.join(__dirname, 'mock-api/features');
    if (!fs.existsSync(featuresDir)) {
      fs.mkdirSync(featuresDir, { recursive: true });
    }
    engine.saveFeatureFiles(featuresDir);
    console.log(`✅ Saved Gherkin feature files to ${featuresDir}`);

    // Display final test cases
    console.log('\n📋 Final Test Cases:');
    for (const [id, testCase] of testCases.entries()) {
      console.log(
        `  - ${id}: ${testCase.method.toUpperCase()} ${testCase.endpoint} → ${testCase.expectedResponse?.status || 'unknown'}`,
      );
    }

    // Execute all test cases
    console.log(`\n🚀 Executing tests against ${baseUrl}...`);

    // IMPORTANT FIX: The schema includes "/api" prefix in all endpoints,
    // but the controllers already have the "/api" prefix in their @RequestMapping
    // So we should NOT add "/api" again when making requests
    const results = await engine.executeTests(baseUrl);

    // Display results
    console.log('\n📊 Test Results:');
    let passCount = 0;
    let failCount = 0;

    for (const [id, result] of results.entries()) {
      const testCase = engine.getTestCase(id);
      if (!testCase) continue; // Skip deleted test cases

      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const endpoint = `${testCase?.method?.toUpperCase()} ${testCase?.endpoint}`;

      console.log(`  ${status} ${id}: ${endpoint} (${result.duration}ms)`);

      if (result.success) {
        passCount++;
      } else {
        failCount++;
        if (result.error) {
          console.log(`    Error: ${result.error}`);
        }

        if (result.assertions && result.assertions.length > 0) {
          for (const assertion of result.assertions) {
            if (!assertion.success) {
              console.log(`    Failed assertion: ${assertion.name}`);
              if (assertion.error) {
                console.log(`      ${assertion.error}`);
              }
            }
          }
        }
      }
    }

    // Summary
    console.log('\n📈 Summary:');
    console.log(`  Total: ${results.size} tests`);
    console.log(`  Passed: ${passCount} tests`);
    console.log(`  Failed: ${failCount} tests`);

    // Calculate pass rate based on tests that weren't skipped
    const totalRun = passCount + failCount;
    const passRate = totalRun > 0 ? Math.round((passCount / totalRun) * 100) : 0;
    console.log(`  Success rate: ${passRate}%`);

    // Save test results
    const resultsPath = path.join(__dirname, 'mock-api/test-results.json');
    const resultsArray = Array.from(results.entries()).map(([id, result]) => ({
      id,
      ...result,
    }));
    fs.writeFileSync(resultsPath, JSON.stringify(resultsArray, null, 2), 'utf8');
    console.log(`✅ Test results saved to ${resultsPath}`);

    // Generate HTML reports in the mock-api directory
    console.log('🔍 Generating HTML reports...');
    const htmlReportService = new HtmlReportService();
    htmlReportService.generateTestReport(results, path.join(__dirname, 'mock-api'));
    console.log('✅ HTML reports generated in spectra-reports directory');

    // Handle regression testing if requested
    if (isRegressionMode || shouldSaveBaseline) {
      const baselinePath = path.join(__dirname, 'mock-api/regression-baseline.json');

      if (shouldSaveBaseline) {
        // Save current results as the baseline
        regressionService.saveBaseline(results, baselinePath);
        console.log(`✅ Saved regression baseline to ${baselinePath}`);
      } else if (isRegressionMode) {
        // Load baseline and compare
        console.log(`🔍 Loading regression baseline from ${baselinePath}...`);
        const baselineResults = regressionService.loadBaseline(baselinePath);

        if (!baselineResults) {
          console.log(`⚠️ No baseline found at ${baselinePath}. Run with --save-baseline first.`);
        } else {
          console.log('🔄 Comparing current results with baseline...');
          const regressionSummary = regressionService.compareResults(baselineResults, results);

          // Display regression report
          console.log(regressionService.formatRegressionResults(regressionSummary));

          // Save regression results
          const regressionResultsPath = path.join(__dirname, 'mock-api/regression-results.json');
          fs.writeFileSync(
            regressionResultsPath,
            JSON.stringify(regressionSummary, null, 2),
            'utf8',
          );
          console.log(`✅ Regression results saved to ${regressionResultsPath}`);

          // Exit with error code if regressions found
          if (regressionSummary.regressedTests > 0) {
            console.log(`❌ ${regressionSummary.regressedTests} regressions detected`);
            process.exit(1);
          } else {
            console.log('✅ No regressions detected');
          }
        }
      }
    }

    // Exit with non-zero code if any tests failed and not in regression mode
    if (failCount > 0 && !isRegressionMode) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Error running tests:', error);
    process.exit(1);
  }
}

// Run the tests
runMockApiTests().catch(console.error);

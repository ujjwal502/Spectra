import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { TestEngine, RunnerType } from './core/engine';
import { TestCase, TestResult, SpecGeneratorOptions } from './types';
import { RegressionService } from './services/regressionService';
import { EnhancedSpecIntegration } from './integrations/enhancedSpecIntegration';
import { HtmlReportService } from './services/htmlReportService';
import { EnhancedTestResult } from './types/nonfunctional';
import { EnhancedTestGenerator } from './agents/enhancedTestGenerator';
import { IntelligentTestRunner } from './runners/intelligentTestRunner';

dotenv.config();

// Helper functions for enhanced commands

function extractEndpointsFromSchema(
  apiSchema: any,
): Array<{ path: string; method: string; operation: any }> {
  const endpoints: Array<{ path: string; method: string; operation: any }> = [];

  if (apiSchema.paths) {
    for (const [path, pathItem] of Object.entries(apiSchema.paths)) {
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];

      for (const method of methods) {
        if ((pathItem as any)[method]) {
          endpoints.push({
            path,
            method,
            operation: (pathItem as any)[method],
          });
        }
      }
    }
  }

  return endpoints;
}

function convertToGherkinFile(feature: any): string {
  let content = `Feature: ${feature.title}\n`;

  if (feature.description) {
    content += `  ${feature.description}\n`;
  }

  content += '\n';

  for (const scenario of feature.scenarios) {
    if (scenario.tags && scenario.tags.length > 0) {
      content += `  @${scenario.tags.join(' @')}\n`;
    }

    content += `  Scenario: ${scenario.title}\n`;

    for (const step of scenario.steps) {
      content += `    ${step.keyword} ${step.text}\n`;
    }

    content += '\n';
  }

  return content;
}

/**
 * Format test results as a console report
 * @param results Test results
 */
function formatTestResults(results: Map<string, TestResult>): string {
  let output = '\n== TEST RESULTS ==\n\n';

  let totalTests = 0;
  let passedTests = 0;

  for (const [id, result] of results.entries()) {
    totalTests++;

    if (result.success) {
      passedTests++;
      output += `✅ PASS: ${result.testCase.feature.title} (${id})\n`;
      output += `   Duration: ${result.duration}ms\n`;
    } else {
      output += `❌ FAIL: ${result.testCase.feature.title} (${id})\n`;
      output += `   Duration: ${result.duration}ms\n`;

      if (result.error) {
        output += `   Error: ${result.error}\n`;
      }

      if (result.assertions) {
        for (const assertion of result.assertions) {
          if (!assertion.success) {
            output += `   Failed assertion: ${assertion.name} - ${assertion.error}\n`;
          }
        }
      }
    }

    output += '\n';
  }

  output += `SUMMARY: ${passedTests}/${totalTests} tests passed (${Math.round(
    (passedTests / totalTests) * 100,
  )}%)\n`;

  return output;
}

/**
 * Save test results to a JSON file
 * @param results Test results
 * @param outputPath Output file path
 */
function saveTestResults(results: Map<string, TestResult>, outputPath: string): void {
  const resultsArray = Array.from(results.entries()).map(([id, result]) => ({
    id,
    ...result,
  }));

  fs.writeFileSync(outputPath, JSON.stringify(resultsArray, null, 2), 'utf8');
}

/**
 * Generate HTML reports for test results in the project directory
 * @param results Test results
 * @param outputDir Directory where the project being tested is located
 */
function generateHtmlReports(results: Map<string, TestResult>, outputDir: string): void {
  const htmlReportService = new HtmlReportService();
  htmlReportService.generateTestReport(results, outputDir);
}

/**
 * Run the API testing agent
 */
async function main(): Promise<void> {
  // Move args declaration outside the try block
  const args = process.argv.slice(2);

  try {
    const command = args[0];

    // Non-functional testing is always enabled
    const enableNonFunctionalTesting = true;

    // Set AI to always be enabled if OPENAI_API_KEY is present
    const useAI = process.env.OPENAI_API_KEY ? true : false;

    const engineOptions = {
      useAI,
      enableNonFunctionalTests: true, // Always enable non-functional tests
      debug: true,
    };

    const engine = new TestEngine(engineOptions);
    const regressionService = new RegressionService();

    // Remove AI flag filtering
    const processedArgs = args.filter((arg) => arg !== '--nonfunctional');

    if (useAI) {
      console.log('🧠 AI-powered features enabled');
    } else {
      console.error('⚠️ AI features disabled. Please set OPENAI_API_KEY in your environment ');
      process.exit(1);
    }

    console.log('🔬 Non-functional testing enabled');
    console.log('🚀 Using cURL runner for test execution');

    // For run:nonfunctional command, change to 'run' for switch statement
    const effectiveCommand = command === 'run:nonfunctional' ? 'run' : command;

    switch (effectiveCommand) {
      case 'generate-spec': {
        const sourcePath = processedArgs[1];
        const outputPath = processedArgs[2] || 'api-schema.json';

        if (!sourcePath) {
          console.error('❌ Source path is required for generate-spec command');
          console.log('Usage: npm run dev generate-spec <source-path> [output-path] [options]');
          console.log('\nOptions:');
          console.log('  --no-group       Disable grouping endpoints by resource');
          console.log('  --no-prefix      Disable API prefix preservation');
          console.log('  --no-jsdoc       Disable JSDoc extraction');
          console.log('  --base-url=URL   Set the API base URL (default: http://localhost:3000)');
          console.log('  --use-ai         Enable AI enhancement (requires OPENAI_API_KEY)');
          process.exit(1);
        }

        console.log(`🔍 Analyzing codebase in ${sourcePath}...`);

        try {
          // Parse options
          const options: Partial<SpecGeneratorOptions> = {};

          // Set defaults
          options.groupByResource = true;
          options.preserveApiPrefix = true;
          options.extractJSDocComments = true;
          options.baseUrl = 'http://localhost:3000';

          // Process command line options
          processedArgs.forEach((arg) => {
            if (arg === '--no-group') {
              options.groupByResource = false;
            } else if (arg === '--no-prefix') {
              options.preserveApiPrefix = false;
            } else if (arg === '--no-jsdoc') {
              options.extractJSDocComments = false;
            } else if (arg.startsWith('--base-url=')) {
              options.baseUrl = arg.split('=')[1];
            }
          });

          // Log the configuration
          console.log('\n🛠️ Configuration:');
          console.log(`  Group by resource: ${options.groupByResource ? 'enabled' : 'disabled'}`);
          console.log(
            `  API prefix preservation: ${options.preserveApiPrefix ? 'enabled' : 'disabled'}`,
          );
          console.log(
            `  JSDoc extraction: ${options.extractJSDocComments ? 'enabled' : 'disabled'}`,
          );
          if (process.env.OPENAI_API_KEY) {
            console.log('  AI enhancement: enabled (using OpenAI API)');
            console.log('  Enhanced AI schema generation: enabled');
          } else {
            console.log('  AI enhancement: disabled (no OpenAI API key found)');
            console.log('  ⚠️ For best results, set OPENAI_API_KEY in your environment');
          }
          console.log(`  Base URL: ${options.baseUrl}`);

          // Generate OpenAPI spec directly from the source code with options
          console.log(`\n🔄 Generating OpenAPI spec from ${sourcePath}...`);

          // Create Enhanced Spec Integration with options
          const enhancedSpecIntegration = new EnhancedSpecIntegration(options);
          const openApiSpec = await enhancedSpecIntegration.generateSpec(sourcePath);

          // Save OpenAPI spec to file
          fs.writeFileSync(outputPath, JSON.stringify(openApiSpec, null, 2), 'utf8');

          console.log(`✅ OpenAPI spec saved to ${outputPath}`);
          console.log(`\n💡 You can now use this spec with Spectra:`);
          console.log(`  npm run dev generate --ai ${outputPath} ./features`);
          console.log(`  npm run dev run --ai ${outputPath} http://your-api-url ./results.json`);
        } catch (error) {
          console.error(
            `❌ Failed to generate OpenAPI spec: ${error instanceof Error ? error.message : error}`,
          );
          if (error instanceof Error && error.stack) {
            console.error(error.stack);
          }
          process.exit(1);
        }
        break;
      }

      case 'generate': {
        const schemaPath = processedArgs[1] || 'api-schema.json';
        const outputDir = processedArgs[2] || 'features';

        console.log(`Loading API schema from ${schemaPath}...`);
        await engine.loadApiSchema(schemaPath);

        console.log('Generating test cases...');
        await engine.generateTestCases();

        console.log(`Saving feature files to ${outputDir}...`);
        engine.saveFeatureFiles(outputDir);

        console.log('Test generation complete!');
        break;
      }

      case 'run': {
        const schemaPath = processedArgs[1] || 'api-schema.json';
        const baseUrl = processedArgs[2] || process.env.API_BASE_URL || 'http://localhost:3000';
        const resultsPath = processedArgs[3] || 'test-results.json';
        const projectDir = path.dirname(schemaPath);

        console.log(`Loading API schema from ${schemaPath}...`);
        await engine.loadApiSchema(schemaPath);

        console.log('Generating test cases...');
        const testCases = await engine.generateTestCases();

        console.log(`Running tests against ${baseUrl}...`);

        // Select endpoints for non-functional testing (all endpoints will receive functional tests)
        console.log('🔬 Executing non-functional tests...');
        // Select a subset of test cases for non-functional testing to avoid long execution times
        const selectedTestIds = Array.from(testCases.keys())
          .filter((id, index) => {
            const testCase = testCases.get(id);
            // Take some GET and some POST endpoints
            return (
              testCase &&
              (index % 3 === 0 ||
                testCase.method.toLowerCase() === 'get' ||
                testCase.method.toLowerCase() === 'post')
            );
          })
          .slice(0, 5); // Limit to 5 test cases

        console.log(`Selected ${selectedTestIds.length} test cases for non-functional testing`);

        // Run non-functional tests on the selected subset
        const nonFunctionalResults = await engine.executeNonFunctionalTests(
          baseUrl,
          selectedTestIds,
        );

        // Display non-functional results
        console.log(engine.formatNonFunctionalResults(nonFunctionalResults));

        // Run functional tests on all endpoints
        console.log(`\n🧪 Running functional tests on all endpoints...`);
        const functionalResults = await engine.executeTests(baseUrl);
        console.log(formatTestResults(functionalResults));

        // Save results to files
        saveTestResults(functionalResults, resultsPath);
        console.log(`Functional test results saved to ${resultsPath}`);

        // Save non-functional results to a different file
        const nfResultsPath = resultsPath.replace('.json', '-nonfunctional.json');
        const resultsArray = Array.from(nonFunctionalResults.entries()).map(([id, result]) => {
          const testCase = testCases.get(id);
          return {
            id,
            endpoint: testCase?.endpoint,
            method: testCase?.method,
            success: result.success,
            duration: result.duration,
            nonFunctionalResults: result.nonFunctionalResults,
          };
        });

        fs.writeFileSync(nfResultsPath, JSON.stringify(resultsArray, null, 2), 'utf8');
        console.log(`Non-functional test results saved to ${nfResultsPath}`);

        // Generate HTML reports
        generateHtmlReports(functionalResults, projectDir);

        break;
      }

      case 'regression:run': {
        const schemaPath = processedArgs[1] || 'api-schema.json';
        const baseUrl = processedArgs[2] || process.env.API_BASE_URL || 'http://localhost:3000';
        const baselinePath = processedArgs[3] || 'regression-baseline.json';
        const resultsPath = processedArgs[4] || 'test-results.json';
        const projectDir = path.dirname(schemaPath);

        console.log(`Loading API schema from ${schemaPath}...`);
        await engine.loadApiSchema(schemaPath);

        console.log('Generating test cases...');
        await engine.generateTestCases();

        console.log(`Running tests against ${baseUrl}...`);
        const currentResults = await engine.executeTests(baseUrl);

        console.log(formatTestResults(currentResults));

        saveTestResults(currentResults, resultsPath);
        console.log(`Test results saved to ${resultsPath}`);

        // Generate HTML reports
        generateHtmlReports(currentResults, projectDir);

        // Load baseline for regression comparison
        console.log(`Loading regression baseline from ${baselinePath}...`);
        const baselineResults = regressionService.loadBaseline(baselinePath);

        if (!baselineResults) {
          console.log(`⚠️ No baseline found at ${baselinePath}`);
          break;
        }

        console.log('Comparing current results with baseline...');
        const regressionSummary = regressionService.compareResults(baselineResults, currentResults);

        console.log(regressionService.formatRegressionResults(regressionSummary));

        // Save regression summary
        const regressionSummaryPath = path.join(
          path.dirname(resultsPath),
          'regression-results.json',
        );
        fs.writeFileSync(regressionSummaryPath, JSON.stringify(regressionSummary, null, 2), 'utf8');
        console.log(`Regression results saved to ${regressionSummaryPath}`);

        // Exit with error code if regressions found
        if (regressionSummary.regressedTests > 0) {
          process.exit(1);
        }
        break;
      }

      case 'regression:baseline': {
        const schemaPath = processedArgs[1] || 'api-schema.json';
        const baseUrl = processedArgs[2] || process.env.API_BASE_URL || 'http://localhost:3000';
        const baselinePath = processedArgs[3] || 'regression-baseline.json';
        const projectDir = path.dirname(schemaPath);

        console.log(`Loading API schema from ${schemaPath}...`);
        await engine.loadApiSchema(schemaPath);

        console.log('Generating test cases...');
        await engine.generateTestCases();

        console.log(`Running tests against ${baseUrl} to create baseline...`);
        const results = await engine.executeTests(baseUrl);

        console.log(formatTestResults(results));

        // Generate HTML reports
        generateHtmlReports(results, projectDir);

        // Save as regression baseline
        regressionService.saveBaseline(results, baselinePath);
        console.log(`Regression baseline saved to ${baselinePath}`);
        break;
      }

      case 'generate-tests-enhanced': {
        const openApiSpecPath = processedArgs[1];
        const outputDir = processedArgs[2] || './tests';

        if (!openApiSpecPath) {
          console.error('❌ OpenAPI spec path is required for generate-tests-enhanced command');
          console.log(
            'Usage: npm run dev generate-tests-enhanced <openapi-spec-path> [output-dir]',
          );
          process.exit(1);
        }

        if (!fs.existsSync(openApiSpecPath)) {
          console.error(`❌ OpenAPI spec file not found: ${openApiSpecPath}`);
          process.exit(1);
        }

        console.log('🧠 Enhanced Test Generation with LangGraph + LRASGen');
        console.log(`📖 Using spec: ${openApiSpecPath}`);

        try {
          // Load OpenAPI specification
          const apiSchema = JSON.parse(fs.readFileSync(openApiSpecPath, 'utf-8'));

          // Create output directory
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }

          const testGenerator = new EnhancedTestGenerator();

          // Extract endpoints from schema
          const endpoints = extractEndpointsFromSchema(apiSchema);
          console.log(`🎯 Generating tests for ${endpoints.length} endpoints...`);

          for (const endpoint of endpoints) {
            console.log(`\n📋 Processing: ${endpoint.method.toUpperCase()} ${endpoint.path}`);

            const result = await testGenerator.generateTestSuite(apiSchema, endpoint);

            // Save test cases
            const sanitizedPath = endpoint.path.replace(/[/{}:]/g, '_');
            const testFileName = `${endpoint.method}_${sanitizedPath}_tests.json`;
            const testFilePath = path.join(outputDir, testFileName);

            fs.writeFileSync(
              testFilePath,
              JSON.stringify(
                {
                  endpoint: `${endpoint.method.toUpperCase()} ${endpoint.path}`,
                  testCases: result.testCases,
                  gherkinFeatures: result.gherkinFeatures,
                  executionPlan: result.executionPlan,
                  coverage: result.coverage,
                  recommendations: result.recommendations,
                },
                null,
                2,
              ),
            );

            // Save Gherkin features separately
            const gherkinDir = path.join(outputDir, 'features');
            if (!fs.existsSync(gherkinDir)) {
              fs.mkdirSync(gherkinDir, { recursive: true });
            }

            for (const feature of result.gherkinFeatures) {
              const featureFileName = `${sanitizedPath}_${feature.title.replace(/\s+/g, '_')}.feature`;
              const featureContent = convertToGherkinFile(feature);
              fs.writeFileSync(path.join(gherkinDir, featureFileName), featureContent);
            }

            console.log(`✅ Generated ${result.testCases.length} test cases`);
            console.log(`🥒 Created ${result.gherkinFeatures.length} Gherkin features`);
            console.log(`📈 Coverage: ${JSON.stringify(result.coverage)}`);
          }

          console.log(`\n🎉 Enhanced test generation completed! Tests saved to: ${outputDir}`);
        } catch (error) {
          console.error('❌ Enhanced test generation failed:', error);
          process.exit(1);
        }
        break;
      }

      case 'execute-tests-intelligent': {
        const testSuiteDir = processedArgs[1];
        const baseUrl = processedArgs[2] || 'http://localhost:3000';
        const outputDir = processedArgs[3] || './test-results';

        if (!testSuiteDir) {
          console.error(
            '❌ Test suite directory is required for execute-tests-intelligent command',
          );
          console.log(
            'Usage: npm run dev execute-tests-intelligent <test-suite-dir> [base-url] [output-dir]',
          );
          process.exit(1);
        }

        if (!fs.existsSync(testSuiteDir)) {
          console.error(`❌ Test suite directory not found: ${testSuiteDir}`);
          process.exit(1);
        }

        console.log('🧠 Intelligent Test Execution with AI Adaptation');
        console.log(`📁 Test suite: ${testSuiteDir}`);
        console.log(`🌐 Target URL: ${baseUrl}`);

        try {
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }

          // Load test suites
          const testFiles = fs
            .readdirSync(testSuiteDir)
            .filter((file) => file.endsWith('_tests.json'));

          if (testFiles.length === 0) {
            console.error('❌ No test files found in directory');
            process.exit(1);
          }

          const intelligentRunner = new IntelligentTestRunner(baseUrl);

          // Execute each test suite
          for (const testFile of testFiles) {
            console.log(`\n📋 Executing: ${testFile}`);

            const testSuiteData = JSON.parse(
              fs.readFileSync(path.join(testSuiteDir, testFile), 'utf-8'),
            );

            const result = await intelligentRunner.executeIntelligentTestSuite(
              testSuiteData.testCases,
              testSuiteData.executionPlan || { testOrder: ['functional', 'boundary', 'error'] },
            );

            // Save results
            const resultFile = testFile.replace('_tests.json', '_results.json');
            fs.writeFileSync(
              path.join(outputDir, resultFile),
              JSON.stringify(
                {
                  endpoint: testSuiteData.endpoint,
                  executionTimestamp: new Date().toISOString(),
                  summary: result.executionSummary,
                  insights: result.insights,
                  recommendations: result.recommendations,
                  detailedResults: Array.from(result.results.entries()).map(([id, testResult]) => ({
                    testId: id,
                    ...testResult,
                  })),
                },
                null,
                2,
              ),
            );

            console.log(`✅ Executed ${testSuiteData.testCases.length} tests`);
            console.log(
              `📊 Success rate: ${(result.executionSummary.successRate * 100).toFixed(2)}%`,
            );
            console.log(`🔍 Generated ${result.insights.length} insights`);
          }

          console.log(`\n🎉 Intelligent test execution completed! Results saved to: ${outputDir}`);
        } catch (error) {
          console.error('❌ Intelligent test execution failed:', error);
          process.exit(1);
        }
        break;
      }

      case 'test-workflow-enhanced': {
        const codebaseDir = processedArgs[1];
        const baseUrl = processedArgs[2] || 'http://localhost:3000';
        const outputDir = processedArgs[3] || './spectra-enhanced-tests';

        if (!codebaseDir) {
          console.error('❌ Codebase directory is required for test-workflow-enhanced command');
          console.log(
            'Usage: npm run dev test-workflow-enhanced <codebase-dir> [base-url] [output-dir]',
          );
          process.exit(1);
        }

        console.log('🚀 Enhanced Testing Workflow: Spec → Tests → Execution');
        console.log(`📁 Codebase: ${codebaseDir}`);

        try {
          // Create output directory structure
          const specsDir = path.join(outputDir, 'specs');
          const testsDir = path.join(outputDir, 'tests');
          const resultsDir = path.join(outputDir, 'results');

          [outputDir, specsDir, testsDir, resultsDir].forEach((dir) => {
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
          });

          // Step 1: Generate enhanced OpenAPI specification
          console.log('\n📋 Step 1: Generating enhanced OpenAPI specification...');
          const integration = new EnhancedSpecIntegration({ baseUrl });
          const specPath = path.join(specsDir, 'api-spec.json');
          await integration.generateSpec(codebaseDir, specPath);

          // Step 2: Generate comprehensive test cases
          console.log('\n🧪 Step 2: Generating comprehensive test cases...');
          const apiSchema = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
          const endpoints = extractEndpointsFromSchema(apiSchema);
          const testGenerator = new EnhancedTestGenerator();

          for (const endpoint of endpoints) {
            const result = await testGenerator.generateTestSuite(apiSchema, endpoint);

            const sanitizedPath = endpoint.path.replace(/[/{}:]/g, '_');
            const testFileName = `${endpoint.method}_${sanitizedPath}_tests.json`;

            fs.writeFileSync(
              path.join(testsDir, testFileName),
              JSON.stringify(
                {
                  endpoint: `${endpoint.method.toUpperCase()} ${endpoint.path}`,
                  testCases: result.testCases,
                  gherkinFeatures: result.gherkinFeatures,
                  executionPlan: result.executionPlan,
                  coverage: result.coverage,
                  recommendations: result.recommendations,
                },
                null,
                2,
              ),
            );
          }

          // Step 3: Execute with intelligent adaptation
          console.log('\n🧠 Step 3: Executing tests with intelligent adaptation...');
          const intelligentRunner = new IntelligentTestRunner(baseUrl);
          const testFiles = fs.readdirSync(testsDir).filter((file) => file.endsWith('_tests.json'));

          const overallResults = {
            totalEndpoints: endpoints.length,
            totalTests: 0,
            totalPassed: 0,
            totalFailed: 0,
            insights: [] as string[],
            recommendations: [] as string[],
          };

          for (const testFile of testFiles) {
            const testSuiteData = JSON.parse(
              fs.readFileSync(path.join(testsDir, testFile), 'utf-8'),
            );

            const result = await intelligentRunner.executeIntelligentTestSuite(
              testSuiteData.testCases,
              testSuiteData.executionPlan,
            );

            // Aggregate results
            overallResults.totalTests += testSuiteData.testCases.length;
            overallResults.totalPassed += result.executionSummary.passedTests;
            overallResults.totalFailed += result.executionSummary.failedTests;
            overallResults.insights.push(...result.insights);
            overallResults.recommendations.push(...result.recommendations);

            // Save individual results
            const resultFile = testFile.replace('_tests.json', '_results.json');
            fs.writeFileSync(
              path.join(resultsDir, resultFile),
              JSON.stringify(
                {
                  endpoint: testSuiteData.endpoint,
                  executionTimestamp: new Date().toISOString(),
                  summary: result.executionSummary,
                  insights: result.insights,
                  recommendations: result.recommendations,
                  detailedResults: Array.from(result.results.entries()).map(([id, testResult]) => ({
                    testId: id,
                    ...testResult,
                  })),
                },
                null,
                2,
              ),
            );
          }

          // Save overall summary
          const summaryPath = path.join(outputDir, 'workflow-summary.json');
          fs.writeFileSync(
            summaryPath,
            JSON.stringify(
              {
                workflowCompletedAt: new Date().toISOString(),
                codebaseAnalyzed: codebaseDir,
                baseUrl,
                results: overallResults,
                successRate:
                  overallResults.totalTests > 0
                    ? overallResults.totalPassed / overallResults.totalTests
                    : 0,
                outputStructure: {
                  specs: specsDir,
                  tests: testsDir,
                  results: resultsDir,
                },
              },
              null,
              2,
            ),
          );

          console.log('\n🎉 Enhanced testing workflow completed successfully!');
          console.log(`📊 Overall Results:`);
          console.log(`   - Endpoints analyzed: ${overallResults.totalEndpoints}`);
          console.log(`   - Tests generated: ${overallResults.totalTests}`);
          console.log(`   - Tests passed: ${overallResults.totalPassed}`);
          console.log(`   - Tests failed: ${overallResults.totalFailed}`);
          console.log(
            `   - Success rate: ${((overallResults.totalPassed / overallResults.totalTests) * 100).toFixed(2)}%`,
          );
          console.log(`📁 All results saved to: ${outputDir}`);
        } catch (error) {
          console.error('❌ Enhanced testing workflow failed:', error);
          process.exit(1);
        }
        break;
      }

      default:
        console.log(`
API Testing Agent

Usage:
  npm run dev generate-spec <source-path> [output-path]
  npm run dev generate <schema-path> <output-dir>
  npm run dev run <schema-path> <base-url> <results-path>
  npm run dev regression:baseline <schema-path> <base-url> <baseline-path>
  npm run dev regression:run <schema-path> <base-url> <baseline-path> <results-path>
  
Enhanced Commands:
  npm run dev generate-tests-enhanced <openapi-spec-path> [output-dir]
  npm run dev execute-tests-intelligent <test-suite-dir> [base-url] [output-dir]
  npm run dev test-workflow-enhanced <codebase-dir> [base-url] [output-dir]

Options:
  --no-group       Disable grouping endpoints by resource
  --no-prefix      Disable API prefix preservation
  --no-jsdoc       Disable JSDoc extraction
  --base-url=URL   Set the API base URL (default: http://localhost:3000)

Note: 
- AI-powered schema enhancement is automatically enabled when OPENAI_API_KEY is set in your environment
- Non-functional testing (performance, security, reliability, load) is included in all test runs
- Enhanced commands use LangGraph + LRASGen methodology for advanced test generation

Examples:
  npm run dev generate-spec ./my-backend-code ./schemas/generated-api.json
  npm run dev generate ./schemas/petstore.json ./features
  npm run dev run ./schemas/petstore.json https://petstore.swagger.io/v2 ./results.json
  npm run dev generate-tests-enhanced ./schemas/openapi.json ./enhanced-tests
  npm run dev execute-tests-intelligent ./enhanced-tests http://localhost:3000 ./results
  npm run dev test-workflow-enhanced ./my-backend-code http://localhost:3000 ./complete-results
        `);
        break;
    }
  } catch (error: any) {
    // Get a meaningful action description based on the current context
    let actionDesc = 'complete operation';

    // Access args directly since it's now in scope
    if (args && args.length > 0) {
      actionDesc = args[0] || 'run command';
    }

    console.error(`❌ Failed to ${actionDesc}: ${error.message}`);

    // Add additional instructions for common issues
    if (error.message.includes('parse') || error.message.includes('JSON')) {
      console.log('\n💡 This appears to be an issue with parsing the OpenAI response.');
      console.log('You can try the following:');
      console.log('1. Run the command again (sometimes OpenAI returns malformed responses)');
      console.log('2. Check your OpenAI API key and quota');
      console.log('3. If you have a RAW output file, examine it for JSON formatting issues');
    }

    process.exit(1);
  }
}

main().catch(console.error);

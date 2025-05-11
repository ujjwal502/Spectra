import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { TestEngine, RunnerType } from './core/engine';
import { TestCase, TestResult, SpecGeneratorOptions } from './types';
import { RegressionService } from './services/regressionService';
import { SpecGenerator } from './generators/specGenerator';
import { HtmlReportService } from './services/htmlReportService';

dotenv.config();

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

    // Set AI to always be enabled if OPENAI_API_KEY is present
    const useAI = process.env.OPENAI_API_KEY ? true : false;

    const engineOptions = {
      useAI,
    };

    const engine = new TestEngine(engineOptions);
    const regressionService = new RegressionService();

    // Remove AI flag filtering
    const processedArgs = args;

    if (useAI) {
      console.log('🧠 AI-powered features enabled');
    } else {
      console.error('⚠️ AI features disabled. Please set OPENAI_API_KEY in your environment ');
      process.exit(1);
    }

    console.log('🚀 Using cURL runner for test execution');

    switch (command) {
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

          // Create SpecGenerator with options
          const specGeneratorWithOptions = new SpecGenerator(options);
          const openApiSpec = await specGeneratorWithOptions.generateFromCode(sourcePath);

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
        await engine.generateTestCases();

        console.log(`Running tests against ${baseUrl}...`);
        const results = await engine.executeTests(baseUrl);

        console.log(formatTestResults(results));

        saveTestResults(results, resultsPath);
        console.log(`Test results saved to ${resultsPath}`);

        // Generate HTML reports
        generateHtmlReports(results, projectDir);
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

      default:
        console.log(`
API Testing Agent

Usage:
  npm run dev generate-spec <source-path> [output-path]
  npm run dev generate <schema-path> <output-dir>
  npm run dev run <schema-path> <base-url> <results-path>
  npm run dev regression:baseline <schema-path> <base-url> <baseline-path>
  npm run dev regression:run <schema-path> <base-url> <baseline-path> <results-path>

Options:
  --no-group       Disable grouping endpoints by resource
  --no-prefix      Disable API prefix preservation
  --no-jsdoc       Disable JSDoc extraction
  --base-url=URL   Set the API base URL (default: http://localhost:3000)

Note: AI-powered schema enhancement is automatically enabled when OPENAI_API_KEY is set in your environment

Examples:
  npm run dev generate-spec ./my-backend-code ./schemas/generated-api.json
  npm run dev generate ./schemas/petstore.json ./features
  npm run dev run ./schemas/petstore.json https://petstore.swagger.io/v2 ./results.json
  npm run dev regression:baseline ./schemas/petstore.json https://petstore.swagger.io/v2 ./baseline.json
  npm run dev regression:run ./schemas/petstore.json https://petstore.swagger.io/v2 ./baseline.json ./results.json
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

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { TestEngine, RunnerType } from './core/engine';
import { TestResult } from './types';
import { RegressionService } from './services/regressionService';

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
 * Run the API testing agent
 */
async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2);
    const command = args[0];

    const useAI = args.includes('--ai') || args.includes('-a');

    const usePostman = args.includes('--postman') || args.includes('-p');
    const runnerType = usePostman ? RunnerType.POSTMAN : RunnerType.REST;

    const engineOptions = {
      useAI,
      runnerType,
    };

    const engine = new TestEngine(engineOptions);
    const regressionService = new RegressionService();

    const processedArgs = args.filter(
      (arg) => arg !== '--ai' && arg !== '-a' && arg !== '--postman' && arg !== '-p',
    );

    if (useAI) {
      console.log('🧠 AI-powered test generation enabled');
      if (!process.env.OPENAI_API_KEY) {
        console.warn(
          '⚠️  OPENAI_API_KEY not found in environment variables. AI features may not work.',
        );
      }
    }

    if (usePostman) {
      console.log('🚀 Using Postman/Newman runner for test execution');
    }

    switch (command) {
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

        console.log(`Loading API schema from ${schemaPath}...`);
        await engine.loadApiSchema(schemaPath);

        console.log('Generating test cases...');
        await engine.generateTestCases();

        console.log(`Running tests against ${baseUrl}...`);
        const results = await engine.executeTests(baseUrl);

        console.log(formatTestResults(results));

        saveTestResults(results, resultsPath);
        console.log(`Test results saved to ${resultsPath}`);
        break;
      }

      case 'regression:run': {
        const schemaPath = processedArgs[1] || 'api-schema.json';
        const baseUrl = processedArgs[2] || process.env.API_BASE_URL || 'http://localhost:3000';
        const baselinePath = processedArgs[3] || 'regression-baseline.json';
        const resultsPath = processedArgs[4] || 'test-results.json';

        console.log(`Loading API schema from ${schemaPath}...`);
        await engine.loadApiSchema(schemaPath);

        console.log('Generating test cases...');
        await engine.generateTestCases();

        console.log(`Running tests against ${baseUrl}...`);
        const currentResults = await engine.executeTests(baseUrl);

        console.log(formatTestResults(currentResults));

        saveTestResults(currentResults, resultsPath);
        console.log(`Test results saved to ${resultsPath}`);

        // Load baseline for regression comparison
        console.log(`Loading regression baseline from ${baselinePath}...`);
        const baselineResults = regressionService.loadBaseline(baselinePath);

        if (!baselineResults) {
          console.log(`⚠️  No baseline found at ${baselinePath}. Run 'regression:baseline' first.`);
          console.log(
            `   You can create a baseline with: npm run dev regression:baseline ${schemaPath} ${baseUrl} ${baselinePath}`,
          );
          break;
        }

        // Compare results and show regression analysis
        console.log('Comparing with baseline...');
        const regressionSummary = regressionService.compareResults(baselineResults, currentResults);

        console.log(regressionService.formatRegressionResults(regressionSummary));

        // Save regression results
        const regressionResultsPath = 'regression-results.json';
        fs.writeFileSync(regressionResultsPath, JSON.stringify(regressionSummary, null, 2), 'utf8');
        console.log(`Regression results saved to ${regressionResultsPath}`);

        // Exit with error code if regressions found
        if (regressionSummary.regressedTests > 0) {
          console.log(`❌ ${regressionSummary.regressedTests} regressions detected`);
          process.exit(1);
        } else {
          console.log('✅ No regressions detected');
        }
        break;
      }

      case 'regression:baseline': {
        const schemaPath = processedArgs[1] || 'api-schema.json';
        const baseUrl = processedArgs[2] || process.env.API_BASE_URL || 'http://localhost:3000';
        const baselinePath = processedArgs[3] || 'regression-baseline.json';

        console.log(`Loading API schema from ${schemaPath}...`);
        await engine.loadApiSchema(schemaPath);

        console.log('Generating test cases...');
        await engine.generateTestCases();

        console.log(`Running tests against ${baseUrl} to create baseline...`);
        const results = await engine.executeTests(baseUrl);

        console.log(formatTestResults(results));

        // Save as regression baseline
        regressionService.saveBaseline(results, baselinePath);
        console.log(`Regression baseline saved to ${baselinePath}`);
        break;
      }

      default:
        console.log(`
API Testing Agent

Usage:
  npm run dev generate [--ai] [--postman] <schema-path> <output-dir>
  npm run dev run [--ai] [--postman] <schema-path> <base-url> <results-path>
  npm run dev regression:baseline [--ai] [--postman] <schema-path> <base-url> <baseline-path>
  npm run dev regression:run [--ai] [--postman] <schema-path> <base-url> <baseline-path> <results-path>

Options:
  --ai, -a          Enable AI-powered test generation
  --postman, -p     Use Postman/Newman runner instead of direct REST client

Examples:
  npm run dev generate --ai ./schemas/petstore.json ./features
  npm run dev run --ai --postman ./schemas/petstore.json https://petstore.swagger.io/v2 ./results.json
  npm run dev regression:baseline --ai ./schemas/petstore.json https://petstore.swagger.io/v2 ./baseline.json
  npm run dev regression:run --ai ./schemas/petstore.json https://petstore.swagger.io/v2 ./baseline.json ./results.json
        `);
        break;
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);

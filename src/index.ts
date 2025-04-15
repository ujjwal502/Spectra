import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { TestEngine } from './core/engine';
import { TestResult } from './types';

// Load environment variables
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

  output += `SUMMARY: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)\n`;

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

    // Check for ai flag
    const useAI = args.includes('--ai') || args.includes('-a');
    const engineOptions = {
      useAI,
    };

    const engine = new TestEngine(engineOptions);

    // Remove the ai flag from args for further processing
    const processedArgs = args.filter((arg) => arg !== '--ai' && arg !== '-a');

    if (useAI) {
      console.log('🧠 AI-powered test generation enabled');
      if (!process.env.OPENAI_API_KEY) {
        console.warn(
          '⚠️  OPENAI_API_KEY not found in environment variables. AI features may not work.',
        );
      }
    }

    switch (command) {
      case 'generate': {
        // Generate test cases from API schema
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
        // Run tests against an API
        const schemaPath = processedArgs[1] || 'api-schema.json';
        const baseUrl = processedArgs[2] || process.env.API_BASE_URL || 'http://localhost:3000';
        const resultsPath = processedArgs[3] || 'test-results.json';

        console.log(`Loading API schema from ${schemaPath}...`);
        await engine.loadApiSchema(schemaPath);

        console.log('Generating test cases...');
        await engine.generateTestCases();

        console.log(`Running tests against ${baseUrl}...`);
        const results = await engine.executeTests(baseUrl);

        // Display results
        console.log(formatTestResults(results));

        // Save results
        saveTestResults(results, resultsPath);
        console.log(`Test results saved to ${resultsPath}`);
        break;
      }

      default:
        console.log(`
API Testing Agent

Usage:
  npm run dev generate [--ai] <schema-path> <output-dir>
  npm run dev run [--ai] <schema-path> <base-url> <results-path>

Options:
  --ai, -a        Enable AI-powered test generation

Examples:
  npm run dev generate --ai ./schemas/petstore.json ./features
  npm run dev run ./schemas/petstore.json https://petstore.swagger.io/v2 ./results.json
        `);
        break;
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the application
main().catch(console.error);

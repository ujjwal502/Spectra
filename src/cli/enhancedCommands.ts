import { Command } from 'commander';
import { EnhancedSpecIntegration } from '../integrations/enhancedSpecIntegration';
import { EnhancedTestGenerator } from '../agents/enhancedTestGenerator';
import { IntelligentTestRunner } from '../runners/intelligentTestRunner';
import path from 'path';
import * as fs from 'fs';

export function addEnhancedCommands(program: Command): void {
  program
    .command('generate-spec-enhanced')
    .description('Generate high-accuracy OpenAPI specification using AI + Repomix')
    .argument('<rootDir>', 'Root directory of the codebase to analyze')
    .argument('[outputPath]', 'Output path for the generated OpenAPI spec')
    .option('--base-url <baseUrl>', 'Base URL for the API', 'http://localhost:3000')
    .action(async (rootDir: string, outputPath?: string, options?: any) => {
      try {
        console.log('🚀 Enhanced Spec Generation with AI + Repomix');
        console.log(`📁 Analyzing: ${rootDir}`);

        const integration = new EnhancedSpecIntegration({
          baseUrl: options?.baseUrl || 'http://localhost:3000',
          preserveApiPrefix: true,
          groupByResource: true,
          enhanceParameterNames: true,
          extractJSDocComments: true,
        });

        const defaultOutputPath =
          outputPath || path.join(process.cwd(), 'enhanced-openapi-spec.json');
        await integration.generateSpec(rootDir, defaultOutputPath);

        console.log('✅ Enhanced spec generation completed successfully!');
      } catch (error) {
        console.error('❌ Enhanced spec generation failed:', error);
        process.exit(1);
      }
    });

  program
    .command('demo-enhanced')
    .description('Demo the enhanced spec generation on the built-in backend example')
    .option('--output <outputPath>', 'Output path for demo spec', './spectra-demo.json')
    .action(async (options?: any) => {
      try {
        console.log('🎯 Running Enhanced Spec Generation Demo...');

        const backendDir = path.join(process.cwd(), 'examples', 'backend');
        const outputPath = options?.output || './spectra-demo.json';

        // Check if backend example exists
        const fs = await import('fs');
        if (!fs.existsSync(backendDir)) {
          console.error(
            '❌ Backend example not found. Please ensure examples/backend directory exists.',
          );
          process.exit(1);
        }

        const integration = new EnhancedSpecIntegration({
          baseUrl: 'http://localhost:3000',
        });

        await integration.generateSpec(backendDir, outputPath);

        console.log(`✅ Enhanced demo completed! Spec saved to: ${outputPath}`);
      } catch (error) {
        console.error('❌ Demo failed:', error);
        process.exit(1);
      }
    });

  program
    .command('batch-enhanced')
    .description('Run enhanced spec generation on multiple codebases')
    .argument('<configFile>', 'JSON config file with list of codebases to process')
    .option('--output <outputDir>', 'Output directory for all results', './spectra-batch')
    .action(async (configFile: string, options?: any) => {
      try {
        console.log('📦 Batch Enhanced Spec Generation...');

        const fs = await import('fs');
        const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));

        if (!config.codebases || !Array.isArray(config.codebases)) {
          throw new Error('Config file must contain a "codebases" array');
        }

        const outputDir = options?.output || './spectra-batch';
        const integration = new EnhancedSpecIntegration();

        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        for (let i = 0; i < config.codebases.length; i++) {
          const codebase = config.codebases[i];
          console.log(`\n🔄 Processing ${i + 1}/${config.codebases.length}: ${codebase.path}`);

          try {
            const outputFileName = `${codebase.name || `codebase-${i + 1}`}.json`;
            const outputPath = path.join(outputDir, outputFileName);
            await integration.generateSpec(codebase.path, outputPath);
            console.log(`✅ Completed: ${codebase.name || codebase.path}`);
          } catch (error) {
            console.error(`❌ Failed: ${codebase.name || codebase.path} - ${error}`);
          }
        }

        console.log(`\n🎉 Batch processing completed! Results saved to: ${outputDir}`);
      } catch (error) {
        console.error('❌ Batch processing failed:', error);
        process.exit(1);
      }
    });

  // Enhanced Test Generation Commands

  program
    .command('generate-tests-enhanced')
    .description('Generate comprehensive test cases using LangGraph + LRASGen methodology')
    .argument('<openApiSpecPath>', 'Path to OpenAPI specification file')
    .option('--endpoint <endpoint>', 'Generate tests for specific endpoint (optional)')
    .option('--method <method>', 'HTTP method for specific endpoint')
    .option('--output <outputDir>', 'Output directory for test files', './tests')
    .action(async (openApiSpecPath: string, options?: any) => {
      try {
        console.log('🧠 Enhanced Test Generation with LangGraph + LRASGen');
        console.log(`📖 Using spec: ${openApiSpecPath}`);

        // Load OpenAPI specification
        if (!fs.existsSync(openApiSpecPath)) {
          throw new Error(`OpenAPI spec file not found: ${openApiSpecPath}`);
        }

        const apiSchema = JSON.parse(fs.readFileSync(openApiSpecPath, 'utf-8'));
        const outputDir = options?.output || './tests';

        // Create output directory
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const testGenerator = new EnhancedTestGenerator();

        // Generate tests for all endpoints or specific endpoint
        const endpoints = extractEndpointsFromSchema(apiSchema);

        let targetEndpoints = endpoints;
        if (options?.endpoint && options?.method) {
          targetEndpoints = endpoints.filter(
            (ep) =>
              ep.path === options.endpoint &&
              ep.method.toLowerCase() === options.method.toLowerCase(),
          );

          if (targetEndpoints.length === 0) {
            throw new Error(
              `Endpoint not found: ${options.method.toUpperCase()} ${options.endpoint}`,
            );
          }
        }

        console.log(`🎯 Generating tests for ${targetEndpoints.length} endpoints...`);

        for (const endpoint of targetEndpoints) {
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
    });

  program
    .command('execute-tests-intelligent')
    .description('Execute tests with intelligent adaptation using AI decision making')
    .argument('<testSuiteDir>', 'Directory containing test suite files')
    .option('--base-url <baseUrl>', 'Base URL for API under test', 'http://localhost:3000')
    .option('--disable-adaptation', 'Disable AI-driven adaptation during execution')
    .option('--failure-threshold <threshold>', 'Failure threshold for adaptive decisions', '0.3')
    .option('--output <outputDir>', 'Output directory for results', './test-results')
    .action(async (testSuiteDir: string, options?: any) => {
      try {
        console.log('🧠 Intelligent Test Execution with AI Adaptation');
        console.log(`📁 Test suite: ${testSuiteDir}`);
        console.log(`🌐 Target URL: ${options?.baseUrl || 'http://localhost:3000'}`);

        if (!fs.existsSync(testSuiteDir)) {
          throw new Error(`Test suite directory not found: ${testSuiteDir}`);
        }

        const outputDir = options?.output || './test-results';
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        // Load test suites
        const testFiles = fs
          .readdirSync(testSuiteDir)
          .filter((file) => file.endsWith('_tests.json'));

        if (testFiles.length === 0) {
          throw new Error('No test files found in directory');
        }

        const intelligentRunner = new IntelligentTestRunner(options?.baseUrl);

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
    });

  program
    .command('test-workflow-enhanced')
    .description(
      'Complete enhanced testing workflow: spec generation → test generation → intelligent execution',
    )
    .argument('<codebaseDir>', 'Root directory of the codebase to analyze and test')
    .option('--base-url <baseUrl>', 'Base URL for the API under test', 'http://localhost:3000')
    .option('--output <outputDir>', 'Output directory for all results', './spectra-enhanced-tests')
    .action(async (codebaseDir: string, options?: any) => {
      try {
        console.log('🚀 Enhanced Testing Workflow: Spec → Tests → Execution');
        console.log(`📁 Codebase: ${codebaseDir}`);

        const outputDir = options?.output || './spectra-enhanced-tests';
        const baseUrl = options?.baseUrl || 'http://localhost:3000';

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
          const testSuiteData = JSON.parse(fs.readFileSync(path.join(testsDir, testFile), 'utf-8'));

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
    });
}

// Helper functions

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
 * Example config file structure for batch processing:
 * {
 *   "codebases": [
 *     {
 *       "name": "backend-api",
 *       "path": "./examples/backend",
 *       "baseUrl": "http://localhost:3000"
 *     },
 *     {
 *       "name": "user-service",
 *       "path": "../other-project",
 *       "baseUrl": "http://localhost:4000"
 *     }
 *   ]
 * }
 */

import { Command } from 'commander';
import { EnhancedSpecIntegration } from '../integrations/enhancedSpecIntegration';
import { EnhancedTestGenerator } from '../agents/enhancedTestGenerator';
import { IntelligentTestRunner } from '../runners/intelligentTestRunner';
import path from 'path';
import * as fs from 'fs';
import { ModernDashboardService } from '../services/modernDashboardService';
// LangGraph Testing Agent will be imported dynamically

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
    .description('Generate comprehensive test suites using LangGraph + LRASGen methodology')
    .argument('<openApiSpecPath>', 'Path to OpenAPI/Swagger specification file')
    .option('--output <outputDir>', 'Output directory for generated tests', 'tests')
    .option('--endpoint <endpoint>', 'Generate tests for specific endpoint only')
    .action(async (openApiSpecPath: string, options?: any) => {
      try {
        console.log('🧠 Enhanced Test Generation with LangGraph + LRASGen');
        console.log(`📖 Using spec: ${openApiSpecPath}`);

        // Handle output directory correctly - relative to current working directory if starts with ./
        let outputDir: string;
        if (options?.output) {
          if (path.isAbsolute(options.output)) {
            // Absolute path - use as is
            outputDir = options.output;
          } else if (options.output.startsWith('./') || options.output.startsWith('../')) {
            // Relative to current working directory
            outputDir = path.resolve(options.output);
          } else {
            // Relative to schema directory
            const schemaDir = path.dirname(path.resolve(openApiSpecPath));
            outputDir = path.join(schemaDir, options.output);
          }
        } else {
          // Default: relative to schema directory
          const schemaDir = path.dirname(path.resolve(openApiSpecPath));
          outputDir = path.join(schemaDir, 'tests');
        }

        console.log(`📁 Tests will be saved to: ${outputDir}`);

        // Load OpenAPI specification
        if (!fs.existsSync(openApiSpecPath)) {
          throw new Error(`OpenAPI spec file not found: ${openApiSpecPath}`);
        }

        const apiSchema = JSON.parse(fs.readFileSync(openApiSpecPath, 'utf-8'));

        // Create output directory
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const testGenerator = new EnhancedTestGenerator();

        // Generate tests for all endpoints or specific endpoint
        const endpoints = extractEndpointsFromSchema(apiSchema);

        let targetEndpoints = endpoints;
        if (options?.endpoint) {
          targetEndpoints = endpoints.filter((ep) => ep.path === options.endpoint);

          if (targetEndpoints.length === 0) {
            throw new Error(`Endpoint not found: ${options.endpoint}`);
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
    .description(
      'Execute tests using intelligent adaptive test runner with AI-driven decision making',
    )
    .argument('<testSuiteDir>', 'Directory containing enhanced test suites')
    .option('--base-url <baseUrl>', 'Base URL for the API under test', 'http://localhost:3000')
    .option('--output <outputDir>', 'Output directory for results', 'test-results')
    .option('--enable-adaptation', 'Enable AI-driven test adaptation', true)
    .option('--failure-threshold <threshold>', 'Maximum failure threshold (0-1)', '0.3')
    .action(async (testSuiteDir: string, options?: any) => {
      try {
        const { baseUrl = 'http://localhost:3000', output = 'test-results' } = options || {};

        console.log('🧠 Intelligent Test Execution with AI-powered adaptation');
        console.log(`📁 Test Suites: ${testSuiteDir}`);
        console.log(`🌐 Base URL: ${baseUrl}`);

        // Handle output directory correctly - relative to current working directory if starts with ./
        let outputDir: string;
        if (output) {
          if (path.isAbsolute(output)) {
            // Absolute path - use as is
            outputDir = output;
          } else if (output.startsWith('./') || output.startsWith('../')) {
            // Relative to current working directory
            outputDir = path.resolve(output);
          } else {
            // Relative to testSuiteDir parent directory
            const testSuiteParentDir = path.dirname(path.resolve(testSuiteDir));
            outputDir = path.join(testSuiteParentDir, output);
          }
        } else {
          // Default: relative to testSuiteDir parent directory
          const testSuiteParentDir = path.dirname(path.resolve(testSuiteDir));
          outputDir = path.join(testSuiteParentDir, 'test-results');
        }

        console.log(`📊 Results will be saved to: ${outputDir}`);

        if (!fs.existsSync(testSuiteDir)) {
          throw new Error(`Test suite directory not found: ${testSuiteDir}`);
        }

        // Create output directory if it doesn't exist
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const intelligentRunner = new IntelligentTestRunner(baseUrl);

        // Load test suites
        const testFiles = fs
          .readdirSync(testSuiteDir)
          .filter((file) => file.endsWith('_tests.json'));

        if (testFiles.length === 0) {
          throw new Error('No test files found in directory');
        }

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

        // Generate modern dashboard
        console.log('\n🎨 Generating modern dashboard...');
        const dashboardService = new ModernDashboardService();
        const codebaseDir = path.dirname(path.resolve(testSuiteDir));
        dashboardService.generateDashboard(codebaseDir, {
          title: 'Spectra Test Execution Results',
          theme: 'light',
        });
      } catch (error) {
        console.error('❌ Intelligent test execution failed:', error);
        process.exit(1);
      }
    });

  program
    .command('test-workflow-enhanced')
    .description(
      'Complete enhanced testing workflow: Spec → Tests → Execution with LangGraph + LRASGen',
    )
    .argument('<codebaseDir>', 'Root directory of the codebase to analyze')
    .option('--base-url <baseUrl>', 'Base URL for the API under test', 'http://localhost:3000')
    .option('--output <outputDir>', 'Output directory for all results', 'spectra-enhanced-tests')
    .action(async (codebaseDir: string, options?: any) => {
      try {
        const { baseUrl = 'http://localhost:3000', output = 'spectra-enhanced-tests' } =
          options || {};

        console.log('🚀 Enhanced Testing Workflow: Spec → Tests → Execution');
        console.log(`📁 Codebase: ${codebaseDir}`);
        console.log(`🌐 Base URL: ${baseUrl}`);

        // Handle output directory correctly - relative to current working directory if starts with ./
        const resolvedCodebaseDir = path.resolve(codebaseDir);
        let outputDir: string;
        if (output) {
          if (path.isAbsolute(output)) {
            // Absolute path - use as is
            outputDir = output;
          } else if (output.startsWith('./') || output.startsWith('../')) {
            // Relative to current working directory
            outputDir = path.resolve(output);
          } else {
            // Relative to codebase directory
            outputDir = path.join(resolvedCodebaseDir, output);
          }
        } else {
          // Default: relative to codebase directory
          outputDir = path.join(resolvedCodebaseDir, 'spectra-enhanced-tests');
        }

        console.log(`📁 Results will be saved to: ${outputDir}`);

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

        // Generate comprehensive modern dashboard
        console.log('\n🎨 Generating comprehensive modern dashboard...');
        const dashboardService = new ModernDashboardService();
        dashboardService.generateDashboard(resolvedCodebaseDir, {
          title: 'Spectra Enhanced Testing Dashboard',
          theme: 'light',
        });

        console.log(
          `🌐 Open ${path.join(resolvedCodebaseDir, 'spectra-dashboard', 'index.html')} to view the dashboard`,
        );
      } catch (error) {
        console.error('❌ Enhanced testing workflow failed:', error);
        process.exit(1);
      }
    });

  program
    .command('generate-dashboard')
    .description('Generate enhanced HTML dashboard from existing test results and enhanced tests')
    .argument('<codebaseDir>', 'Root directory of the codebase containing test results')
    .option('--title <title>', 'Dashboard title', 'Spectra Enhanced Dashboard')
    .option('--include-tests', 'Include enhanced test suites in dashboard', true)
    .option('--include-results', 'Include test execution results in dashboard', true)
    .action(async (codebaseDir: string, options?: any) => {
      try {
        console.log('🎨 Generating enhanced HTML dashboard...');
        console.log(`📁 Scanning: ${codebaseDir}`);

        const resolvedCodebaseDir = path.resolve(codebaseDir);

        const dashboardService = new ModernDashboardService();
        dashboardService.generateDashboard(resolvedCodebaseDir, {
          title: options?.title || 'Spectra Enhanced Dashboard',
          theme: 'light',
        });

        const dashboardPath = path.join(resolvedCodebaseDir, 'spectra-dashboard', 'index.html');
        console.log(`\n🌐 Dashboard generated successfully!`);
        console.log(`🔗 Open: ${dashboardPath}`);
        console.log(
          `📱 Or run: open "${dashboardPath}" (macOS) or start "${dashboardPath}" (Windows)`,
        );
      } catch (error) {
        console.error('❌ Dashboard generation failed:', error);
        process.exit(1);
      }
    });

  program
    .command('run-langgraph-intelligent-testing')
    .description('Run LangGraph intelligent testing on a given API spec')
    .argument('<apiSpecPath>', 'Path to OpenAPI/Swagger specification file')
    .action(async (apiSpecPath: string) => {
      try {
        console.log('🚀 [LANGGRAPH] Starting LangGraph intelligent testing...');
        console.log('📄 API Spec:', apiSpecPath);

        // Import the LangGraph testing agent
        const { LangGraphTestingAgent } = await import('../agents/langGraphTestingAgent');

        // Load and parse OpenAPI spec
        if (!fs.existsSync(apiSpecPath)) {
          throw new Error(`API spec file not found: ${apiSpecPath}`);
        }

        const specContent = fs.readFileSync(apiSpecPath, 'utf-8');
        const apiSpec = JSON.parse(specContent);

        console.log('🧠 [LANGGRAPH] Initializing intelligent testing agent...');
        const agent = new LangGraphTestingAgent();

        console.log('🎯 [LANGGRAPH] Executing intelligent testing workflow...');

        // Determine output directory based on API spec path
        const path = await import('path');
        const outputDir = path.dirname(apiSpecPath);

        const result = await agent.executeIntelligentTesting(apiSpec, outputDir);

        // Display results
        console.log('\n🎉 [LANGGRAPH] Intelligent testing completed!');
        console.log('═══════════════════════════════════════════════════════════');

        console.log(`📊 Phase: ${result.currentPhase}`);
        console.log(`🔍 System Map:
        📍 Endpoints: ${result.systemMap?.endpoints.length || 0}
        📋 Schemas: ${result.systemMap?.schemas.length || 0}
        🔄 Data Flows: ${result.systemMap?.dataFlow.length || 0}
        🔗 Dependencies: ${result.systemMap?.dependencies.length || 0}`);

        console.log(`🤖 Test Scenarios: ${result.testScenarios.length}`);
        console.log(`🥒 Gherkin Features: ${result.gherkinFeatures.length}`);
        console.log(
          `📋 BDD Scenarios: ${result.gherkinFeatures.reduce((sum, f) => sum + f.scenarios.length, 0)}`,
        );
        console.log(`✅ Test Results: ${result.testResults.length}`);

        if (result.analysis) {
          console.log(`📈 Success Rate: ${result.analysis.overallSuccessRate}%`);
          console.log(`⚠️  Critical Issues: ${result.analysis.criticalIssues.length}`);
          console.log(`🔍 Patterns Found: ${result.analysis.patterns.length}`);
          console.log(`📊 Risk Level: ${result.analysis.riskAssessment.level}`);
        }

        console.log(`💡 Recommendations: ${result.recommendations.length}`);

        // Show detailed test results
        console.log('\n📋 Test Results Breakdown:');
        console.log('═══════════════════════════════════════════════════════════');

        const resultsByType = result.testResults.reduce(
          (acc, test) => {
            const scenario = result.testScenarios.find((s) => s.id === test.scenarioId);
            const type = scenario?.type || 'unknown';
            if (!acc[type]) acc[type] = { total: 0, passed: 0 };
            acc[type].total++;
            if (test.success) acc[type].passed++;
            return acc;
          },
          {} as Record<string, { total: number; passed: number }>,
        );

        Object.entries(resultsByType).forEach(([type, stats]) => {
          const successRate = ((stats.passed / stats.total) * 100).toFixed(1);
          console.log(`${type.toUpperCase()}: ${stats.passed}/${stats.total} (${successRate}%)`);
        });

        // Show insights
        const allInsights = result.testResults.flatMap((r) => r.insights);
        if (allInsights.length > 0) {
          console.log('\n💡 Key Insights:');
          console.log('═══════════════════════════════════════════════════════════');
          [...new Set(allInsights)].slice(0, 5).forEach((insight, i) => {
            console.log(`${i + 1}. ${insight}`);
          });
        }

        // Show recommendations
        if (result.recommendations.length > 0) {
          console.log('\n🔧 Recommendations:');
          console.log('═══════════════════════════════════════════════════════════');
          result.recommendations.slice(0, 5).forEach((rec, i) => {
            console.log(`${i + 1}. ${rec}`);
          });
        }

        console.log('\n📁 [GHERKIN] Gherkin features exported to features/ directory');
        console.log('\n🎯 [LANGGRAPH] LangGraph intelligent testing completed successfully!');
      } catch (error) {
        console.error('❌ [LANGGRAPH] Error running LangGraph testing:', error);
        throw error;
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

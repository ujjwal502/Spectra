import { Command } from 'commander';
import path from 'path';
import * as fs from 'fs';

export function addEnhancedCommands(program: Command): void {
  program
    .command('run-intelligent-testing')
    .description('Run intelligent testing on a given API spec')
    .argument('<apiSpecPath>', 'Path to OpenAPI/Swagger specification file')
    .option('--base-url <url>', 'Override base URL used for requests (e.g., http://host.docker.internal:3000)')
    .option('--code-root <path>', 'Root directory of the API codebase for context')
    .option('--context-depth <n>', 'Approximate context token budget per prompt', '1200')
    .option('--self-heal', 'Enable one or more self-heal retries on failure', false)
    .option('--max-retries <n>', 'Max retries for self-heal', '1')
    .action(async (apiSpecPath: string, opts: any) => {
      try {
        console.log('Starting intelligent testing...');
        console.log('📄 API Spec:', apiSpecPath);

        console.log("Ujjwal is running")

        if (opts.baseUrl) {
          process.env.SPECTRA_BASE_URL = opts.baseUrl;
          console.log('🌐 Base URL override provided via --base-url:', opts.baseUrl);
        }

        // Import the LangGraph testing agent
        const { LangGraphTestingAgent } = await import('../agents/langGraphTestingAgent');

        // Load and parse OpenAPI spec
        if (!fs.existsSync(apiSpecPath)) {
          throw new Error(`API spec file not found: ${apiSpecPath}`);
        }

        const specContent = fs.readFileSync(apiSpecPath, 'utf-8');
        const apiSpec = JSON.parse(specContent);

        console.log('🧠 Initializing intelligent testing agent...');
        const agent = new LangGraphTestingAgent({
          codeRoot: opts.codeRoot,
          contextDepth: parseInt(opts.contextDepth || '1200', 10),
          selfHeal: !!opts.selfHeal,
          maxRetries: parseInt(opts.maxRetries || '1', 10),
        });

        console.log('🎯 Executing intelligent testing workflow...');

        // Determine output directory based on API spec path
        const path = await import('path');
        const outputDir = path.dirname(apiSpecPath);

        const result = await agent.executeIntelligentTesting(apiSpec, outputDir);

        // Display results
        console.log('\n🎉 Intelligent testing completed!');
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
        console.log('\n🎯 Intelligent testing completed successfully!');
      } catch (error) {
        console.error('❌ Error running intelligent testing:', error);
        throw error;
      }
    });

  program
    .command('llm-curl')
    .description('Generate and execute cURL requests using LLM from an OpenAPI spec')
    .argument('<apiSpecPath>', 'Path to OpenAPI/Swagger specification file')
    .option('--base-url <url>', 'Override base URL used for requests')
    .option('--max-steps <n>', 'Maximum number of steps to request from LLM', '10')
    .option('--report', 'Generate JSON and HTML reports', false)
    .option('--out <dir>', 'Output directory for reports (defaults next to spec)', '')
    .action(async (apiSpecPath: string, opts: any) => {
      try {
        console.log('🧪 LLM-cURL Mode');
        console.log('📄 API Spec:', apiSpecPath);

        if (!fs.existsSync(apiSpecPath)) {
          throw new Error(`API spec file not found: ${apiSpecPath}`);
        }

        const specContent = fs.readFileSync(apiSpecPath, 'utf-8');
        const apiSpec = JSON.parse(specContent);

        // Validate spec with swagger-parser
        const { validateOpenApiSpec } = await import('../utils/specValidator');
        const validation = await validateOpenApiSpec(apiSpec);
        if (!validation.valid) {
          console.error('❌ OpenAPI validation failed:');
          for (const err of validation.errors || []) console.error(`  - ${err}`);
          process.exit(1);
        }
        console.log('✅ OpenAPI spec is valid. Proceeding with LLM cURL generation...');

        const { AIService } = await import('../services/aiService');
        const ai = new AIService();

        // Ask LLM for a simple functional step plan (JSON)
        const steps = await ai.generateCurlPlanFromSpec(apiSpec, parseInt(opts.maxSteps || '10', 10));

        // Ask LLM for categorized scenarios as well
        const categorized = await ai.generateCategorizedScenariosFromSpec(apiSpec, parseInt(opts.maxSteps || '10', 10));

        // Merge to a unified scenario list: functional steps + categorized
        const scenarios: any[] = [];
        // map steps -> minimal functional scenarios
        steps.forEach((step: any, idx: number) => {
          scenarios.push({
            id: String(step.id || `llm_${idx + 1}`),
            type: 'functional',
            endpoint: String(step.path || '/'),
            method: String(step.method || 'GET').toUpperCase(),
            description: `LLM step ${idx + 1}: ${String(step.method || 'GET').toUpperCase()} ${String(step.path || '/')}`,
            intent: 'LLM-generated functional test',
            testData: { ...(step.pathParams || {}), ...(step.query || {}), ...(step.body || {}) },
            expectedOutcome: { statusCode: Array.isArray(step.expect?.status) ? step.expect.status[0] : step.expect?.status ?? 200 },
            headers: step.headers || {},
          });
        });
        // add categorized scenarios (functional/security/performance/reliability/boundary)
        const addCat = (list: any[], type: string) => {
          (list || []).forEach((s: any, i: number) => {
            scenarios.push({
              id: String(s.id || `${type}_${i + 1}`),
              type,
              endpoint: String(s.endpoint || '/'),
              method: String(s.method || 'GET').toUpperCase(),
              description: s.description || `${type} scenario`,
              intent: s.intent || `${type} test`,
              testData: s.request || {},
              expectedOutcome: { statusCode: Array.isArray(s.expected?.status) ? s.expected.status[0] : s.expected?.status ?? 200 },
              headers: s.headers || {},
            });
          });
        };
        addCat(categorized.functional, 'functional');
        addCat(categorized.security, 'security');
        addCat(categorized.performance, 'performance');
        addCat(categorized.reliability, 'reliability');
        addCat(categorized.boundary, 'boundary');

        const { CurlRunner } = await import('../runners/curlRunner');
        const runner = new CurlRunner(opts.baseUrl || '');

        const execResults: any[] = [];
        for (const sc of scenarios) {
          const started = Date.now();
          try {
            // Build request object from scenario
            const request: any = sc.testData || {};
            let endpoint = sc.endpoint || '/';
            // Substitute path params from request where present
            Object.keys(request).forEach((k) => {
              if (endpoint.includes(`{${k}}`)) {
                endpoint = endpoint.replace(`{${k}}`, String(request[k]));
                delete request[k];
              }
            });
            const testCase: any = {
              id: sc.id,
              endpoint,
              method: String(sc.method || 'GET').toUpperCase(),
              request,
              headers: sc.headers || {},
              expectedResponse: { status: sc.expectedOutcome?.statusCode || 200 },
              files: [],
            };
            const result = await runner.executeTest(testCase);
            execResults.push({ id: sc.id, success: result.success, status: result.response?.status, duration: result.duration });
          } catch (e: any) {
            execResults.push({ id: sc.id, success: false, error: e.message, duration: Date.now() - started });
          }
        }

        const passed = execResults.filter((r) => r.success).length;
        console.log(`\n✅ Passed: ${passed}/${execResults.length}`);

        // Optional reporting
        const pathMod = await import('path');
        const outDir = opts.out || pathMod.join(pathMod.dirname(apiSpecPath), 'spectra', 'llm-curl');
        if (opts.report) {
          const { writeJsonReport, writeHtmlReport } = await import('../utils/report');
          const jsonFile = writeJsonReport({
            timestamp: new Date().toISOString(),
            sourceSpec: apiSpecPath,
            baseUrl: opts.baseUrl || '',
            total: execResults.length,
            passed,
            failed: execResults.length - passed,
            results: execResults.map((r: any) => ({ id: r.id, success: !!r.success, status: r.status, duration: r.duration, error: r.error })),
          }, outDir);
          const htmlFile = writeHtmlReport({
            timestamp: new Date().toISOString(),
            sourceSpec: apiSpecPath,
            baseUrl: opts.baseUrl || '',
            total: execResults.length,
            passed,
            failed: execResults.length - passed,
            results: execResults.map((r: any) => ({ id: r.id, success: !!r.success, status: r.status, duration: r.duration, error: r.error })),
          }, outDir);
          console.log(`📝 Report saved: ${jsonFile}`);
          console.log(`📝 Report saved: ${htmlFile}`);
        }

        // Full detailed report artifacts (scenarios, test-cases, dashboard)
        const { writeFullLlmReports } = await import('../utils/llmFullReport');
        await writeFullLlmReports(apiSpecPath, apiSpec, scenarios, execResults, outDir);
        console.log(`📝 Full detailed reports saved under: ${outDir}`);

        process.exit(passed === execResults.length ? 0 : 1);
      } catch (error) {
        console.error('❌ Error in llm-curl:', error);
        process.exit(1);
      }
    });

  program
    .command('llm-scenarios')
    .description('Generate functional, security, performance scenarios from an OpenAPI spec using LLM')
    .argument('<apiSpecPath>', 'Path to OpenAPI/Swagger specification file')
    .option('--max <n>', 'Max scenarios per category', '10')
    .action(async (apiSpecPath: string, opts: any) => {
      try {
        console.log('🧠 LLM-Scenarios Mode');
        console.log('📄 API Spec:', apiSpecPath);

        if (!fs.existsSync(apiSpecPath)) {
          throw new Error(`API spec file not found: ${apiSpecPath}`);
        }

        const specContent = fs.readFileSync(apiSpecPath, 'utf-8');
        const apiSpec = JSON.parse(specContent);

        // Validate spec
        const { validateOpenApiSpec } = await import('../utils/specValidator');
        const validation = await validateOpenApiSpec(apiSpec);
        if (!validation.valid) {
          console.error('❌ OpenAPI validation failed:');
          for (const err of validation.errors || []) console.error(`  - ${err}`);
          process.exit(1);
        }

        const { AIService } = await import('../services/aiService');
        const ai = new AIService();
        const scenarios = await ai.generateCategorizedScenariosFromSpec(apiSpec, parseInt(opts.max || '10', 10));

        // Print JSON to stdout only
        console.log(JSON.stringify(scenarios, null, 2));
      } catch (error) {
        console.error('❌ Error in llm-scenarios:', error);
        process.exit(1);
      }
    });
}

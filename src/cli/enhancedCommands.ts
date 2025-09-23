import { Command } from 'commander';
import path from 'path';
import * as fs from 'fs';

export function addEnhancedCommands(program: Command): void {
  program
    .command('run-intelligent-testing')
    .description('Run intelligent testing (LLM-only unified flow) on a given API spec')
    .argument('<apiSpecPath>', 'Path to OpenAPI/Swagger specification file')
    .option('--base-url <url>', 'Override base URL used for requests (e.g., http://host.docker.internal:3000)')
    .option('--auth-bearer <token>', 'Add Authorization: Bearer <token> to all requests')
    .option('-H, --header <key:value...>', 'Add arbitrary headers to all requests (repeatable)')
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

        console.log('🧠 Initializing intelligent testing agent (LLM-only unified)...');

        // Build global headers from CLI options
        const globalHeaders: Record<string, string> = {};
        if (opts.authBearer) {
          globalHeaders['Authorization'] = `Bearer ${opts.authBearer}`;
        }
        if (opts.header) {
          const headerEntries: string[] = Array.isArray(opts.header) ? opts.header : [opts.header];
          for (const h of headerEntries) {
            const idx = String(h).indexOf(':');
            if (idx > 0) {
              const k = String(h).slice(0, idx).trim();
              const v = String(h).slice(idx + 1).trim();
              if (k) globalHeaders[k] = v;
            }
          }
        }
        const agent = new LangGraphTestingAgent({
          headers: Object.keys(globalHeaders).length ? globalHeaders : undefined,
        });

        console.log('🎯 Executing intelligent testing workflow...');

        // Determine output directory based on API spec path
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

  // Deprecate old commands by routing to unified flow
  program
    .command('llm-curl')
    .description('[Deprecated] Use run-intelligent-testing instead. This routes to the unified flow.')
    .argument('<apiSpecPath>', 'Path to OpenAPI/Swagger specification file')
    .allowUnknownOption(true)
    .action(async (apiSpecPath: string, _opts: any) => {
      console.log('⚠️  llm-curl is deprecated. Routing to run-intelligent-testing (unified flow)...');
      const args = process.argv.filter((a) => !a.includes('llm-curl'));
      args.splice(args.indexOf('enhanced.ts') + 1, 0, 'run-intelligent-testing');
      process.argv = args;
      await import('./enhanced');
    });

  program
    .command('llm-scenarios')
    .description('[Deprecated] Scenarios are generated within the unified flow. Use run-intelligent-testing.')
    .argument('<apiSpecPath>', 'Path to OpenAPI/Swagger specification file')
    .allowUnknownOption(true)
    .action(async (_apiSpecPath: string) => {
      console.log('⚠️  llm-scenarios is deprecated. Use run-intelligent-testing to generate and execute scenarios.');
      process.exit(0);
    });
}

import { Command } from 'commander';
import path from 'path';
import * as fs from 'fs';

export function addEnhancedCommands(program: Command): void {
  program
    .command('run-intelligent-testing')
    .description('Run intelligent testing on a given API spec')
    .argument('<apiSpecPath>', 'Path to OpenAPI/Swagger specification file')
    .option('--code-root <path>', 'Root directory of the API codebase for context')
    .option('--context-depth <n>', 'Approximate context token budget per prompt', '1200')
    .option('--self-heal', 'Enable one or more self-heal retries on failure', false)
    .option('--max-retries <n>', 'Max retries for self-heal', '1')
    .action(async (apiSpecPath: string, opts: any) => {
      try {
        console.log('Starting intelligent testing...');
        console.log('📄 API Spec:', apiSpecPath);

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
}

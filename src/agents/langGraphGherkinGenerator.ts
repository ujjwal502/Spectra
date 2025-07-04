import { AzureChatOpenAI } from '@langchain/openai';
import {
  TestingState,
  GherkinFeature,
  GherkinScenario,
  GherkinStep,
  GherkinSummary,
  TestScenario,
  SystemMap,
  EndpointInfo,
} from '../types/langGraphTypes';
import { AzureAIService } from '../services/azureAIService';

/**
 * LangGraph Gherkin Generator with Azure OpenAI
 * Converts test scenarios into comprehensive Gherkin features with business context
 */
export class LangGraphGherkinGenerator {
  private model: AzureChatOpenAI;
  private azureAIService: AzureAIService;

  constructor() {
    this.azureAIService = new AzureAIService();
    this.model = this.azureAIService.getChatModel();
    
    console.log('🔧 [LANGGRAPH GHERKIN GENERATOR] Initialized with Azure OpenAI');
  }

  /**
   * Generate comprehensive Gherkin features from test scenarios
   */
  async generateGherkinFeatures(state: TestingState): Promise<TestingState> {
    console.log('🥒 [GHERKIN GENERATOR] Generating comprehensive Gherkin features...');

    if (!state.systemMap || !state.testScenarios.length) {
      console.log('⚠️ [GHERKIN GENERATOR] No system map or test scenarios found');
      return {
        ...state,
        gherkinFeatures: [],
        gherkinSummary: {
          totalFeatures: 0,
          totalScenarios: 0,
          featuresByDomain: {},
          scenariosByType: {},
          coverageMetrics: {
            endpointsCovered: 0,
            businessRulesCovered: 0,
            errorScenariosCovered: 0,
          },
        },
      };
    }

    const gherkinFeatures: GherkinFeature[] = [];

    // Group test scenarios by endpoint for better feature organization
    const scenariosByEndpoint = this.groupScenariosByEndpoint(state.testScenarios);

    // Generate features for each endpoint
    for (const [endpointKey, scenarios] of Object.entries(scenariosByEndpoint)) {
      const endpoint = this.findEndpointInfo(endpointKey, state.systemMap);
      if (!endpoint) continue;

      const feature = await this.generateFeatureForEndpoint(endpoint, scenarios, state.systemMap);
      if (feature) {
        gherkinFeatures.push(feature);
      }
    }

    // Generate summary
    const gherkinSummary = this.generateGherkinSummary(gherkinFeatures, state.testScenarios);

    console.log(`🥒 [GHERKIN GENERATOR] Generated ${gherkinFeatures.length} Gherkin features`);
    console.log(`📊 [GHERKIN GENERATOR] Total scenarios: ${gherkinSummary.totalScenarios}`);

    return {
      ...state,
      gherkinFeatures,
      gherkinSummary,
      currentPhase: 'execution',
      messages: [
        ...state.messages,
        `Gherkin generation complete. Created ${gherkinFeatures.length} features with ${gherkinSummary.totalScenarios} scenarios.`,
      ],
    };
  }

  /**
   * Generate a comprehensive Gherkin feature for a specific endpoint
   */
  private async generateFeatureForEndpoint(
    endpoint: EndpointInfo,
    scenarios: TestScenario[],
    systemMap: SystemMap,
  ): Promise<GherkinFeature | null> {
    console.log(`🥒 [FEATURE GENERATION] Creating feature for ${endpoint.method} ${endpoint.path}`);

    try {
      const businessDomain = this.inferBusinessDomain(endpoint);

      const prompt = `
      Create a comprehensive Gherkin feature for this API endpoint following BDD best practices:

      ENDPOINT: ${endpoint.method} ${endpoint.path}
      BUSINESS DOMAIN: ${businessDomain}
      
      ENDPOINT DETAILS:
      - Parameters: ${endpoint.parameters.map((p) => `${p.name} (${p.type}${p.required ? ', required' : ''})`).join(', ')}
      - Request Body: ${endpoint.requestBody ? JSON.stringify(endpoint.requestBody.properties, null, 2) : 'None'}
      - Responses: ${endpoint.responses.map((r) => `${r.statusCode}: ${r.description}`).join(', ')}

      TEST SCENARIOS TO CONVERT:
      ${scenarios
        .map(
          (s) => `
      - ${s.type.toUpperCase()}: ${s.description}
        Intent: ${s.intent}
        Expected: ${s.expectedOutcome.statusCode}
        Dependencies: ${s.dependencies.length > 0 ? s.dependencies.join(', ') : 'None'}
        Data: ${JSON.stringify(s.testData, null, 2)}
      `,
        )
        .join('\n')}

      RELATED ENDPOINTS: ${endpoint.relatedEndpoints.join(', ')}

             Create a Gherkin feature that:
       1. Uses business-focused language (not technical jargon)
       2. Includes a meaningful background for data setup
       3. Converts each test scenario into a proper Gherkin scenario
       4. Uses appropriate tags (@functional, @security, @boundary, @error, @integration)
       5. Includes realistic examples and data tables where appropriate
       6. Follows Given-When-Then structure correctly
       7. Makes scenarios understandable to stakeholders
       8. For integration scenarios, describe the workflow clearly
       9. For validation scenarios, specify the exact validation being tested
       10. Include setup requirements for dependent scenarios

      Respond with JSON in this exact format:
      {
        "title": "Feature title in business terms",
        "description": "What business value this endpoint provides",
        "background": {
          "title": "Common setup needed",
          "steps": [
            {"keyword": "Given", "text": "setup step"},
            {"keyword": "And", "text": "additional setup"}
          ]
        },
        "scenarios": [
          {
            "title": "Business-focused scenario name",
            "description": "What this scenario validates",
            "tags": ["functional", "critical"],
            "steps": [
              {"keyword": "Given", "text": "precondition"},
              {"keyword": "When", "text": "action"},
              {"keyword": "Then", "text": "expected outcome"},
              {"keyword": "And", "text": "additional verification"}
            ],
            "testScenarioId": "original_test_scenario_id"
          }
        ],
        "tags": ["api", "users", "crud"]
      }
      `;

      const response = await this.model.invoke(prompt);
      const gherkinData = this.parseAIResponse(response.content as string);

      if (!gherkinData || !gherkinData.title) {
        console.log(
          `⚠️ [FEATURE GENERATION] Failed to generate valid Gherkin for ${endpoint.path}`,
        );
        return null;
      }

      // Link scenarios back to test scenarios
      if (gherkinData.scenarios) {
        gherkinData.scenarios.forEach((scenario: any, index: number) => {
          if (scenarios[index]) {
            scenario.testScenarioId = scenarios[index].id;
          }
        });
      }

      const feature: GherkinFeature = {
        title: gherkinData.title,
        description: gherkinData.description || '',
        background: gherkinData.background,
        scenarios: gherkinData.scenarios || [],
        tags: gherkinData.tags || [],
        endpointContext: {
          path: endpoint.path,
          method: endpoint.method,
          businessDomain,
        },
      };

      console.log(
        `✅ [FEATURE GENERATION] Created feature "${feature.title}" with ${feature.scenarios.length} scenarios`,
      );

      return feature;
    } catch (error) {
      console.error(
        `❌ [FEATURE GENERATION] Error generating Gherkin for ${endpoint.path}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Export Gherkin features to standard .feature files
   */
  async exportGherkinFiles(gherkinFeatures: GherkinFeature[], outputDir: string): Promise<void> {
    console.log('📁 [GHERKIN EXPORT] Exporting Gherkin features to .feature files...');

    const fs = await import('fs');
    const path = await import('path');

    const gherkinDir = path.join(outputDir, 'spectra', 'features');
    if (!fs.existsSync(gherkinDir)) {
      fs.mkdirSync(gherkinDir, { recursive: true });
    }

    for (const feature of gherkinFeatures) {
      const featureContent = this.convertToGherkinFormat(feature);
      const sanitizedTitle = feature.title
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .toLowerCase();
      const filename = `${sanitizedTitle}.feature`;
      const filepath = path.join(gherkinDir, filename);

      fs.writeFileSync(filepath, featureContent);
      console.log(`📄 [GHERKIN EXPORT] Exported: ${filename}`);
    }

    // Also create a summary file
    const summaryContent = this.generateFeaturesSummary(gherkinFeatures);
    fs.writeFileSync(path.join(gherkinDir, 'README.md'), summaryContent);

    console.log(
      `✅ [GHERKIN EXPORT] Exported ${gherkinFeatures.length} feature files to ${gherkinDir}`,
    );
  }

  /**
   * Convert GherkinFeature to standard Gherkin format
   */
  private convertToGherkinFormat(feature: GherkinFeature): string {
    let content = '';

    // Feature tags
    if (feature.tags.length > 0) {
      content += `@${feature.tags.join(' @')}\n`;
    }

    // Feature header
    content += `Feature: ${feature.title}\n`;

    if (feature.description) {
      content += `\n  ${feature.description}\n`;
    }

    // Background
    if (feature.background) {
      content += `\n  Background: ${feature.background.title}\n`;
      for (const step of feature.background.steps) {
        content += `    ${step.keyword} ${step.text}\n`;
      }
    }

    // Scenarios
    for (const scenario of feature.scenarios) {
      content += '\n';

      // Scenario tags
      if (scenario.tags.length > 0) {
        content += `  @${scenario.tags.join(' @')}\n`;
      }

      // Scenario header
      content += `  Scenario: ${scenario.title}\n`;

      if (scenario.description) {
        content += `    ${scenario.description}\n`;
      }

      // Steps
      for (const step of scenario.steps) {
        content += `    ${step.keyword} ${step.text}\n`;

        // Doc string
        if (step.docString) {
          content += `      """\n      ${step.docString}\n      """\n`;
        }

        // Data table
        if (step.dataTable) {
          for (const row of step.dataTable) {
            content += `      | ${row.join(' | ')} |\n`;
          }
        }
      }

      // Examples table
      if (scenario.examples) {
        content += `\n    Examples:\n`;
        content += `      | ${scenario.examples.headers.join(' | ')} |\n`;
        for (const row of scenario.examples.rows) {
          content += `      | ${row.join(' | ')} |\n`;
        }
      }
    }

    return content;
  }

  /**
   * Generate a summary document for all features
   */
  private generateFeaturesSummary(gherkinFeatures: GherkinFeature[]): string {
    let summary = `# Gherkin Features Summary\n\n`;
    summary += `**Generated:** ${new Date().toISOString()}\n`;
    summary += `**Total Features:** ${gherkinFeatures.length}\n`;
    summary += `**Total Scenarios:** ${gherkinFeatures.reduce((sum, f) => sum + f.scenarios.length, 0)}\n\n`;

    summary += `## Features Overview\n\n`;

    for (const feature of gherkinFeatures) {
      summary += `### ${feature.title}\n`;
      summary += `**Endpoint:** ${feature.endpointContext.method} ${feature.endpointContext.path}\n`;
      summary += `**Domain:** ${feature.endpointContext.businessDomain}\n`;
      summary += `**Description:** ${feature.description}\n`;
      summary += `**Scenarios:** ${feature.scenarios.length}\n`;
      summary += `**Tags:** ${feature.tags.join(', ')}\n\n`;

      // List scenarios
      for (const scenario of feature.scenarios) {
        summary += `- **${scenario.title}** (${scenario.tags.join(', ')})\n`;
      }
      summary += '\n';
    }

    summary += `## Tag Usage\n\n`;
    const allTags = gherkinFeatures.flatMap((f) => [
      ...f.tags,
      ...f.scenarios.flatMap((s) => s.tags),
    ]);
    const tagCounts = allTags.reduce(
      (acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([tag, count]) => {
        summary += `- **@${tag}:** ${count} usages\n`;
      });

    return summary;
  }

  /**
   * Helper methods
   */
  private groupScenariosByEndpoint(scenarios: TestScenario[]): Record<string, TestScenario[]> {
    return scenarios.reduce(
      (acc, scenario) => {
        const key = `${scenario.method} ${scenario.endpoint}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(scenario);
        return acc;
      },
      {} as Record<string, TestScenario[]>,
    );
  }

  private findEndpointInfo(endpointKey: string, systemMap: SystemMap): EndpointInfo | null {
    const [method, path] = endpointKey.split(' ', 2);
    return systemMap.endpoints.find((e) => e.method === method && e.path === path) || null;
  }

  private inferBusinessDomain(endpoint: EndpointInfo): string {
    const path = endpoint.path.toLowerCase();

    if (path.includes('/users') || path.includes('/user')) return 'User Management';
    if (path.includes('/orders') || path.includes('/order')) return 'Order Processing';
    if (path.includes('/products') || path.includes('/product')) return 'Product Catalog';
    if (path.includes('/auth') || path.includes('/login')) return 'Authentication';
    if (path.includes('/payments') || path.includes('/payment')) return 'Payment Processing';
    if (path.includes('/inventory')) return 'Inventory Management';
    if (path.includes('/reports') || path.includes('/analytics')) return 'Reporting & Analytics';

    return 'General API Operations';
  }

  private generateGherkinSummary(
    features: GherkinFeature[],
    testScenarios: TestScenario[],
  ): GherkinSummary {
    const totalScenarios = features.reduce((sum, f) => sum + f.scenarios.length, 0);

    const featuresByDomain = features.reduce(
      (acc, feature) => {
        const domain = feature.endpointContext.businessDomain;
        acc[domain] = (acc[domain] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const scenariosByType = features
      .flatMap((f) => f.scenarios)
      .reduce(
        (acc, scenario) => {
          scenario.tags.forEach((tag) => {
            acc[tag] = (acc[tag] || 0) + 1;
          });
          return acc;
        },
        {} as Record<string, number>,
      );

    const uniqueEndpoints = new Set(
      features.map((f) => `${f.endpointContext.method} ${f.endpointContext.path}`),
    );
    const errorScenarios = testScenarios.filter((s) => s.type === 'error' || s.type === 'security');

    return {
      totalFeatures: features.length,
      totalScenarios,
      featuresByDomain,
      scenariosByType,
      coverageMetrics: {
        endpointsCovered: uniqueEndpoints.size,
        businessRulesCovered: testScenarios.filter((s) => s.type === 'functional').length,
        errorScenariosCovered: errorScenarios.length,
      },
    };
  }

  private parseAIResponse(content: string): any {
    try {
      // Extract JSON from AI response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.log('⚠️ [GHERKIN PARSE] Could not parse AI response');
    }

    return null;
  }
}

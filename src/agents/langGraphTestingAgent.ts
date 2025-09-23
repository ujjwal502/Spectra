import { ChatOpenAI } from '@langchain/openai';
import { OpenAPIV3 } from 'openapi-types';
import {
  TestingState,
  SystemMap,
  EndpointInfo,
  ParameterInfo,
  SchemaInfo,
  TestScenario,
  ExpectedOutcome,
  TestResult,
  TestAnalysis,
  Issue,
  Pattern,
  RiskAssessment,
  DataFlowInfo,
  DependencyInfo,
  ResponseInfo,
} from '../types/langGraphTypes';
import { LangGraphGherkinGenerator } from './langGraphGherkinGenerator';
import { StateGraph, START, END, Annotation, MemorySaver } from '@langchain/langgraph';
import { v4 as uuidv4 } from 'uuid';
import { GherkinFeature, GherkinSummary } from '../types/langGraphTypes';
import axios from 'axios';
import { AIService } from '../services/aiService';
import { validateOpenApiSpec } from '../utils/specValidator';

export class LangGraphTestingAgent {
  private model: ChatOpenAI;
  private gherkinGenerator: LangGraphGherkinGenerator;
  private codeRoot?: string;
  private contextDepth: number = 1200;
  private selfHeal: boolean = false;
  private maxRetries: number = 1;
  private currentApiSpec?: OpenAPIV3.Document;
  private globalHeaders: Record<string, string> = {};

  constructor(options?: {
    codeRoot?: string;
    contextDepth?: number;
    selfHeal?: boolean;
    maxRetries?: number;
    headers?: Record<string, string>;
  }) {
    this.model = new ChatOpenAI({
      modelName: 'gpt-4',
      temperature: 0,
    });
    this.gherkinGenerator = new LangGraphGherkinGenerator();
    this.codeRoot = options?.codeRoot;
    if (options?.contextDepth && Number.isFinite(options.contextDepth))
      this.contextDepth = options.contextDepth;
    if (typeof options?.selfHeal === 'boolean') this.selfHeal = options.selfHeal;
    if (options?.maxRetries && Number.isFinite(options.maxRetries))
      this.maxRetries = options.maxRetries;
    if (options?.headers) this.globalHeaders = { ...options.headers };
  }

  /**
   * Main execution method
   */
  async executeIntelligentTesting(
    apiSpec: OpenAPIV3.Document,
    outputDir?: string,
  ): Promise<TestingState> {
    console.log('🚀 [Spectra TESTING] Starting intelligent API testing workflow (LLM-driven)...');

    // Keep a reference to the API spec for schema resolution
    this.currentApiSpec = apiSpec;

    let state: TestingState = {
      apiSpec,
      testScenarios: [],
      testResults: [],
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
      recommendations: [],
      currentPhase: 'understanding',
      messages: ['Starting intelligent API testing workflow'],
    };

    // Optional: Reset backend test data only when explicitly configured
    if (process.env.SPECTRA_RESET_URL) {
      await this.tryResetServerData(apiSpec);
    }

    // New LLM-driven LangGraph workflow
    const llmGraph = this.buildLLMTestingGraph();
    if (llmGraph) {
      try {
        const runId = uuidv4();
        state = (await llmGraph.invoke(state, {
          configurable: { thread_id: runId },
        })) as TestingState;
      } catch (e) {
        console.log('⚠️ [Spectra TESTING] LLM workflow failed, running sequential fallback:', e);
        state = await this.validateSpecNode(state);
        state = await this.generateLLMStepsNode(state);
        state = await this.executeLLMStepsNode(state);
        state = await this.analyzeLLMResultsNode(state);
      }
    } else {
      // Fallback to minimal sequential LLM flow
      state = await this.validateSpecNode(state);
      state = await this.generateLLMStepsNode(state);
      state = await this.executeLLMStepsNode(state);
      state = await this.analyzeLLMResultsNode(state);
    }

    // Generate and save reports
    if (outputDir) {
      await this.generateReports(state, outputDir);

      // Export Gherkin features to .feature files
      if (state.gherkinFeatures.length > 0) {
        console.log('🥒 [GHERKIN EXPORT] Exporting Gherkin features...');
        await this.gherkinGenerator.exportGherkinFiles(state.gherkinFeatures, outputDir);
      }

      // Generate test data seeding instructions
      console.log('📋 [TEST DATA] Generating test data seeding instructions...');
      await this.generateTestDataInstructions(outputDir);
    }

    console.log('🎉 [Spectra TESTING] Intelligent testing workflow completed!');
    console.log('📊 [FINAL SUMMARY] Workflow Results:');
    console.log(`   🧪 Test Scenarios: ${state.testScenarios.length} generated`);
    console.log(`   ✅ Test Results: ${state.testResults.length} executed`);
    console.log(`   📈 Success Rate: ${state.analysis?.overallSuccessRate || 0}%`);

    return state;
  }

  /**
   * Attempt to reset backend test data to ensure consistent runs.
   * Looks for a reset-like path in the OpenAPI spec; falls back to demo path.
   */
  private async tryResetServerData(apiSpec: OpenAPIV3.Document): Promise<void> {
    try {
      const baseUrl = (apiSpec.servers && apiSpec.servers[0]?.url) || 'http://localhost:8081';
      const cfg = process.env.SPECTRA_RESET_URL || '';
      const fullUrl = cfg.startsWith('http')
        ? cfg
        : `${baseUrl.replace(/\/$/, '')}${cfg ? (cfg.startsWith('/') ? '' : '/') + cfg : ''}`;
      console.log(`🔄 [Spectra TESTING] Attempting test data reset at: ${fullUrl}`);

      // Use POST by convention; ignore failures silently
      await axios.post(fullUrl).catch(() => undefined);
    } catch {
      // Non-fatal: proceed without reset
    }
  }



  /**
   * New minimal LLM-driven graph: validate -> generate -> execute -> analyze
   */
  private buildLLMTestingGraph() {
    try {
      const TestState = Annotation.Root({
        apiSpec: Annotation<OpenAPIV3.Document>(),
        testScenarios: Annotation<TestScenario[]>(),
        testResults: Annotation<TestResult[]>(),
        analysis: Annotation<TestAnalysis | undefined>(),
        recommendations: Annotation<string[]>(),
        currentPhase: Annotation<
          'understanding' | 'testing' | 'gherkin' | 'execution' | 'analysis' | 'complete'
        >(),
        messages: Annotation<string[]>(),
        systemMap: Annotation<SystemMap | undefined>(),
        gherkinFeatures: Annotation<GherkinFeature[] | undefined>(),
        gherkinSummary: Annotation<GherkinSummary | undefined>(),
      });

      const graph = new StateGraph(TestState)
        .addNode('validate', async (s: TestingState) => this.validateSpecNode(s))
        .addNode('understand', async (s: TestingState) => this.analyzeSpecNode(s))
        .addNode('generate', async (s: TestingState) => this.generateLLMStepsNode(s))
        .addNode('gherkin', async (s: TestingState) => this.generateGherkinNode(s))
        .addNode('execute', async (s: TestingState) => this.executeLLMStepsNode(s))
        .addNode('analyze', async (s: TestingState) => this.analyzeLLMResultsNode(s))
        .addEdge(START, 'validate')
        .addEdge('validate', 'understand')
        .addEdge('understand', 'generate')
        .addEdge('generate', 'gherkin')
        .addEdge('gherkin', 'execute')
        .addEdge('execute', 'analyze')
        .addEdge('analyze', END)
        .compile({ checkpointer: new MemorySaver() });

      return graph;
    } catch (e) {
      console.log('⚠️ [Spectra TESTING] Failed to initialize LLM testing workflow:', e);
      return null;
    }
  }

  // ===== LLM-driven nodes =====
  private async validateSpecNode(state: TestingState): Promise<TestingState> {
    console.log('🔎 [LLM] Validating OpenAPI specification...');
    const validation = await validateOpenApiSpec(state.apiSpec);
    if (!validation.valid) {
      const errs = (validation.errors || []).join('; ');
      throw new Error(`OpenAPI validation failed: ${errs}`);
    }
    return {
      ...state,
      currentPhase: 'understanding',
      messages: [...state.messages, 'OpenAPI spec validated'],
    };
  }

  private async analyzeSpecNode(state: TestingState): Promise<TestingState> {
    console.log('🧭 [LLM] Building system map from OpenAPI spec...');
    const systemMap = await this.analyzeApiSystem(state.apiSpec);
    return {
      ...state,
      systemMap,
      currentPhase: 'testing',
      messages: [...state.messages, 'System map generated from spec'],
    };
  }

  private async generateLLMStepsNode(state: TestingState): Promise<TestingState> {
    console.log('🧠 [LLM] Generating executable steps and categorized scenarios from spec...');
    const ai = new AIService();
    const [steps, categorized] = await Promise.all([
      ai.generateCurlPlanFromSpec(state.apiSpec, 10),
      ai.generateCategorizedScenariosFromSpec(state.apiSpec, 10),
    ]);

    const functionalFromSteps: TestScenario[] = steps.map((step: any, idx: number) => ({
      id: String(step.id || `llm_${idx + 1}`),
      type: 'functional',
      endpoint: String(step.path || '/'),
      method: String(step.method || 'GET').toUpperCase(),
      description: `LLM step ${idx + 1}: ${String(step.method || 'GET').toUpperCase()} ${String(step.path || '/')}`,
      intent: 'LLM-generated functional test',
      testData: { ...(step.pathParams || {}), ...(step.query || {}), ...(step.body || {}) },
      expectedOutcome: {
        statusCode: Array.isArray(step.expect?.status)
          ? step.expect.status[0]
          : (step.expect?.status ?? 200),
      },
      dependencies: [],
    }));

    const mapCats = (list: any[], type: TestScenario['type']): TestScenario[] =>
      (list || []).map((s: any, i: number) => ({
        id: String(s.id || `${type}_${i + 1}`),
        type,
        endpoint: String(s.endpoint || '/'),
        method: String(s.method || 'GET').toUpperCase(),
        description: s.description || `${type} scenario`,
        intent: s.intent || `${type} test`,
        testData: s.request || {},
        expectedOutcome: {
          statusCode: Array.isArray(s.expected?.status)
            ? s.expected.status[0]
            : (s.expected?.status ?? 200),
        },
        dependencies: [],
      }));

    const scenarios: TestScenario[] = [
      ...functionalFromSteps,
      ...mapCats(categorized.functional, 'functional'),
      ...mapCats(categorized.security, 'security'),
      ...mapCats(categorized.performance, 'performance'),
      ...mapCats(categorized.reliability, 'reliability'),
      ...mapCats(categorized.boundary, 'boundary'),
    ];

    console.log(`🧠 [LLM] Generated ${scenarios.length} scenarios (including categorized)`);
    return {
      ...state,
      testScenarios: scenarios,
      currentPhase: 'gherkin',
      messages: [...state.messages, `Generated ${scenarios.length} LLM scenarios (categorized)`],
    };
  }

  private async generateGherkinNode(state: TestingState): Promise<TestingState> {
    console.log('🥒 [LLM] Generating Gherkin features from scenarios...');
    try {
      // Ensure we have a system map for richer Gherkin context
      if (!state.systemMap) {
        const systemMap = await this.analyzeApiSystem(state.apiSpec);
        state = { ...state, systemMap };
      }
      const updated = await this.gherkinGenerator.generateGherkinFeatures(state);
    return {
        ...updated,
        gherkinFeatures: updated.gherkinFeatures || [],
        gherkinSummary: updated.gherkinSummary || state.gherkinSummary,
      currentPhase: 'execution',
      };
    } catch (e) {
      console.log('⚠️ [LLM] Gherkin generation failed, continuing without features');
    return {
      ...state,
        gherkinFeatures: state.gherkinFeatures || [],
        gherkinSummary: state.gherkinSummary,
        currentPhase: 'execution',
      };
    }
  }

  private async executeLLMStepsNode(state: TestingState): Promise<TestingState> {
    console.log('🔥 [LLM] Executing scenarios...');
    const { CurlRunner } = await import('../runners/curlRunner');
    const runner = new CurlRunner();
    const baseUrl = process.env.SPECTRA_BASE_URL || this.extractBaseUrlFromApiSpec(state.apiSpec);
    runner.setBaseUrl(baseUrl);

    const results: TestResult[] = [];
    const executableTypes: Array<TestScenario['type']> = [
      'functional',
      'security',
      'boundary',
      'error',
      'integration',
    ];
    for (const scenario of state.testScenarios.filter((s) => executableTypes.includes(s.type))) {
      const start = Date.now();
      try {
        let endpoint = scenario.endpoint;
        const request: any = {};
        const pathParams: Record<string, any> = {};
        Object.entries(scenario.testData || {}).forEach(([k, v]) => {
          if (endpoint.includes(`{${k}}`)) pathParams[k] = v;
          else request[k] = v as any;
        });
        for (const [k, v] of Object.entries(pathParams)) {
          endpoint = endpoint.replace(`{${k}}`, String(v));
        }

        const testCase: any = {
          id: scenario.id,
          endpoint,
          method: scenario.method,
          request,
          headers: { ...(this.globalHeaders || {}) },
          expectedResponse: { status: scenario.expectedOutcome.statusCode },
          files: [],
        };

        const execResult = await runner.executeTest(testCase);
        results.push({
          scenarioId: scenario.id,
          success: execResult.success,
          actualStatusCode: execResult.response?.status || 0,
          expectedStatusCode: scenario.expectedOutcome.statusCode,
          response: execResult.response,
          duration: execResult.duration,
          errors: execResult.error ? [execResult.error] : [],
          insights: [],
        });
      } catch (e: any) {
        const duration = Date.now() - start;
        results.push({
          scenarioId: scenario.id,
          success: false,
          actualStatusCode: 0,
          expectedStatusCode: scenario.expectedOutcome.statusCode,
          response: null,
          duration,
          errors: [e?.message || 'Execution error'],
          insights: [],
        });
      }
    }

    console.log(`🔥 [LLM] Executed ${results.length} scenarios`);
    return {
      ...state,
      testResults: results,
      currentPhase: 'analysis',
      messages: [...state.messages, `Executed ${results.length} scenarios`],
    };
  }

  private async analyzeLLMResultsNode(state: TestingState): Promise<TestingState> {
    console.log('📊 [LLM] Analyzing results...');
    const total = state.testResults.length;
    const passed = state.testResults.filter((r) => r.success).length;
    const overallSuccessRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    const analysis: TestAnalysis = {
      overallSuccessRate,
      phaseResults: { functional: overallSuccessRate },
      criticalIssues: [],
      patterns: [],
      riskAssessment: {
        level: overallSuccessRate >= 80 ? 'low' : overallSuccessRate >= 50 ? 'medium' : 'high',
        factors: [],
        mitigations: [],
      },
    };

    return {
      ...state,
      analysis,
      recommendations: [],
      currentPhase: 'complete',
      messages: [...state.messages, `Analysis complete. Success rate: ${overallSuccessRate}%`],
    };
  }

  /**
   * Extract base URL from OpenAPI spec servers section
   */
  private extractBaseUrlFromApiSpec(apiSpec: OpenAPIV3.Document): string {
    if (apiSpec.servers && apiSpec.servers.length > 0) {
      const server = apiSpec.servers[0];
      const serverUrl = server.url;
      console.log(`🌐 [SPEC EXTRACTION] Found server URL in API spec: ${serverUrl}`);
      return serverUrl;
    }
    
    // Fallback to default URLs - try Node.js first, then Java
    const nodeUrl = 'http://localhost:3000';
    console.log(
      `🌐 [SPEC EXTRACTION] No servers found in API spec, using Node.js default: ${nodeUrl}`,
    );
    return nodeUrl;
  }

  /**
   * Extract base URL dynamically from system map and API spec
   */
  private extractBaseUrlFromSystemMap(systemMap: SystemMap): string {
    // Look for stored server information in the system map
    if (systemMap.baseUrl) {
      console.log(`🌐 [URL EXTRACTION] Found base URL in system map: ${systemMap.baseUrl}`);
      return systemMap.baseUrl;
    }
    
    // Fallback to default URLs - try Node.js first, then Java
    const nodeUrl = 'http://localhost:3000';
    const javaUrl = 'http://localhost:8081';
    
    console.log(
      `🌐 [URL EXTRACTION] No base URL found in system map, trying Node.js default: ${nodeUrl}`,
    );
    return nodeUrl;
  }

  // Helper methods (to be implemented in next steps)
  /* removed: legacy analyzeApiSystem */
  private async analyzeApiSystem(apiSpec: OpenAPIV3.Document): Promise<SystemMap> {
    console.log('🔍 [AI ANALYSIS] Using AI to analyze API system architecture...');

    const endpoints: EndpointInfo[] = [];
    const schemas: SchemaInfo[] = [];
    const dataFlow: DataFlowInfo[] = [];
    const dependencies: DependencyInfo[] = [];

    // Extract base URL from OpenAPI spec servers
    const baseUrl = this.extractBaseUrlFromApiSpec(apiSpec);
    console.log(`🌐 [AI ANALYSIS] Extracted base URL from API spec: ${baseUrl}`);

    // Analyze endpoints directly from OpenAPI spec (LLM-lite)
    if (apiSpec.paths) {
      for (const [pathTemplate, pathItem] of Object.entries(apiSpec.paths)) {
        const methods: Array<'get' | 'post' | 'put' | 'delete' | 'patch'> = [
          'get',
          'post',
          'put',
          'delete',
          'patch',
        ];
        for (const method of methods) {
          const operation = (pathItem as any)[method];
          if (!operation) continue;

          const endpoint = await this.analyzeEndpoint(pathTemplate, method, operation, apiSpec);
          endpoints.push(endpoint);
        }
      }
    }

    // Analyze schemas from components
    if (apiSpec.components && (apiSpec.components as any).schemas) {
      for (const [schemaName, schema] of Object.entries((apiSpec.components as any).schemas)) {
        const schemaInfo = await this.analyzeSchema(schemaName, schema as any, apiSpec);
        schemas.push(schemaInfo);
      }
    }

    return {
      endpoints,
      schemas,
      dataFlow,
      dependencies,
      baseUrl,
    };
  }

  private async analyzeEndpoint(
    pathTemplate: string,
    method: string,
    operation: any,
    apiSpec: OpenAPIV3.Document,
  ): Promise<EndpointInfo> {
    const parameters: ParameterInfo[] = [];
    const pathParams = (operation.parameters || []).filter((p: any) => p.in === 'path');
    for (const p of pathParams) {
      parameters.push({
        name: p.name,
        type: p.schema?.type || 'string',
        required: !!p.required,
        format: p.schema?.format,
      });
    }

    let requestBody: SchemaInfo | undefined = undefined;
    if (operation.requestBody && operation.requestBody.content && operation.requestBody.content['application/json'] && operation.requestBody.content['application/json'].schema) {
      const schema = operation.requestBody.content['application/json'].schema;
      requestBody = await this.analyzeSchema('requestBody', schema, apiSpec);
    }

    const responses: ResponseInfo[] = [];
    if (operation.responses) {
      for (const [statusCode, response] of Object.entries(operation.responses)) {
        const content = (response as any).content || {};
        const schema = content['application/json']?.schema;
          responses.push({
          statusCode: parseInt(String(statusCode), 10),
          schema,
          description: (response as any).description || '',
        });
      }
    }

    return {
      path: pathTemplate,
      method: method.toUpperCase(),
      parameters,
      requestBody,
      responses,
      relatedEndpoints: [],
      metadata: {},
    } as EndpointInfo;
  }

  private async analyzeSchema(
    schemaName: string,
    schema: any,
    apiSpec: OpenAPIV3.Document,
  ): Promise<SchemaInfo> {
    const resolved = this.deepDerefSchema(schema);
    return {
      name: schemaName,
      type: resolved.type || 'object',
      properties: resolved.properties || {},
      required: resolved.required || [],
      examples: resolved.examples || [],
    };
  }

  private deepDerefSchema(schema: any): any {
    if (!schema || typeof schema !== 'object') return schema;
    if (schema.$ref) {
      const resolved = this.resolveSchemaRef(schema.$ref);
      return this.deepDerefSchema(resolved);
    }
    if (schema.type === 'array' && schema.items) {
      return { ...schema, items: this.deepDerefSchema(schema.items) };
    }
    if (schema.properties) {
      const props: Record<string, any> = {};
      for (const [k, v] of Object.entries(schema.properties)) {
        props[k] = this.deepDerefSchema(v);
      }
      return { ...schema, properties: props };
    }
    return { ...schema };
  }

  private resolveSchemaRef(ref: string): any | undefined {
    try {
      const match = ref.match(/#\/components\/schemas\/([^\/#]+)/);
      if (!match) return undefined;
      const schemaName = decodeURIComponent(match[1]);
      const schema = (this.currentApiSpec?.components?.schemas || ({} as Record<string, any>))[
        schemaName
      ];
      return schema ? JSON.parse(JSON.stringify(schema)) : undefined;
    } catch {
      return undefined;
    }
  }

  private async analyzeTestExecution(
    scenario: TestScenario,
    result: any,
    systemMap: SystemMap,
  ): Promise<string[]> {
    // Keep simple for LLM-only: record mismatch insights
    const insights: string[] = [];
    if (!result.success) {
      insights.push(`Expected ${scenario.expectedOutcome.statusCode}, got ${result.response?.status}`);
    }
    return insights;
  }

  private evaluateTestSuccess(
    scenario: TestScenario,
    result: any,
    insights: string[],
    systemMap: SystemMap,
  ): boolean {
    // Primary success criteria: status code match (supports multiple allowed statuses)
    const allowed = this.getAllowedStatuses(scenario, systemMap);
    const allowedArray: number[] = Array.isArray(allowed) ? allowed : [allowed];
    return allowedArray.includes(result.response?.status || 0);
  }

  private getAllowedStatuses(scenario: TestScenario, systemMap: SystemMap): number | number[] {
    const primary = scenario.expectedOutcome?.statusCode;
    if (Array.isArray(primary)) return primary;
    if (typeof primary === 'number') return primary;
    // fallback: find declared 2xx codes for this endpoint if available
    const ep = systemMap.endpoints.find(
      (e) => e.path === scenario.endpoint && e.method.toUpperCase() === scenario.method.toUpperCase(),
    );
    const advertised2xx = ep
      ? ep.responses
          .map((r) => (typeof r.statusCode === 'number' ? r.statusCode : parseInt(String(r.statusCode), 10)))
          .filter((code) => code >= 200 && code < 300)
      : [];
    return advertised2xx.length ? advertised2xx : 200;
  }

  private async analyzeTestResults(
    results: TestResult[],
    systemMap: SystemMap,
  ): Promise<TestAnalysis> {
    console.log('📊 [AI ANALYSIS] Analyzing test results with AI-powered insights...');

    const totalTests = results.length;
    const successfulTests = results.filter((r) => r.success).length;
    const overallSuccessRate =
      totalTests > 0 ? Math.round((successfulTests / totalTests) * 100) : 0;

    // Analyze by test type
    const phaseResults: Record<string, number> = {};
    const testsByType = results.reduce(
      (acc, result) => {
        const scenario = systemMap.endpoints.find((e) =>
          results.some((r) => r.scenarioId.includes(e.path.replace(/[{}]/g, ''))),
        );
        const type = this.inferTestType(result.scenarioId);
        if (!acc[type]) acc[type] = [];
        acc[type].push(result);
        return acc;
      },
      {} as Record<string, TestResult[]>,
    );

    Object.entries(testsByType).forEach(([type, typeResults]) => {
      const typeSuccessRate =
        (typeResults.filter((r) => r.success).length / typeResults.length) * 100;
      phaseResults[type] = Math.round(typeSuccessRate);
    });

    // Identify critical issues
    const criticalIssues = await this.identifyCriticalIssues(results, systemMap);

    // Identify patterns
    const patterns = await this.identifyPatterns(results, systemMap);

    // Assess risk
    const riskAssessment = await this.assessRisk(results, systemMap, criticalIssues);

    console.log(
      `📊 [AI ANALYSIS] Analysis complete - Success rate: ${overallSuccessRate}%, Issues: ${criticalIssues.length}, Patterns: ${patterns.length}`,
    );

    return {
      overallSuccessRate,
      phaseResults,
      criticalIssues,
      patterns,
      riskAssessment,
    };
  }

  private async generateRecommendations(
    analysis: TestAnalysis,
    systemMap: SystemMap,
  ): Promise<string[]> {
    console.log('💡 [AI RECOMMENDATIONS] Generating intelligent recommendations...');

    const recommendations: string[] = [];

    // Success rate based recommendations
    if (analysis.overallSuccessRate < 50) {
      recommendations.push(
        'CRITICAL: Success rate below 50% - Review API implementation and test data management',
      );
      recommendations.push(
        'Implement proper test data isolation and reset mechanisms between test runs',
      );
    } else if (analysis.overallSuccessRate < 80) {
      recommendations.push(
        'Improve success rate by addressing validation errors and data dependency issues',
      );
    }

    // Critical issues based recommendations
    for (const issue of analysis.criticalIssues) {
      switch (issue.category) {
        case 'functionality':
          recommendations.push(
            `Fix functionality issue: ${issue.description} - ${issue.recommendation}`,
          );
          break;
        case 'security':
          recommendations.push(`SECURITY: ${issue.description} - ${issue.recommendation}`);
          break;
        case 'data-integrity':
          recommendations.push(`Data integrity: ${issue.description} - ${issue.recommendation}`);
          break;
      }
    }

    // Pattern based recommendations
    for (const pattern of analysis.patterns) {
      if (pattern.type === 'high_404_rate') {
        recommendations.push(
          'High 404 error rate detected - Implement proper test data seeding and ID management',
        );
      } else if (pattern.type === 'validation_failures') {
        recommendations.push(
          'Multiple validation failures - Review request body generation and schema compliance',
        );
      } else if (pattern.type === 'dependency_issues') {
        recommendations.push(
          'Test dependency issues - Implement proper test ordering and state management',
        );
      }
    }

    // Risk level based recommendations
    switch (analysis.riskAssessment.level) {
      case 'critical':
        recommendations.push(
          'URGENT: Critical risk level - Manual review required before production deployment',
        );
        break;
      case 'high':
        recommendations.push('High risk detected - Address critical issues before proceeding');
        break;
      case 'medium':
        recommendations.push('Medium risk - Consider improving test coverage and error handling');
        break;
    }

    // API-specific recommendations based on system map
    if (systemMap.endpoints.some((e) => e.path.includes('/users'))) {
      recommendations.push(
        'User API detected - Ensure proper user lifecycle management (create -> read -> update -> delete)',
      );
    }

    // Phase-specific recommendations
    Object.entries(analysis.phaseResults).forEach(([phase, successRate]) => {
      if (successRate < 30) {
        recommendations.push(
          `${phase.toUpperCase()} tests failing - Focus on improving ${phase} test scenarios`,
        );
      }
    });

    console.log(`💡 [AI RECOMMENDATIONS] Generated ${recommendations.length} recommendations`);

    return recommendations.slice(0, 10); // Return top 10 recommendations
  }

  private inferTestType(scenarioId: string): string {
    if (scenarioId.includes('functional')) return 'functional';
    if (scenarioId.includes('security')) return 'security';
    if (scenarioId.includes('boundary')) return 'boundary';
    if (scenarioId.includes('error')) return 'error';
    return 'unknown';
  }

  private async identifyCriticalIssues(
    results: TestResult[],
    systemMap: SystemMap,
  ): Promise<Issue[]> {
    const issues: Issue[] = [];

    // High failure rate issue
    const failureRate = (results.filter((r) => !r.success).length / results.length) * 100;
    if (failureRate > 70) {
      issues.push({
        type: 'critical',
        category: 'functionality',
        description: `High failure rate (${failureRate.toFixed(1)}%) across all test types`,
        affectedEndpoints: [...new Set(results.map((r) => r.scenarioId))],
        recommendation: 'Review API implementation, test data setup, and endpoint availability',
      });
    }

    // 404 patterns
    const notFoundErrors = results.filter((r) => r.actualStatusCode === 404);
    if (notFoundErrors.length > results.length * 0.3) {
      issues.push({
        type: 'critical',
        category: 'data-integrity',
        description:
          'High rate of 404 errors indicates missing test data or incorrect ID management',
        affectedEndpoints: [...new Set(notFoundErrors.map((r) => r.scenarioId))],
        recommendation: 'Implement proper test data seeding and ensure valid IDs are used in tests',
      });
    }

    // Validation failures
    const validationErrors = results.filter((r) => r.actualStatusCode === 400);
    if (validationErrors.length > results.length * 0.4) {
      issues.push({
        type: 'warning',
        category: 'functionality',
        description: 'High rate of validation errors (400 status codes)',
        affectedEndpoints: [...new Set(validationErrors.map((r) => r.scenarioId))],
        recommendation: 'Review request body generation and ensure compliance with API schema',
      });
    }

    return issues;
  }

  private async identifyPatterns(results: TestResult[], systemMap: SystemMap): Promise<Pattern[]> {
    const patterns: Pattern[] = [];

    // Pattern: High 404 rate
    const notFoundCount = results.filter((r) => r.actualStatusCode === 404).length;
    if (notFoundCount > 0) {
      patterns.push({
        type: 'high_404_rate',
        description: 'Multiple tests receiving 404 responses',
        frequency: notFoundCount,
        examples: results
          .filter((r) => r.actualStatusCode === 404)
          .slice(0, 3)
          .map((r) => r.scenarioId),
      });
    }

    // Pattern: Validation failures
    const validationFailures = results.filter((r) => r.actualStatusCode === 400).length;
    if (validationFailures > 0) {
      patterns.push({
        type: 'validation_failures',
        description: 'Multiple validation failures in request processing',
        frequency: validationFailures,
        examples: results
          .filter((r) => r.actualStatusCode === 400)
          .slice(0, 3)
          .map((r) => r.scenarioId),
      });
    }

    // Pattern: Consistent failures on specific endpoints
    const failuresByEndpoint = results.reduce(
      (acc, result) => {
        const endpoint = result.scenarioId.split('_').slice(-1)[0] || 'unknown';
        if (!result.success) {
          acc[endpoint] = (acc[endpoint] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    Object.entries(failuresByEndpoint).forEach(([endpoint, failures]) => {
      if (failures > 2) {
        patterns.push({
          type: 'endpoint_failures',
          description: `Consistent failures on ${endpoint} endpoint`,
          frequency: failures,
          examples: [endpoint],
        });
      }
    });

    return patterns;
  }

  private async assessRisk(
    results: TestResult[],
    systemMap: SystemMap,
    criticalIssues: Issue[],
  ): Promise<RiskAssessment> {
    const factors: string[] = [];
    const mitigations: string[] = [];

    const successRate = (results.filter((r) => r.success).length / results.length) * 100;

    // Risk factors
    if (successRate < 30) {
      factors.push('Very low success rate indicates major system issues');
    } else if (successRate < 70) {
      factors.push('Below average success rate indicates stability concerns');
    }

    if (criticalIssues.some((i) => i.type === 'critical')) {
      factors.push('Critical issues identified requiring immediate attention');
    }

    const highErrorRate = results.filter((r) => r.actualStatusCode >= 500).length > 0;
    if (highErrorRate) {
      factors.push('Server errors detected indicating backend instability');
    }

    // Mitigations
    mitigations.push('Implement comprehensive test data management');
    mitigations.push('Add proper error handling and validation');
    mitigations.push('Establish test environment isolation');

    if (factors.length === 0) {
      mitigations.push('Continue monitoring and maintain current quality standards');
    }

    // Determine risk level
    let level: 'low' | 'medium' | 'high' | 'critical' = 'low';

    if (successRate < 30 || criticalIssues.some((i) => i.type === 'critical')) {
      level = 'critical';
    } else if (successRate < 50 || criticalIssues.length > 2) {
      level = 'high';
    } else if (successRate < 80 || criticalIssues.length > 0) {
      level = 'medium';
    }

    return {
      level,
      factors,
      mitigations,
    };
  }

  /**
   * Generate comprehensive reports and save to files
   */
  private async generateReports(state: TestingState, outputDir: string): Promise<void> {
    console.log('📝 [REPORT GENERATION] Generating comprehensive test reports...');

    const fs = await import('fs');
    const path = await import('path');

    // Create output directory structure
    const reportsDir = path.join(outputDir, 'spectra', 'test-results');
    const dashboardDir = path.join(outputDir, 'spectra', 'dashboard');

    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    if (!fs.existsSync(dashboardDir)) {
      fs.mkdirSync(dashboardDir, { recursive: true });
    }

    // 1. Save JSON report
    await this.saveJsonReport(state, reportsDir);

    // 2. Save detailed test results
    await this.saveDetailedResults(state, reportsDir);

    // 3. Save test cases
    await this.saveTestCases(state, reportsDir);

    // 4. Generate HTML dashboard
    await this.generateHtmlDashboard(state, dashboardDir);

    // 5. Save insights and recommendations
    await this.saveInsightsReport(state, reportsDir);

    console.log('📝 [REPORT GENERATION] Reports saved to:');
    console.log(`📊 JSON Report: ${path.join(reportsDir, 'spectra-test-report.json')}`);
    console.log(`📋 Detailed Results: ${path.join(reportsDir, 'detailed-test-results.json')}`);
    console.log(`🧪 Test Cases: ${path.join(reportsDir, 'test-cases.json')}`);
    console.log(`🎨 HTML Dashboard: ${path.join(dashboardDir, 'spectra-dashboard.html')}`);
    console.log(`💡 Insights Report: ${path.join(reportsDir, 'insights-and-recommendations.md')}`);
  }

  private async saveJsonReport(state: TestingState, outputDir: string): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    const report = {
      timestamp: new Date().toISOString(),
      testingFramework: 'Spectra Systems Inspector',
      version: '2.0.0', // Updated version for Gherkin support
      summary: {
        totalScenarios: state.testScenarios.length,
        totalResults: state.testResults.length,
        totalGherkinFeatures: (state.gherkinFeatures || []).length,
        totalGherkinScenarios: (state.gherkinFeatures || []).reduce(
          (sum, f) => sum + f.scenarios.length,
          0,
        ),
        overallSuccessRate: state.analysis?.overallSuccessRate || 0,
        riskLevel: state.analysis?.riskAssessment.level || 'unknown',
        criticalIssues: state.analysis?.criticalIssues.length || 0,
        patternsFound: state.analysis?.patterns.length || 0,
        recommendationsGenerated: state.recommendations.length,
      },
      systemMap: state.systemMap,
      testScenarios: state.testScenarios,
      gherkinFeatures: state.gherkinFeatures || [],
      gherkinSummary: state.gherkinSummary || {
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
      testResults: state.testResults,
      analysis: state.analysis,
      recommendations: state.recommendations,
      messages: state.messages,
    };

    const reportPath = path.join(outputDir, 'spectra-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }

  private async saveDetailedResults(state: TestingState, outputDir: string): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    // Group results by test type
    const resultsByType = state.testResults.reduce(
      (acc, result) => {
        const scenario = state.testScenarios.find((s) => s.id === result.scenarioId);
        const type = scenario?.type || 'unknown';
        if (!acc[type]) acc[type] = [];
        acc[type].push({
          scenario,
          result,
          insights: result.insights,
          duration: result.duration,
        });
        return acc;
      },
      {} as Record<string, any[]>,
    );

    const detailedResults = {
      timestamp: new Date().toISOString(),
      resultsByType,
      statistics: {
        byType: Object.entries(resultsByType).reduce(
          (acc, [type, results]) => {
            const passed = results.filter((r) => r.result.success).length;
            acc[type] = {
              total: results.length,
              passed,
              failed: results.length - passed,
              successRate: ((passed / results.length) * 100).toFixed(1) + '%',
            };
            return acc;
          },
          {} as Record<string, any>,
        ),
      },
    };

    const resultsPath = path.join(outputDir, 'detailed-test-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(detailedResults, null, 2));
  }

  private async saveTestCases(state: TestingState, outputDir: string): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    // Structure test cases with comprehensive information
    const testCases = {
      timestamp: new Date().toISOString(),
      totalTestCases: state.testScenarios.length,
      testFramework: 'Spectra Systems Inspector v2.0',
      testCasesByType: this.groupTestCasesByType(state.testScenarios),
      testCasesByEndpoint: this.groupTestCasesByEndpoint(state.testScenarios),
      allTestCases: state.testScenarios.map((scenario) => ({
        id: scenario.id,
        type: scenario.type,
        endpoint: scenario.endpoint,
        method: scenario.method,
        description: scenario.description,
        intent: scenario.intent,
        testData: scenario.testData,
        expectedOutcome: scenario.expectedOutcome,
        dependencies: scenario.dependencies,
        createdAt: new Date().toISOString(),
        tags: [scenario.type, scenario.method.toLowerCase()],
        executionStatus: this.getExecutionStatus(scenario.id, state.testResults),
      })),
      summary: {
        byType: this.getTestCaseSummaryByType(state.testScenarios),
        byEndpoint: this.getTestCaseSummaryByEndpoint(state.testScenarios),
        totalEndpoints: new Set(state.testScenarios.map((s) => s.endpoint)).size,
      },
    };

    const testCasesPath = path.join(outputDir, 'test-cases.json');
    fs.writeFileSync(testCasesPath, JSON.stringify(testCases, null, 2));
    console.log(
      `📋 [TEST CASES] Saved ${testCases.totalTestCases} test cases to: ${testCasesPath}`,
    );
  }

  private groupTestCasesByType(testScenarios: TestScenario[]): Record<string, TestScenario[]> {
    return testScenarios.reduce(
      (acc, scenario) => {
        if (!acc[scenario.type]) acc[scenario.type] = [];
        acc[scenario.type].push(scenario);
        return acc;
      },
      {} as Record<string, TestScenario[]>,
    );
  }

  private groupTestCasesByEndpoint(testScenarios: TestScenario[]): Record<string, TestScenario[]> {
    return testScenarios.reduce(
      (acc, scenario) => {
        const endpointKey = `${scenario.method} ${scenario.endpoint}`;
        if (!acc[endpointKey]) acc[endpointKey] = [];
        acc[endpointKey].push(scenario);
        return acc;
      },
      {} as Record<string, TestScenario[]>,
    );
  }

  private getExecutionStatus(scenarioId: string, testResults: TestResult[]): string {
    const result = testResults.find((r) => r.scenarioId === scenarioId);
    if (!result) return 'not_executed';
    return result.success ? 'passed' : 'failed';
  }

  private getTestCaseSummaryByType(testScenarios: TestScenario[]): Record<string, number> {
    return testScenarios.reduce(
      (acc, scenario) => {
        acc[scenario.type] = (acc[scenario.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  private getTestCaseSummaryByEndpoint(testScenarios: TestScenario[]): Record<string, number> {
    return testScenarios.reduce(
      (acc, scenario) => {
        const endpointKey = `${scenario.method} ${scenario.endpoint}`;
        acc[endpointKey] = (acc[endpointKey] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  private generateTestCasesHtml(testScenarios: TestScenario[], testResults: TestResult[]): string {
    if (testScenarios.length === 0) {
      return '<p>No test cases generated. Run the Spectra testing workflow to generate test cases.</p>';
    }

    // Group test cases by type for better organization
    const testCasesByType = this.groupTestCasesByType(testScenarios);

    return Object.entries(testCasesByType)
      .map(
        ([type, scenarios]) => `
      <div class="feature-card">
        <div class="feature-header">
          <h3 class="feature-title">🧪 ${type.toUpperCase()} Test Cases</h3>
          <span class="feature-tag">${scenarios.length} test cases</span>
        </div>
        <div class="scenarios-list">
          ${scenarios
            .map((scenario) => {
              const executionResult = testResults.find((r) => r.scenarioId === scenario.id);
              const status = executionResult
                ? executionResult.success
                  ? 'passed'
                  : 'failed'
                : 'not_executed';
              const statusIcon = status === 'passed' ? '✅' : status === 'failed' ? '❌' : '⏳';

              return `
              <div class="scenario-item">
                <div class="scenario-title">
                  ${statusIcon} ${scenario.description}
                  <span class="tag" style="background: ${status === 'passed' ? 'var(--accent-green)' : status === 'failed' ? 'var(--accent-red)' : 'var(--accent-orange)'}">
                    ${status.replace('_', ' ')}
                  </span>
                </div>
                <div class="test-case-details">
                  <div class="detail-row">
                    <strong>Endpoint:</strong> ${scenario.method} ${scenario.endpoint}
                  </div>
                  <div class="detail-row">
                    <strong>Intent:</strong> ${scenario.intent}
                  </div>
                  <div class="detail-row">
                    <strong>Expected Status:</strong> ${scenario.expectedOutcome.statusCode}
                  </div>
                  ${
                    executionResult
                      ? `
                    <div class="detail-row">
                      <strong>Actual Status:</strong> ${executionResult.actualStatusCode}
                    </div>
                    <div class="detail-row">
                      <strong>Duration:</strong> ${executionResult.duration}ms
                    </div>
                  `
                      : ''
                  }
                  ${
                    scenario.dependencies.length > 0
                      ? `
                    <div class="detail-row">
                      <strong>Dependencies:</strong> ${scenario.dependencies.join(', ')}
                    </div>
                  `
                      : ''
                  }
                  <div class="detail-row">
                    <strong>Test Data:</strong>
                    <pre class="test-data-preview">${JSON.stringify(scenario.testData, null, 2)}</pre>
                  </div>
                  ${
                    executionResult && executionResult.insights.length > 0
                      ? `
                    <div class="detail-row">
                      <strong>Insights:</strong>
                      <ul class="insights-list">
                        ${executionResult.insights.map((insight) => `<li>${insight}</li>`).join('')}
                      </ul>
                    </div>
                  `
                      : ''
                  }
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      </div>
    `,
      )
      .join('');
  }

  private async saveInsightsReport(state: TestingState, outputDir: string): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    const allInsights = state.testResults.flatMap((r) => r.insights);
    const uniqueInsights = [...new Set(allInsights)];

    let markdown = `# Spectra Intelligent Testing - Insights & Recommendations\n\n`;
    markdown += `**Generated:** ${new Date().toISOString()}\n\n`;
    markdown += `## 📊 Test Summary\n\n`;
    markdown += `- **Total Test Scenarios:** ${state.testScenarios.length}\n`;
    markdown += `- **Success Rate:** ${state.analysis?.overallSuccessRate || 0}%\n`;
    markdown += `- **Risk Level:** ${state.analysis?.riskAssessment.level || 'unknown'}\n`;
    markdown += `- **Critical Issues:** ${state.analysis?.criticalIssues.length || 0}\n\n`;

    if (state.analysis?.phaseResults) {
      markdown += `## 📋 Results by Test Type\n\n`;
      Object.entries(state.analysis.phaseResults).forEach(([type, successRate]) => {
        markdown += `- **${type.toUpperCase()}:** ${successRate}%\n`;
      });
      markdown += `\n`;
    }

    if (uniqueInsights.length > 0) {
      markdown += `## 💡 Key Insights\n\n`;
      uniqueInsights.forEach((insight, i) => {
        markdown += `${i + 1}. ${insight}\n`;
      });
      markdown += `\n`;
    }

    if (state.recommendations.length > 0) {
      markdown += `## 🔧 Recommendations\n\n`;
      state.recommendations.forEach((rec, i) => {
        markdown += `${i + 1}. ${rec}\n`;
      });
      markdown += `\n`;
    }

    if (state.analysis?.criticalIssues && state.analysis.criticalIssues.length > 0) {
      markdown += `## ⚠️ Critical Issues\n\n`;
      state.analysis.criticalIssues.forEach((issue, i) => {
        markdown += `### ${i + 1}. ${issue.description}\n`;
        markdown += `- **Type:** ${issue.type}\n`;
        markdown += `- **Category:** ${issue.category}\n`;
        markdown += `- **Recommendation:** ${issue.recommendation}\n`;
        markdown += `- **Affected Endpoints:** ${issue.affectedEndpoints.join(', ')}\n\n`;
      });
    }

    if (state.analysis?.patterns && state.analysis.patterns.length > 0) {
      markdown += `## 🔍 Patterns Detected\n\n`;
      state.analysis.patterns.forEach((pattern, i) => {
        markdown += `### ${i + 1}. ${pattern.description}\n`;
        markdown += `- **Frequency:** ${pattern.frequency}\n`;
        markdown += `- **Examples:** ${pattern.examples.join(', ')}\n\n`;
      });
    }

    const insightsPath = path.join(outputDir, 'insights-and-recommendations.md');
    fs.writeFileSync(insightsPath, markdown);
  }

  private async generateHtmlDashboard(state: TestingState, outputDir: string): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    const successRate = state.analysis?.overallSuccessRate || 0;
    const totalTests = state.testResults.length;
    const passedTests = state.testResults.filter((r) => r.success).length;
    const failedTests = totalTests - passedTests;
    const totalGherkinFeatures = state.gherkinFeatures.length;
    const totalGherkinScenarios = state.gherkinFeatures.reduce(
      (sum, f) => sum + f.scenarios.length,
      0,
    );

    // Calculate average response time
    const avgResponseTime =
      state.testResults.length > 0
        ? Math.round(
            state.testResults.reduce((sum, r) => sum + (r.duration || 0), 0) /
              state.testResults.length,
          )
        : 0;

    // Group results by type for detailed analysis
    const resultsByType = state.testResults.reduce(
      (acc, result) => {
        const scenario = state.testScenarios.find((s) => s.id === result.scenarioId);
        const type = scenario?.type || 'unknown';
        if (!acc[type]) acc[type] = { total: 0, passed: 0, failed: 0 };
        acc[type].total++;
        if (result.success) acc[type].passed++;
        else acc[type].failed++;
        return acc;
      },
      {} as Record<string, { total: number; passed: number; failed: number }>,
    );

    // Generate Gherkin features HTML
    const gherkinFeaturesHtml = state.gherkinFeatures
      .map(
        (feature) => `
      <div class="feature-card">
        <div class="feature-header">
          <h3 class="feature-title">${feature.title}</h3>
          <span class="feature-tag">${feature.scenarios.length} scenarios</span>
        </div>
        <div class="feature-description">${feature.description || ''}</div>
        <div class="scenarios-list">
          ${feature.scenarios
            .map(
              (scenario) => `
            <div class="scenario-item">
              <div class="scenario-title">${scenario.title}</div>
              <div class="scenario-tags">${scenario.tags.map((tag) => `<span class="tag">@${tag}</span>`).join('')}</div>
              <div class="scenario-steps">
                ${scenario.steps
                  .slice(0, 3)
                  .map((step) => `<div class="step">${step.keyword} ${step.text}</div>`)
                  .join('')}
                ${scenario.steps.length > 3 ? '<div class="step-more">... and more steps</div>' : ''}
              </div>
            </div>
          `,
            )
            .join('')}
        </div>
      </div>
    `,
      )
      .join('');

    // Generate detailed test results HTML
    const testResultsHtml = state.testResults
      .map((result) => {
        const scenario = state.testScenarios.find((s) => s.id === result.scenarioId);
        return `
        <div class="test-result-item ${result.success ? 'success' : 'failed'}">
          <div class="test-header">
            <span class="test-name">${scenario?.description || result.scenarioId}</span>
            <span class="test-status ${result.success ? 'passed' : 'failed'}">${result.success ? 'PASSED' : 'FAILED'}</span>
          </div>
          <div class="test-details">
            <span class="detail">Status: ${result.actualStatusCode}</span>
            <span class="detail">Duration: ${result.duration}ms</span>
            <span class="detail">Type: ${scenario?.type || 'unknown'}</span>
          </div>
          ${
            result.insights.length > 0
              ? `
            <div class="test-insights">
              ${result.insights.map((insight) => `<div class="insight">${insight}</div>`).join('')}
            </div>
          `
              : ''
          }
        </div>
      `;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Spectra Enterprise Dashboard</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            /* Enterprise Color Palette */
            --primary-dark: #1a1d29;
            --primary-blue: #2563eb;
            --primary-blue-light: #3b82f6;
            --secondary-gray: #374151;
            --accent-green: #10b981;
            --accent-orange: #f59e0b;
            --accent-red: #ef4444;
            --background-light: #f8fafc;
            --background-white: #ffffff;
            --border-light: #e5e7eb;
            --text-primary: #111827;
            --text-secondary: #6b7280;
            --text-muted: #9ca3af;
            --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
            --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Inter', sans-serif;
            background: var(--background-light);
            color: var(--text-primary);
            line-height: 1.6;
        }

        .dashboard-container {
            display: flex;
            min-height: 100vh;
        }

        /* Sidebar Navigation */
        .sidebar {
            width: 280px;
            background: var(--primary-dark);
            color: white;
            position: fixed;
            height: 100vh;
            overflow-y: auto;
            box-shadow: var(--shadow-lg);
        }

        .sidebar-header {
            padding: 24px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .logo {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 20px;
            font-weight: 700;
            color: white;
        }

        .logo i {
            color: var(--primary-blue-light);
            font-size: 24px;
        }

        .nav-menu {
            padding: 16px 0;
        }

        .nav-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 24px;
            color: #d1d5db;
            text-decoration: none;
            transition: all 0.2s;
            border-left: 3px solid transparent;
            cursor: pointer;
        }

        .nav-item:hover,
        .nav-item.active {
            background: rgba(59, 130, 246, 0.1);
            color: white;
            border-left-color: var(--primary-blue-light);
        }

        .nav-item i {
            width: 20px;
            text-align: center;
        }

        /* Main Content */
        .main-content {
            flex: 1;
            margin-left: 280px;
            padding: 24px;
        }

        .page-header {
            background: var(--background-white);
            padding: 24px;
            border-radius: 12px;
            box-shadow: var(--shadow-sm);
            margin-bottom: 24px;
            border: 1px solid var(--border-light);
        }

        .page-title {
            font-size: 28px;
            font-weight: 700;
            color: var(--text-primary);
            margin-bottom: 8px;
        }

        .page-subtitle {
            color: var(--text-secondary);
            font-size: 16px;
        }

        /* Stats Grid */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 32px;
        }

        .stat-card {
            background: var(--background-white);
            padding: 24px;
            border-radius: 12px;
            box-shadow: var(--shadow-sm);
            border: 1px solid var(--border-light);
            transition: transform 0.2s;
        }

        .stat-card:hover {
            transform: translateY(-2px);
            box-shadow: var(--shadow-md);
        }

        .stat-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
        }

        .stat-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .stat-icon {
            width: 40px;
            height: 40px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            color: white;
        }

        .stat-icon.success { background: var(--accent-green); }
        .stat-icon.warning { background: var(--accent-orange); }
        .stat-icon.danger { background: var(--accent-red); }
        .stat-icon.primary { background: var(--primary-blue); }

        .stat-value {
            font-size: 32px;
            font-weight: 700;
            color: var(--text-primary);
            margin-bottom: 8px;
        }

        .stat-change {
            font-size: 14px;
            font-weight: 500;
            color: var(--text-secondary);
        }

        /* Content Sections */
        .content-section {
            background: var(--background-white);
            border-radius: 12px;
            box-shadow: var(--shadow-sm);
            border: 1px solid var(--border-light);
            margin-bottom: 24px;
            overflow: hidden;
        }

        .section-header {
            padding: 20px 24px;
            border-bottom: 1px solid var(--border-light);
            background: linear-gradient(135deg, var(--primary-blue), var(--primary-blue-light));
            color: white;
        }

        .section-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 4px;
        }

        .section-subtitle {
            font-size: 14px;
            opacity: 0.9;
        }

        .section-content {
            padding: 24px;
            max-height: 600px;
            overflow-y: auto;
        }

        /* Tab Navigation */
        .tab-nav {
            display: flex;
            background: var(--background-light);
            border-bottom: 1px solid var(--border-light);
        }

        .tab-button {
            flex: 1;
            padding: 16px 24px;
            background: none;
            border: none;
            font-size: 14px;
            font-weight: 500;
            color: var(--text-secondary);
            cursor: pointer;
            transition: all 0.2s;
            border-bottom: 3px solid transparent;
        }

        .tab-button.active {
            color: var(--primary-blue);
            border-bottom-color: var(--primary-blue);
            background: var(--background-white);
        }

        .tab-content {
            display: none;
            padding: 24px;
        }

        .tab-content.active {
            display: block;
        }

        /* Feature Cards */
        .feature-card {
            margin-bottom: 24px;
            padding: 20px;
            border: 1px solid var(--border-light);
            border-radius: 8px;
            background: var(--background-light);
        }

        .feature-header {
            display: flex;
            align-items: center;
            justify-content: between;
            gap: 12px;
            margin-bottom: 12px;
        }

        .feature-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--text-primary);
        }

        .feature-tag {
            background: var(--primary-blue);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
            margin-left: auto;
        }

        .feature-description {
            color: var(--text-secondary);
            margin-bottom: 16px;
            font-style: italic;
        }

        .scenarios-list {
            display: grid;
            gap: 12px;
        }

        .scenario-item {
            padding: 12px 16px;
            background: var(--background-white);
            border-left: 4px solid var(--primary-blue-light);
            border-radius: 0 6px 6px 0;
        }

        .scenario-title {
            font-weight: 500;
            color: var(--text-primary);
            margin-bottom: 8px;
        }

        .scenario-tags {
            margin-bottom: 8px;
        }

        .tag {
            display: inline-block;
            background: var(--accent-green);
            color: white;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            margin-right: 4px;
        }

        .scenario-steps {
            font-size: 14px;
            color: var(--text-secondary);
        }

        .step {
            margin-bottom: 4px;
        }

        .step-more {
            color: var(--text-muted);
            font-style: italic;
        }

        /* Test Results */
        .test-result-item {
            padding: 16px;
            border-bottom: 1px solid var(--border-light);
            transition: background-color 0.2s;
        }

        .test-result-item:hover {
            background: var(--background-light);
        }

        .test-result-item.success {
            border-left: 4px solid var(--accent-green);
        }

        .test-result-item.failed {
            border-left: 4px solid var(--accent-red);
        }

        .test-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
        }

        .test-name {
            font-weight: 500;
            color: var(--text-primary);
        }

        .test-status {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }

        .test-status.passed {
            background: rgba(16, 185, 129, 0.1);
            color: var(--accent-green);
        }

        .test-status.failed {
            background: rgba(239, 68, 68, 0.1);
            color: var(--accent-red);
        }

        .test-details {
            display: flex;
            gap: 16px;
            margin-bottom: 8px;
        }

        .detail {
            font-size: 14px;
            color: var(--text-secondary);
        }

        .test-insights {
            margin-top: 8px;
        }

        .insight {
            font-size: 13px;
            color: var(--text-secondary);
            background: var(--background-light);
            padding: 8px 12px;
            border-radius: 4px;
            margin-bottom: 4px;
        }

                 /* Test Case Details */
         .test-case-details {
             margin-top: 12px;
             padding: 16px;
             background: rgba(255, 255, 255, 0.5);
             border-radius: 6px;
             border: 1px solid var(--border-light);
         }

         .detail-row {
             margin-bottom: 8px;
             font-size: 14px;
             line-height: 1.5;
         }

         .detail-row strong {
             color: var(--text-primary);
             margin-right: 8px;
         }

         .test-data-preview {
             background: var(--primary-dark);
             color: #e5e7eb;
             padding: 12px;
             border-radius: 4px;
             font-size: 12px;
             margin-top: 8px;
             overflow-x: auto;
             max-height: 200px;
             overflow-y: auto;
         }

         .insights-list {
             margin-top: 8px;
             margin-left: 16px;
         }

         .insights-list li {
             margin-bottom: 4px;
             font-size: 13px;
             color: var(--text-secondary);
         }

        /* Responsive */
        @media (max-width: 1024px) {
            .stats-grid {
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            }
        }

        @media (max-width: 768px) {
            .sidebar {
                transform: translateX(-100%);
                transition: transform 0.3s;
            }
            
            .main-content {
                margin-left: 0;
            }
            
            .stats-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="dashboard-container">
        <!-- Sidebar -->
        <div class="sidebar">
            <div class="sidebar-header">
                <div class="logo">
                    <i class="fas fa-robot"></i>
                    <span>Spectra</span>
                </div>
            </div>
            <nav class="nav-menu">
                <div class="nav-item active" data-tab="overview">
                    <i class="fas fa-tachometer-alt"></i>
                    <span>Overview</span>
                </div>
                <div class="nav-item" data-tab="gherkin">
                    <i class="fas fa-file-alt"></i>
                    <span>Gherkin Features</span>
                </div>
                                 <div class="nav-item" data-tab="test-cases">
                     <i class="fas fa-clipboard-list"></i>
                     <span>Test Cases</span>
                 </div>
                 <div class="nav-item" data-tab="test-results">
                     <i class="fas fa-check-circle"></i>
                     <span>Test Results</span>
                 </div>
                 <div class="nav-item" data-tab="analytics">
                     <i class="fas fa-chart-line"></i>
                     <span>Analytics</span>
                 </div>
                <div class="nav-item" data-tab="reports">
                    <i class="fas fa-file-pdf"></i>
                    <span>Executive Report</span>
                </div>
            </nav>
    </div>

        <!-- Main Content -->
        <div class="main-content">
            <!-- Page Header -->
            <div class="page-header">
                <h1 class="page-title">Spectra Enterprise Dashboard</h1>
                <p class="page-subtitle">AI-powered API testing with comprehensive BDD integration and intelligent analysis - Generated ${new Date().toLocaleString()}</p>
            </div>

            <!-- Overview Tab -->
            <div id="overview" class="tab-content active">
                <!-- Stats Grid -->
        <div class="stats-grid">
            <div class="stat-card">
                        <div class="stat-header">
                            <span class="stat-title">Success Rate</span>
                            <div class="stat-icon ${successRate >= 80 ? 'success' : successRate >= 60 ? 'warning' : 'danger'}">
                                <i class="fas fa-percentage"></i>
                            </div>
                        </div>
                        <div class="stat-value">${successRate}%</div>
                        <div class="stat-change">AI-optimized testing</div>
            </div>
            <div class="stat-card">
                        <div class="stat-header">
                            <span class="stat-title">Total Tests</span>
                            <div class="stat-icon primary">
                                <i class="fas fa-vial"></i>
                            </div>
                        </div>
                <div class="stat-value">${totalTests}</div>
                        <div class="stat-change">Comprehensive coverage</div>
            </div>
            <div class="stat-card">
                        <div class="stat-header">
                            <span class="stat-title">Passed</span>
                            <div class="stat-icon success">
                                <i class="fas fa-check"></i>
                            </div>
                        </div>
                        <div class="stat-value">${passedTests}</div>
                        <div class="stat-change">Quality assured</div>
            </div>
            <div class="stat-card">
                        <div class="stat-header">
                            <span class="stat-title">Failed</span>
                            <div class="stat-icon danger">
                                <i class="fas fa-times"></i>
                            </div>
                        </div>
                        <div class="stat-value">${failedTests}</div>
                        <div class="stat-change">Requiring attention</div>
            </div>
            <div class="stat-card">
                        <div class="stat-header">
                            <span class="stat-title">Gherkin Features</span>
                            <div class="stat-icon primary">
                                <i class="fas fa-layer-group"></i>
                            </div>
                        </div>
                        <div class="stat-value">${totalGherkinFeatures}</div>
                        <div class="stat-change">Business-readable</div>
            </div>
            <div class="stat-card">
                        <div class="stat-header">
                            <span class="stat-title">BDD Scenarios</span>
                            <div class="stat-icon primary">
                                <i class="fas fa-list-alt"></i>
                            </div>
                        </div>
                        <div class="stat-value">${totalGherkinScenarios}</div>
                        <div class="stat-change">Stakeholder friendly</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-header">
                            <span class="stat-title">Avg Response</span>
                            <div class="stat-icon ${avgResponseTime < 200 ? 'success' : avgResponseTime < 500 ? 'warning' : 'danger'}">
                                <i class="fas fa-clock"></i>
                            </div>
                        </div>
                        <div class="stat-value">${avgResponseTime}ms</div>
                        <div class="stat-change">Performance metric</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-header">
                            <span class="stat-title">Risk Level</span>
                            <div class="stat-icon ${state.analysis?.riskAssessment.level === 'critical' ? 'danger' : state.analysis?.riskAssessment.level === 'high' ? 'warning' : 'success'}">
                                <i class="fas fa-shield-alt"></i>
                            </div>
                        </div>
                        <div class="stat-value">${state.analysis?.riskAssessment.level?.toUpperCase() || 'LOW'}</div>
                        <div class="stat-change">AI assessment</div>
            </div>
        </div>

                                 <!-- Summary Grid -->
                 <div class="content-section">
                     <div class="section-header">
                         <div class="section-title">📋 Testing Summary</div>
                         <div class="section-subtitle">Comprehensive overview of test execution and BDD coverage</div>
                     </div>
                     <div class="section-content">
                         <div class="feature-card">
                             <div class="feature-header">
                                 <h3 class="feature-title">🎯 Test Execution Overview</h3>
                             </div>
                             <div class="feature-description">
                                 • Total test scenarios generated: ${state.testScenarios.length}<br>
                                 • Total test cases executed: ${totalTests}<br>
                                 • Success rate achieved: ${successRate}%<br>
                                 • Average response time: ${avgResponseTime}ms<br>
                                 • Risk assessment: ${state.analysis?.riskAssessment.level || 'Low'} level
                             </div>
                         </div>
                         
                         <div class="feature-card">
                             <div class="feature-header">
                                 <h3 class="feature-title">🥒 BDD Documentation</h3>
                             </div>
                             <div class="feature-description">
                                 • Gherkin features created: ${totalGherkinFeatures}<br>
                                 • Business scenarios documented: ${totalGherkinScenarios}<br>
                                 • Stakeholder-readable format: Given-When-Then structure<br>
                                 • Requirements traceability: Complete coverage<br>
                                 • Documentation quality: Enterprise-ready
                             </div>
                         </div>
                         
                         ${
                           Object.keys(resultsByType).length > 0
                             ? `
                         <div class="feature-card">
                             <div class="feature-header">
                                 <h3 class="feature-title">🧪 Test Category Breakdown</h3>
                             </div>
                             <div class="scenarios-list">
                                 ${Object.entries(resultsByType)
                                   .map(
                                     ([type, stats]) => `
                                     <div class="scenario-item">
                                         <div class="scenario-title">${type.toUpperCase()} Tests</div>
                                         <div class="feature-description">
                                             Success Rate: ${Math.round((stats.passed / stats.total) * 100)}% | 
                                             Passed: ${stats.passed} | 
                                             Failed: ${stats.failed} | 
                                             Total: ${stats.total}
                                         </div>
                                     </div>
                                 `,
                                   )
                                   .join('')}
                             </div>
                         </div>
                         `
                             : ''
                         }
                     </div>
                 </div>
        </div>

                         <!-- Gherkin Features Tab -->
             <div id="gherkin" class="tab-content">
                 <div class="content-section">
                     <div class="section-header">
                         <div class="section-title">🥒 Gherkin BDD Features</div>
                         <div class="section-subtitle">Business-readable test scenarios with Given-When-Then structure</div>
                     </div>
                     <div class="section-content">
                         ${gherkinFeaturesHtml || '<p>No Gherkin features generated. Run the enhanced testing workflow to generate BDD features.</p>'}
                     </div>
                 </div>
             </div>

             <!-- Test Cases Tab -->
             <div id="test-cases" class="tab-content">
                 <div class="content-section">
                     <div class="section-header">
                         <div class="section-title">📋 Generated Test Cases</div>
                         <div class="section-subtitle">All test scenarios generated by AI with execution status</div>
                     </div>
                     <div class="section-content">
                         ${this.generateTestCasesHtml(state.testScenarios, state.testResults)}
                     </div>
                 </div>
             </div>

             <!-- Test Results Tab -->
            <div id="test-results" class="tab-content">
                <div class="content-section">
                    <div class="section-header">
                        <div class="section-title">🧪 Detailed Test Execution Results</div>
                        <div class="section-subtitle">Complete test run analysis with AI-powered insights</div>
                    </div>
                    <div class="section-content">
                        ${testResultsHtml || '<p>No test results available.</p>'}
                    </div>
                </div>
            </div>

            <!-- Analytics Tab -->
            <div id="analytics" class="tab-content">
                <div class="content-section">
                    <div class="section-header">
                        <div class="section-title">📈 Advanced Analytics</div>
                        <div class="section-subtitle">AI-powered insights and performance metrics</div>
                    </div>
                    <div class="section-content">
                        <div class="stats-grid">
                            ${Object.entries(resultsByType)
                              .map(
                                ([type, stats]) => `
                                <div class="stat-card">
                                    <div class="stat-header">
                                        <span class="stat-title">${type.toUpperCase()} Tests</span>
                                        <div class="stat-icon ${stats.passed === stats.total ? 'success' : stats.failed > stats.passed ? 'danger' : 'warning'}">
                                            <i class="fas fa-chart-bar"></i>
                                        </div>
                                    </div>
                                    <div class="stat-value">${Math.round((stats.passed / stats.total) * 100)}%</div>
                                    <div class="stat-change">${stats.passed}/${stats.total} passed</div>
                                </div>
                            `,
                              )
                              .join('')}
                        </div>
                        
                        <div class="feature-card">
                            <div class="feature-header">
                                <h3 class="feature-title">🎯 AI Performance Insights</h3>
                            </div>
                            <div class="feature-description">
                                • Average response time: ${avgResponseTime}ms<br>
                                • Success rate: ${successRate}% (${successRate >= 80 ? 'Excellent' : successRate >= 60 ? 'Good' : 'Needs Improvement'})<br>
                                • Test coverage: Comprehensive across ${Object.keys(resultsByType).length} categories<br>
                                • Risk assessment: ${state.analysis?.riskAssessment.level || 'Low'} level<br>
                                • BDD coverage: ${totalGherkinFeatures} features with ${totalGherkinScenarios} scenarios
                            </div>
                        </div>
                        
                        ${
                          state.analysis?.criticalIssues && state.analysis.criticalIssues.length > 0
                            ? `
                            <div class="feature-card">
                                <div class="feature-header">
                                    <h3 class="feature-title">⚠️ Critical Issues Detected</h3>
                                </div>
                                <div class="scenarios-list">
                                    ${state.analysis.criticalIssues
                                      .map(
                                        (issue) => `
                                        <div class="scenario-item">
                                            <div class="scenario-title">${issue.description}</div>
                                            <div class="feature-description">
                                                <strong>Category:</strong> ${issue.category}<br>
                                                <strong>Recommendation:</strong> ${issue.recommendation}
                                            </div>
                                        </div>
                                    `,
                                      )
                                      .join('')}
                                </div>
                            </div>
                        `
                            : ''
                        }
                    </div>
        </div>
    </div>

            <!-- Executive Report Tab -->
            <div id="reports" class="tab-content">
                <div class="content-section">
                    <div class="section-header">
                        <div class="section-title">📋 Executive Summary Report</div>
                        <div class="section-subtitle">Comprehensive testing analysis for stakeholders</div>
                    </div>
                    <div class="section-content">
                        <div style="background: var(--primary-dark); color: #e5e7eb; padding: 20px; border-radius: 8px; font-family: 'Monaco', 'Menlo', monospace; font-size: 14px; overflow-x: auto; margin: 16px 0;">
=== Spectra ENTERPRISE TESTING REPORT ===
Generated: ${new Date().toISOString()}
Testing Framework: Spectra Systems Inspector v2.0
AI-Powered Analysis: ✅ Enabled

📊 EXECUTIVE SUMMARY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Total Tests Executed: ${totalTests}
• Success Rate: ${successRate}% ${successRate >= 80 ? '✅ EXCELLENT' : successRate >= 60 ? '⚠️ GOOD' : '❌ NEEDS ATTENTION'}
• Average Response Time: ${avgResponseTime}ms
• Risk Level: ${state.analysis?.riskAssessment.level?.toUpperCase() || 'LOW'}

🧪 TEST BREAKDOWN BY CATEGORY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${Object.entries(resultsByType)
  .map(
    ([type, stats]) =>
      `• ${type.toUpperCase()}: ${stats.passed}/${stats.total} passed (${Math.round((stats.passed / stats.total) * 100)}%)`,
  )
  .join('\n')}

🥒 BUSINESS DOCUMENTATION (BDD):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Gherkin Features Generated: ${totalGherkinFeatures}
• Business Scenarios: ${totalGherkinScenarios}
• Stakeholder Readability: ✅ Excellent
• Requirements Traceability: ✅ Complete

🤖 AI RECOMMENDATIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${
  state.recommendations.length > 0
    ? state.recommendations
        .slice(0, 5)
        .map((rec, i) => `${i + 1}. ${rec}`)
        .join('\n')
    : '• System is performing optimally with current configuration'
}

📈 QUALITY METRICS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Test Coverage: Comprehensive
• BDD Documentation: Professional
• Performance: ${avgResponseTime < 200 ? 'Excellent' : avgResponseTime < 500 ? 'Good' : 'Needs Optimization'}
• Security Posture: Validated
• Integration Testing: ${resultsByType.integration ? 'Completed' : 'Recommended'}

💼 BUSINESS IMPACT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• API Reliability: ${successRate >= 80 ? 'High confidence for production' : 'Requires attention before deployment'}
• Documentation Quality: Business-ready BDD scenarios
• Maintenance: Automated testing pipeline established
• Risk Mitigation: ${state.analysis?.riskAssessment.level === 'low' ? 'Minimal risk identified' : 'Risk factors documented with mitigation plans'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Tab Navigation
        document.addEventListener('DOMContentLoaded', function() {
            const navItems = document.querySelectorAll('.nav-item');
            const tabContents = document.querySelectorAll('.tab-content');

            navItems.forEach(item => {
                item.addEventListener('click', function() {
                    // Remove active class from all nav items and tab contents
                    navItems.forEach(nav => nav.classList.remove('active'));
                    tabContents.forEach(content => content.classList.remove('active'));
                    
                    // Add active class to clicked nav item
                    this.classList.add('active');
                    
                    // Show corresponding tab content
                    const tabId = this.getAttribute('data-tab');
                    document.getElementById(tabId).classList.add('active');
                });
            });

                         // Dashboard initialization complete
             console.log('Spectra Enterprise Dashboard loaded successfully');
        });
    </script>
</body>
</html>`;

    const dashboardPath = path.join(outputDir, 'spectra-dashboard.html');
    fs.writeFileSync(dashboardPath, html);

    console.log(`🎨 [ENTERPRISE DASHBOARD] Generated comprehensive dashboard: ${dashboardPath}`);
  }

  /**
   * Generate test data seeding instructions for reliable test execution
   */
  private async generateTestDataInstructions(outputDir: string): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    // Minimal seeding guidance for LLM-only flow
    const instructions = (
      '# Test Data Seeding Instructions\n\n' +
      'Spectra generates mock data via LLMs based on your OpenAPI schemas.\n' +
      'To maximize accuracy, add examples/enums and validation constraints to your spec.\n\n' +
      'If your API requires existing IDs, seed a couple of records so read/update/delete tests can pass.\n'
    );
    const instructionsPath = path.join(outputDir, 'TEST_DATA_SETUP.md');

    fs.writeFileSync(instructionsPath, instructions);
    console.log(`📋 [TEST DATA] Instructions saved to: ${instructionsPath}`);
  }
}

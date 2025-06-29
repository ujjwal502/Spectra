import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import { StateGraph, END, START } from '@langchain/langgraph';
import { RunnableConfig } from '@langchain/core/runnables';
import * as fs from 'fs';
import * as path from 'path';
import { GherkinFeature, GherkinScenario, Operation, TestCase } from '../types';
import { AIService } from '../services/aiService';

/**
 * Enhanced test generation state following LRASGen methodology
 */
interface TestGenerationState {
  // Input data
  apiSchema: any;
  endpoint: {
    path: string;
    method: string;
    operation: Operation;
  };

  // LRASGen-inspired analysis stages
  endpointAnalysis: {
    businessContext: string;
    complexityLevel: 'simple' | 'moderate' | 'complex';
    riskFactors: string[];
    dependencies: string[];
    confidence: number;
  };

  parameterAnalysis: {
    requiredParams: any[];
    optionalParams: any[];
    constraintRules: any[];
    dataTypes: Record<string, any>;
    validationRequirements: string[];
  };

  responseAnalysis: {
    successScenarios: any[];
    errorScenarios: any[];
    statusCodes: number[];
    businessRules: string[];
  };

  // Generated content
  testScenarios: {
    functionalTests: any[];
    boundaryTests: any[];
    errorTests: any[];
    securityTests: any[];
    performanceTests: any[];
  };

  gherkinFeatures: GherkinFeature[];
  executionPlan: {
    testOrder: string[];
    dependencies: Record<string, string[]>;
    dataSetup: any[];
    teardownSteps: string[];
  };

  // Quality metrics
  coverage: {
    pathCoverage: number;
    parameterCombinations: number;
    errorScenarios: number;
    businessRules: number;
  };

  // Final outputs
  testCases: TestCase[];
  recommendations: string[];
  errors: string[];
}

/**
 * LangGraph-enhanced test generator using LRASGen methodology
 * Implements multi-step analysis and generation workflow
 */
export class EnhancedTestGenerator {
  private llm: ChatOpenAI;
  private aiService: AIService;

  constructor() {
    this.llm = new ChatOpenAI({
      model: 'gpt-4o',
      temperature: 0.3,
      maxRetries: 3,
    });

    this.aiService = new AIService();
  }

  /**
   * Generate comprehensive test suite for an API endpoint using LangGraph workflow
   */
  async generateTestSuite(
    apiSchema: any,
    endpoint: { path: string; method: string; operation: Operation },
  ): Promise<{
    testCases: TestCase[];
    gherkinFeatures: GherkinFeature[];
    executionPlan: any;
    coverage: any;
    recommendations: string[];
  }> {
    console.log(
      `🚀 Starting LangGraph-enhanced test generation for ${endpoint.method.toUpperCase()} ${endpoint.path}`,
    );

    // Execute sequential workflow inspired by LRASGen methodology
    let state: TestGenerationState = {
      apiSchema,
      endpoint,
      endpointAnalysis: {
        businessContext: '',
        complexityLevel: 'simple',
        riskFactors: [],
        dependencies: [],
        confidence: 0,
      },
      parameterAnalysis: {
        requiredParams: [],
        optionalParams: [],
        constraintRules: [],
        dataTypes: {},
        validationRequirements: [],
      },
      responseAnalysis: {
        successScenarios: [],
        errorScenarios: [],
        statusCodes: [],
        businessRules: [],
      },
      testScenarios: {
        functionalTests: [],
        boundaryTests: [],
        errorTests: [],
        securityTests: [],
        performanceTests: [],
      },
      gherkinFeatures: [],
      executionPlan: {
        testOrder: [],
        dependencies: {},
        dataSetup: [],
        teardownSteps: [],
      },
      coverage: {
        pathCoverage: 0,
        parameterCombinations: 0,
        errorScenarios: 0,
        businessRules: 0,
      },
      testCases: [],
      recommendations: [],
      errors: [],
    };

    try {
      // Execute LRASGen-inspired workflow steps
      state = await this.analyzeEndpointContext(state);
      state = await this.analyzeParametersAndConstraints(state);
      state = await this.analyzeResponseScenarios(state);
      state = await this.generateComprehensiveTestScenarios(state);
      state = await this.generateEnhancedGherkinFeatures(state);
      state = await this.planIntelligentTestExecution(state);
      state = await this.optimizeTestSuiteAndCoverage(state);

      console.log('✅ LangGraph test generation completed successfully');
      console.log(`📊 Generated ${state.testCases.length} test cases`);
      console.log(`🥒 Created ${state.gherkinFeatures.length} Gherkin features`);
      console.log(`📈 Coverage: ${JSON.stringify(state.coverage, null, 2)}`);

      return {
        testCases: state.testCases,
        gherkinFeatures: state.gherkinFeatures,
        executionPlan: state.executionPlan,
        coverage: state.coverage,
        recommendations: state.recommendations,
      };
    } catch (error) {
      console.error('❌ LangGraph test generation failed:', error);
      throw error;
    }
  }

  /**
   * Step 1: Analyze endpoint context (LRASGen Step 3 inspired)
   */
  private async analyzeEndpointContext(state: TestGenerationState): Promise<TestGenerationState> {
    console.log('🔍 Step 1: Analyzing endpoint business context and complexity...');

    const { endpoint, apiSchema } = state;

    const analysisPrompt = `
    Analyze this API endpoint following LRASGen methodology for comprehensive test generation:
    
    ENDPOINT DETAILS:
    Path: ${endpoint.path}
    Method: ${endpoint.method}
    Summary: ${endpoint.operation.summary || 'Not specified'}
    Description: ${endpoint.operation.description || 'Not specified'}
    
    Following LRASGen Step 3 (Identify Endpoint Methods), perform deep analysis:

    1. BUSINESS CONTEXT ANALYSIS:
       - What business domain does this endpoint serve?
       - What are the real-world use cases?
       - What business rules and constraints apply?

    2. COMPLEXITY ASSESSMENT:
       - Rate complexity: simple/moderate/complex
       - Identify factors contributing to complexity

    3. RISK FACTOR IDENTIFICATION:
       - Security vulnerabilities potential
       - Data integrity risks
       - Performance bottlenecks

    4. DEPENDENCY ANALYSIS:
       - What other endpoints/services does this depend on?
       - What state changes does it cause?

    Respond in JSON format:
    {
      "businessContext": "detailed business purpose and domain context",
      "complexityLevel": "simple|moderate|complex",
      "riskFactors": ["risk1", "risk2", "risk3"],
      "dependencies": ["endpoint1", "service2", "state3"],
      "confidence": 0.95
    }
    `;

    try {
      const response = await this.llm.invoke([new HumanMessage({ content: analysisPrompt })]);

      const analysis = this.parseJsonResponse(response.content as string);

      console.log(`📋 Business Context: ${analysis.businessContext}`);
      console.log(`⚡ Complexity Level: ${analysis.complexityLevel}`);
      console.log(`⚠️  Risk Factors: ${analysis.riskFactors.length} identified`);

      return {
        ...state,
        endpointAnalysis: analysis,
      };
    } catch (error: any) {
      console.error('Error in endpoint analysis:', error);
      return {
        ...state,
        errors: [...state.errors, `Endpoint analysis failed: ${error.message}`],
      };
    }
  }

  /**
   * Step 2: Analyze parameters and constraints (LRASGen Step 4-5 inspired)
   */
  private async analyzeParametersAndConstraints(
    state: TestGenerationState,
  ): Promise<TestGenerationState> {
    console.log('🔍 Step 2: Deep parameter analysis and constraint discovery...');

    const { endpoint, endpointAnalysis } = state;
    const operation = endpoint.operation;

    const parameterPrompt = `
    Following LRASGen Steps 4-5 (Identify Parameters & Constraints), analyze all parameters:
    
    ENDPOINT: ${endpoint.method} ${endpoint.path}
    BUSINESS CONTEXT: ${endpointAnalysis.businessContext}
    
    OPERATION DETAILS:
    ${JSON.stringify(operation, null, 2)}
    
    Perform comprehensive parameter analysis:

    1. PARAMETER CATEGORIZATION:
       - Required vs Optional parameters
       - Path, Query, Header, Body parameters

    2. CONSTRAINT DISCOVERY:
       - Value ranges and boundaries
       - String length limits
       - Pattern validations
       - Business logic constraints

    3. VALIDATION REQUIREMENTS:
       - Input sanitization needs
       - Format validations
       - Security validations

    Respond in JSON format:
    {
      "requiredParams": [{"name": "param1", "type": "string", "constraints": {...}}],
      "optionalParams": [{"name": "param2", "type": "number", "constraints": {...}}],
      "constraintRules": [
        {
          "parameter": "param1",
          "rule": "minLength: 3, maxLength: 50",
          "businessReason": "Username format requirements"
        }
      ],
      "dataTypes": {"param1": {"type": "string", "format": "email"}},
      "validationRequirements": ["email format", "unique username", "non-empty"]
    }
    `;

    try {
      const response = await this.llm.invoke([new HumanMessage({ content: parameterPrompt })]);

      const analysis = this.parseJsonResponse(response.content as string);

      console.log(`📝 Required Parameters: ${analysis.requiredParams.length}`);
      console.log(`📝 Optional Parameters: ${analysis.optionalParams.length}`);
      console.log(`🛡️  Constraint Rules: ${analysis.constraintRules.length}`);

      return {
        ...state,
        parameterAnalysis: analysis,
      };
    } catch (error: any) {
      console.error('Error in parameter analysis:', error);
      return {
        ...state,
        errors: [...state.errors, `Parameter analysis failed: ${error.message}`],
      };
    }
  }

  /**
   * Step 3: Analyze response scenarios (LRASGen Step 6 adapted)
   */
  private async analyzeResponseScenarios(state: TestGenerationState): Promise<TestGenerationState> {
    console.log('🔍 Step 3: Comprehensive response scenario analysis...');

    const { endpoint, endpointAnalysis } = state;

    const responsePrompt = `
    Analyze all possible response scenarios for comprehensive test coverage:
    
    ENDPOINT: ${endpoint.method} ${endpoint.path}
    BUSINESS CONTEXT: ${endpointAnalysis.businessContext}
    
    RESPONSES DEFINED:
    ${JSON.stringify(endpoint.operation.responses, null, 2)}
    
    Perform comprehensive response analysis:

    1. SUCCESS SCENARIOS:
       - All valid success paths
       - Different data states that affect response

    2. ERROR SCENARIOS:
       - Validation errors (400)
       - Authentication errors (401/403)
       - Not found scenarios (404)
       - Server errors (500)

    3. BUSINESS RULES:
       - When does the operation succeed/fail?
       - What are the business constraints?

    Respond in JSON format:
    {
      "successScenarios": [
        {
          "name": "Normal user creation",
          "statusCode": 201,
          "conditions": "Valid user data provided"
        }
      ],
      "errorScenarios": [
        {
          "name": "Invalid email format",
          "statusCode": 400,
          "trigger": "Malformed email in request"
        }
      ],
      "statusCodes": [200, 201, 400, 401, 404, 500],
      "businessRules": [
        "Email must be unique",
        "Username minimum 3 characters"
      ]
    }
    `;

    try {
      const response = await this.llm.invoke([new HumanMessage({ content: responsePrompt })]);

      const analysis = this.parseJsonResponse(response.content as string);

      console.log(`✅ Success Scenarios: ${analysis.successScenarios.length}`);
      console.log(`❌ Error Scenarios: ${analysis.errorScenarios.length}`);

      return {
        ...state,
        responseAnalysis: analysis,
      };
    } catch (error: any) {
      console.error('Error in response analysis:', error);
      return {
        ...state,
        errors: [...state.errors, `Response analysis failed: ${error.message}`],
      };
    }
  }

  /**
   * Step 4: Generate comprehensive test scenarios
   */
  private async generateComprehensiveTestScenarios(
    state: TestGenerationState,
  ): Promise<TestGenerationState> {
    console.log('🔍 Step 4: Generating comprehensive test scenarios...');

    const functionalTests = state.responseAnalysis.successScenarios.map((scenario) => ({
      name: `Functional - ${scenario.name}`,
      type: 'functional',
      scenario,
    }));

    const errorTests = state.responseAnalysis.errorScenarios.map((scenario) => ({
      name: `Error - ${scenario.name}`,
      type: 'error',
      scenario,
    }));

    const boundaryTests = state.parameterAnalysis.constraintRules.map((rule) => ({
      name: `Boundary - ${rule.parameter} ${rule.rule}`,
      type: 'boundary',
      rule,
    }));

    const securityTests = state.endpointAnalysis.riskFactors
      .filter((risk) => risk.toLowerCase().includes('security'))
      .map((risk) => ({
        name: `Security - ${risk}`,
        type: 'security',
        risk,
      }));

    const performanceTests =
      state.endpointAnalysis.complexityLevel === 'complex'
        ? [
            { name: 'Performance - Load test', type: 'performance' },
            { name: 'Performance - Stress test', type: 'performance' },
          ]
        : [];

    console.log(`🧪 Generated test scenarios:`);
    console.log(`  - Functional: ${functionalTests.length}`);
    console.log(`  - Boundary: ${boundaryTests.length}`);
    console.log(`  - Error: ${errorTests.length}`);
    console.log(`  - Security: ${securityTests.length}`);
    console.log(`  - Performance: ${performanceTests.length}`);

    return {
      ...state,
      testScenarios: {
        functionalTests,
        boundaryTests,
        errorTests,
        securityTests,
        performanceTests,
      },
    };
  }

  /**
   * Step 5: Generate enhanced Gherkin features
   */
  private async generateEnhancedGherkinFeatures(
    state: TestGenerationState,
  ): Promise<TestGenerationState> {
    console.log('🔍 Step 5: Generating enhanced Gherkin features...');

    const { endpoint, endpointAnalysis, testScenarios } = state;

    const gherkinPrompt = `
    Generate comprehensive Gherkin features based on the analysis:
    
    ENDPOINT: ${endpoint.method} ${endpoint.path}
    BUSINESS CONTEXT: ${endpointAnalysis.businessContext}
    
    TEST SCENARIOS GENERATED:
    - Functional: ${testScenarios.functionalTests.length} scenarios
    - Boundary: ${testScenarios.boundaryTests.length} scenarios  
    - Error: ${testScenarios.errorTests.length} scenarios
    - Security: ${testScenarios.securityTests.length} scenarios
    
    Generate Gherkin features following BDD best practices from the Gherkin guide:

    1. Use business-focused language from the SmartBear Gherkin guide
    2. Clear Given-When-Then structure 
    3. Include tags for organization (@functional, @security, @boundary)
    4. Cover happy path, error cases, and edge conditions
    5. Use realistic examples and data

    Create separate scenarios for different test types.
    Make scenarios executable and maintainable.

    Respond with Gherkin features in JSON format:
    {
      "features": [
        {
          "title": "User Management API - Account Creation", 
          "description": "Comprehensive scenarios for user account creation endpoint",
          "scenarios": [
            {
              "title": "Successfully create new user account",
              "tags": ["functional", "critical"],
              "steps": [
                {"keyword": "Given", "text": "the user registration endpoint is available"},
                {"keyword": "And", "text": "I have valid user registration data"},
                {"keyword": "When", "text": "I send a POST request to create a new user"},
                {"keyword": "Then", "text": "the response status should be 201"},
                {"keyword": "And", "text": "the response should contain the user ID"}
              ]
            }
          ]
        }
      ]
    }
    `;

    try {
      const response = await this.llm.invoke([new HumanMessage({ content: gherkinPrompt })]);

      const gherkinData = this.parseJsonResponse(response.content as string);

      console.log(`🥒 Generated ${gherkinData.features.length} Gherkin features`);

      return {
        ...state,
        gherkinFeatures: gherkinData.features,
      };
    } catch (error: any) {
      console.error('Error generating Gherkin features:', error);
      return {
        ...state,
        errors: [...state.errors, `Gherkin generation failed: ${error.message}`],
      };
    }
  }

  /**
   * Step 6: Plan intelligent test execution
   */
  private async planIntelligentTestExecution(
    state: TestGenerationState,
  ): Promise<TestGenerationState> {
    console.log('🔍 Step 6: Planning intelligent test execution strategy...');

    const executionPlan = {
      testOrder: ['functional', 'boundary', 'error', 'security', 'performance'],
      dependencies: {
        boundary: ['functional'],
        error: ['functional'],
        security: ['functional'],
        performance: ['functional'],
      },
      dataSetup: [
        { step: 'setup_test_environment', description: 'Initialize test environment' },
        { step: 'create_test_data', description: 'Generate required test data' },
      ],
      teardownSteps: ['cleanup_test_data', 'reset_environment'],
    };

    console.log(`📋 Execution plan created with ${executionPlan.testOrder.length} phases`);

    return {
      ...state,
      executionPlan,
    };
  }

  /**
   * Step 7: Optimize test suite and calculate coverage
   */
  private async optimizeTestSuiteAndCoverage(
    state: TestGenerationState,
  ): Promise<TestGenerationState> {
    console.log('🔍 Step 7: Optimizing test suite and calculating coverage...');

    const { endpoint, gherkinFeatures, parameterAnalysis, responseAnalysis, endpointAnalysis } =
      state;

    // Convert Gherkin features to TestCase objects
    const testCases: TestCase[] = [];

    for (const feature of gherkinFeatures) {
      for (const scenario of feature.scenarios) {
        const testCase: TestCase = {
          id: `test_${endpoint.method}_${endpoint.path.replace(/\//g, '_')}_${scenario.title.replace(/\s+/g, '_')}`,
          endpoint: endpoint.path,
          method: endpoint.method,
          feature: {
            title: feature.title,
            description: feature.description || '',
            scenarios: [scenario],
          },
          request: this.generateTestRequest(parameterAnalysis, scenario.title),
          expectedResponse: this.generateExpectedResponse(responseAnalysis, scenario.title),
        };
        testCases.push(testCase);
      }
    }

    // Calculate coverage metrics
    const coverage = {
      pathCoverage: 100, // Single endpoint, 100% coverage
      parameterCombinations: Math.min(
        Math.pow(
          2,
          parameterAnalysis.requiredParams.length + parameterAnalysis.optionalParams.length,
        ),
        50,
      ),
      errorScenarios: responseAnalysis.errorScenarios.length,
      businessRules: responseAnalysis.businessRules.length,
    };

    // Generate recommendations
    const recommendations = [];
    if (endpointAnalysis.complexityLevel === 'complex') {
      recommendations.push('Consider additional integration tests due to endpoint complexity');
    }
    if (endpointAnalysis.riskFactors.length > 3) {
      recommendations.push('High number of risk factors detected - prioritize security testing');
    }
    if (testCases.length > 20) {
      recommendations.push('Large test suite - consider organizing into test groups');
    }

    console.log(`✅ Generated ${testCases.length} final test cases`);
    console.log(`📊 Coverage metrics calculated`);
    console.log(`💡 ${recommendations.length} recommendations generated`);

    return {
      ...state,
      testCases,
      coverage,
      recommendations,
    };
  }

  // Helper methods

  private generateTestRequest(parameterAnalysis: any, scenarioTitle: string): any {
    const request: any = {};

    if (scenarioTitle.includes('valid') || scenarioTitle.includes('success')) {
      // Generate valid request data
      for (const param of parameterAnalysis.requiredParams) {
        request[param.name] = this.generateValidValue(param);
      }
    } else if (scenarioTitle.includes('invalid') || scenarioTitle.includes('error')) {
      // Generate invalid request data
      for (const param of parameterAnalysis.requiredParams) {
        request[param.name] = this.generateInvalidValue(param);
      }
    }

    return request;
  }

  private generateExpectedResponse(responseAnalysis: any, scenarioTitle: string): any {
    if (scenarioTitle.includes('success') || scenarioTitle.includes('valid')) {
      const successScenario = responseAnalysis.successScenarios[0];
      return {
        status: successScenario?.statusCode || 200,
        schema: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            message: { type: 'string' },
          },
        },
      };
    } else {
      const errorScenario = responseAnalysis.errorScenarios.find((e: any) =>
        scenarioTitle.toLowerCase().includes(e.name.toLowerCase()),
      );
      return {
        status: errorScenario?.statusCode || 400,
        schema: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
          required: ['error'],
        },
      };
    }
  }

  private generateValidValue(param: any): any {
    switch (param.type) {
      case 'string':
        return 'valid_string_value';
      case 'number':
        return 42;
      case 'boolean':
        return true;
      case 'array':
        return ['item1', 'item2'];
      default:
        return 'default_value';
    }
  }

  private generateInvalidValue(param: any): any {
    switch (param.type) {
      case 'string':
        return ''; // Empty string for required field
      case 'number':
        return 'not_a_number';
      case 'boolean':
        return 'not_a_boolean';
      default:
        return null;
    }
  }

  private parseJsonResponse(content: string): any {
    try {
      return JSON.parse(content);
    } catch {
      // Extract JSON from markdown code blocks or other formatting
      const jsonMatch =
        content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1] || jsonMatch[0]);
      }
      throw new Error('Failed to parse JSON response');
    }
  }
}

import fs from 'fs';
import path from 'path';
import { ApiSchema, GherkinFeature, TestCase, TestResult } from '../types';
import { ApiSchemaParser } from './parser';
import { GherkinGenerator } from './gherkinGenerator';
import { CurlRunner } from '../runners/curlRunner';
import { NonFunctionalRunner } from '../runners/nonFunctionalRunner';
import { MockDataGenerator } from '../mockers/dataGenerator';
import dotenv from 'dotenv';
import {
  NonFunctionalConfig,
  NonFunctionalTestType,
  EnhancedTestCase,
  EnhancedTestResult,
  PerformanceTestConfig,
  SecurityTestConfig,
  ReliabilityTestConfig,
  LoadTestConfig,
} from '../types/nonfunctional';

dotenv.config();

export enum RunnerType {
  CURL = 'curl',
}

/**
 * Configuration options for the test engine
 */
export interface EngineConfig {
  /**
   * Whether to use AI for generating test cases
   */
  useAI: boolean;

  /**
   * Whether to enable debug logging
   */
  debug?: boolean;

  /**
   * Whether to enable non-functional testing
   */
  enableNonFunctionalTests?: boolean;

  /**
   * Default non-functional test configurations (if enabled)
   */
  nonFunctionalDefaults?: {
    performance?: Partial<PerformanceTestConfig>;
    security?: Partial<SecurityTestConfig>;
    reliability?: Partial<ReliabilityTestConfig>;
    load?: Partial<LoadTestConfig>;
  };
}

export class TestEngine {
  private parser: ApiSchemaParser;
  private gherkinGenerator: GherkinGenerator;
  private curlRunner: CurlRunner;
  private nonFunctionalRunner: NonFunctionalRunner;
  private mockDataGenerator: MockDataGenerator;
  private testCases: Map<string, TestCase>;
  private features: Map<string, GherkinFeature>;
  private apiSchema: ApiSchema | null;
  private useAI: boolean;
  private debug: boolean;
  private config: EngineConfig;
  private enableNonFunctionalTests: boolean;
  private nonFunctionalDefaults: EngineConfig['nonFunctionalDefaults'];

  constructor(config?: Partial<EngineConfig>) {
    this.config = {
      useAI: config?.useAI ?? true,
      debug: config?.debug ?? false,
      enableNonFunctionalTests: true,
      nonFunctionalDefaults: config?.nonFunctionalDefaults || {
        performance: {
          type: NonFunctionalTestType.PERFORMANCE,
          enabled: true,
          maxResponseTime: 1000, // Default: 1000ms (1s)
          repetitions: 5,
        },
        security: {
          type: NonFunctionalTestType.SECURITY,
          enabled: true,
          sqlInjection: true,
          xss: true,
          headers: false,
          strictSecurity: false,
        },
        reliability: {
          type: NonFunctionalTestType.RELIABILITY,
          enabled: true,
          executions: 10,
          minSuccessRate: 0.95, // 95% success rate
        },
        load: {
          type: NonFunctionalTestType.LOAD,
          enabled: true,
          users: 5,
          duration: 10, // 10 seconds
          maxResponseTime: 2000, // 2s under load
        },
      },
    };

    this.debug = this.config.debug || false;
    this.useAI = this.config.useAI;
    this.enableNonFunctionalTests = true;
    this.nonFunctionalDefaults = this.config.nonFunctionalDefaults;

    if (this.debug) {
      console.log(`🔧 TestEngine initialized with config: ${JSON.stringify(this.config)}`);
    }

    this.parser = new ApiSchemaParser();
    this.gherkinGenerator = new GherkinGenerator(this.useAI);
    this.curlRunner = new CurlRunner();
    this.nonFunctionalRunner = new NonFunctionalRunner();
    this.mockDataGenerator = new MockDataGenerator(this.useAI);
    this.testCases = new Map();
    this.features = new Map();
    this.apiSchema = null;
  }

  /**
   * Load API schema from file
   * @param schemaPath Path to API schema file
   */
  async loadApiSchema(schemaPath: string): Promise<ApiSchema> {
    try {
      const schema = await this.parser.parseFromFile(schemaPath);
      this.apiSchema = schema;
      return schema;
    } catch (error) {
      throw new Error(`Failed to load API schema: ${error}`);
    }
  }

  /**
   * Generate test cases from API schema
   * @returns Generated test cases
   */
  async generateTestCases(): Promise<Map<string, TestCase>> {
    if (!this.apiSchema) {
      throw new Error('API schema not loaded');
    }

    this.testCases.clear();
    this.features.clear();

    const endpoints = this.parser.extractEndpoints(this.apiSchema);

    for (const { path, method, operation } of endpoints) {
      const feature = await this.gherkinGenerator.generateFeature(path, method, operation);

      const featureId = `${method}_${path.replace(/\//g, '_').replace(/[*?<>|:"\\]/g, '_')}`;
      this.features.set(featureId, feature);

      const context = `This is for the ${method.toUpperCase()} ${path} endpoint. ${
        operation.summary || ''
      } ${operation.description || ''}`;

      const testCase: TestCase = {
        id: this.gherkinGenerator.generateTestId(),
        feature,
        endpoint: path,
        method,

        request: operation.requestBody
          ? await this.mockDataGenerator.generateFromSchema(
              this.parser.extractRequestBodySchema(operation),
              context,
            )
          : undefined,
        expectedResponse: operation.responses?.['200']
          ? {
              status: 200,
              schema: this.parser.extractResponseSchema(operation, '200'),
            }
          : undefined,
      };

      // Add non-functional tests if enabled
      if (this.enableNonFunctionalTests) {
        this.addNonFunctionalTestConfigs(testCase as EnhancedTestCase);
      }

      this.testCases.set(testCase.id, testCase);
    }

    return this.testCases;
  }

  /**
   * Add non-functional test configurations to a test case
   * @param testCase Test case to enhance with non-functional tests
   */
  private addNonFunctionalTestConfigs(testCase: EnhancedTestCase): void {
    if (!this.enableNonFunctionalTests || !this.nonFunctionalDefaults) {
      return;
    }

    const nonFunctionalTests: NonFunctionalConfig[] = [];

    // Add performance test
    if (this.nonFunctionalDefaults.performance) {
      nonFunctionalTests.push({
        ...this.nonFunctionalDefaults.performance,
        type: NonFunctionalTestType.PERFORMANCE,
        enabled: this.nonFunctionalDefaults.performance.enabled ?? true,
      } as PerformanceTestConfig);
    }

    // Add security test
    if (this.nonFunctionalDefaults.security) {
      nonFunctionalTests.push({
        ...this.nonFunctionalDefaults.security,
        type: NonFunctionalTestType.SECURITY,
        enabled: this.nonFunctionalDefaults.security.enabled ?? true,
      } as SecurityTestConfig);
    }

    // Add reliability test
    if (this.nonFunctionalDefaults.reliability) {
      nonFunctionalTests.push({
        ...this.nonFunctionalDefaults.reliability,
        type: NonFunctionalTestType.RELIABILITY,
        enabled: this.nonFunctionalDefaults.reliability.enabled ?? true,
      } as ReliabilityTestConfig);
    }

    // Add load test
    if (this.nonFunctionalDefaults.load) {
      nonFunctionalTests.push({
        ...this.nonFunctionalDefaults.load,
        type: NonFunctionalTestType.LOAD,
        enabled: this.nonFunctionalDefaults.load.enabled ?? true,
      } as LoadTestConfig);
    }

    testCase.nonFunctionalTests = nonFunctionalTests;
  }

  /**
   * Save generated features to files
   * @param outputDir Directory to save feature files
   */
  saveFeatureFiles(outputDir: string): void {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const [id, feature] of this.features.entries()) {
      const featureContent = this.gherkinGenerator.featureToString(feature);
      // Sanitize filename by replacing invalid characters with underscores
      const sanitizedId = id.replace(/[*?<>|:"\\\/]/g, '_');
      const filePath = path.join(outputDir, `${sanitizedId}.feature`);
      fs.writeFileSync(filePath, featureContent, 'utf8');
    }
  }

  /**
   * Execute tests
   * @param baseUrl Base URL for API requests
   * @param testCaseIds Optional array of test case IDs to run (all if not specified)
   * @returns Test results
   */
  async executeTests(baseUrl: string, testCaseIds?: string[]): Promise<Map<string, TestResult>> {
    const results = new Map<string, TestResult>();

    this.curlRunner.setBaseUrl(baseUrl);
    this.nonFunctionalRunner.setBaseUrl(baseUrl);

    const testCasesToRun = testCaseIds
      ? Array.from(this.testCases.entries())
          .filter(([id]) => testCaseIds.includes(id))
          .map(([, testCase]) => testCase)
      : Array.from(this.testCases.values());

    for (const testCase of testCasesToRun) {
      let result: TestResult;

      // Run non-functional tests if enabled
      if (this.enableNonFunctionalTests && 'nonFunctionalTests' in testCase) {
        const enhancedTestCase = testCase as EnhancedTestCase;
        result = await this.nonFunctionalRunner.executeNonFunctionalTests(enhancedTestCase);
      } else {
        // Run standard functional test
        result = await this.curlRunner.executeTest(testCase);
      }

      results.set(testCase.id, result);
    }

    return results;
  }

  /**
   * Execute non-functional tests only
   * @param baseUrl Base URL for API requests
   * @param testCaseIds Optional array of test case IDs to run (all if not specified)
   * @returns Enhanced test results with non-functional testing results
   */
  async executeNonFunctionalTests(
    baseUrl: string,
    testCaseIds?: string[],
  ): Promise<Map<string, EnhancedTestResult>> {
    if (!this.enableNonFunctionalTests) {
      throw new Error(
        'Non-functional testing is not enabled. Set enableNonFunctionalTests: true in the TestEngine config.',
      );
    }

    const results = new Map<string, EnhancedTestResult>();

    this.nonFunctionalRunner.setBaseUrl(baseUrl);

    const testCasesToRun = testCaseIds
      ? Array.from(this.testCases.entries())
          .filter(([id]) => testCaseIds.includes(id))
          .map(([, testCase]) => testCase as EnhancedTestCase)
      : Array.from(this.testCases.values()).map((testCase) => testCase as EnhancedTestCase);

    if (this.debug) {
      console.log(`🚀 Executing non-functional tests for ${testCasesToRun.length} test cases`);
    }

    for (const testCase of testCasesToRun) {
      // Ensure the test case has non-functional test configs
      if (!testCase.nonFunctionalTests || testCase.nonFunctionalTests.length === 0) {
        this.addNonFunctionalTestConfigs(testCase);
      }

      const result = await this.nonFunctionalRunner.executeNonFunctionalTests(testCase);
      results.set(testCase.id, result);
    }

    return results;
  }

  /**
   * Formats the non-functional test results for display
   * @param results Map of test results
   * @returns Formatted string for console output
   */
  formatNonFunctionalResults(results: Map<string, EnhancedTestResult>): string {
    let output = '\n== NON-FUNCTIONAL TEST RESULTS ==\n\n';

    for (const [id, result] of results.entries()) {
      const testCase = this.getTestCase(id);
      if (!testCase) continue;

      output += `📊 ${testCase.method.toUpperCase()} ${testCase.endpoint} (${id}):\n`;

      // Show functional test result
      output += `  Functional Test: ${result.success ? '✅ PASS' : '❌ FAIL'}\n`;
      output += `  Response Time: ${result.duration}ms\n`;

      // Show non-functional test results if available
      if (result.nonFunctionalResults && result.nonFunctionalResults.length > 0) {
        output += `  Non-Functional Tests:\n`;

        for (const nonFunctionalResult of result.nonFunctionalResults) {
          const statusIcon = nonFunctionalResult.success ? '✅' : '❌';
          output += `    ${statusIcon} ${nonFunctionalResult.type}: ${nonFunctionalResult.details || ''}\n`;

          // Add metrics details
          if (Object.keys(nonFunctionalResult.metrics).length > 0) {
            output += '      Metrics:\n';
            for (const [key, value] of Object.entries(nonFunctionalResult.metrics)) {
              if (typeof value !== 'object') {
                output += `        ${key}: ${value}\n`;
              }
            }
          }

          // Add error details if any
          if (nonFunctionalResult.error) {
            output += `      Error: ${nonFunctionalResult.error}\n`;
          }
        }
      }

      output += '\n';
    }

    return output;
  }

  /**
   * Get test case by ID
   * @param id Test case ID
   * @returns Test case if found, undefined otherwise
   */
  getTestCase(id: string): TestCase | undefined {
    return this.testCases.get(id);
  }

  /**
   * Get all test cases
   * @returns Map of test cases
   */
  getAllTestCases(): Map<string, TestCase> {
    return this.testCases;
  }

  /**
   * Sets the API schema to use for test generation
   * This allows for using a pre-processed schema (e.g., with resolved references)
   *
   * @param schema The OpenAPI schema object
   */
  public setApiSchema(schema: any): void {
    if (this.debug) {
      console.log('📝 Setting API schema manually');
    }
    this.apiSchema = schema;
  }

  /**
   * Toggle non-functional testing on/off
   * @param enable Whether to enable non-functional testing
   */
  public enableNonFunctional(enable: boolean): void {
    this.enableNonFunctionalTests = enable;
    if (this.debug) {
      console.log(
        `${enable ? '🚀' : '🛑'} Non-functional testing ${enable ? 'enabled' : 'disabled'}`,
      );
    }
  }

  /**
   * Configure non-functional testing defaults
   * @param config Configuration object for non-functional tests
   */
  public configureNonFunctionalTests(config: EngineConfig['nonFunctionalDefaults']): void {
    if (!config) return;

    this.nonFunctionalDefaults = {
      ...this.nonFunctionalDefaults,
      ...config,
    };

    if (this.debug) {
      console.log('📝 Updated non-functional test configuration');
    }
  }
}

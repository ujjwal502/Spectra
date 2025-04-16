import fs from 'fs';
import path from 'path';
import { ApiSchema, GherkinFeature, TestCase, TestResult } from '../types';
import { ApiSchemaParser } from './parser';
import { GherkinGenerator } from './gherkinGenerator';
import { RestClient } from '../runners/restClient';
import { PostmanRunner } from '../runners/postmanRunner';
import { MockDataGenerator } from '../mockers/dataGenerator';
import dotenv from 'dotenv';

dotenv.config();

export enum RunnerType {
  REST = 'rest',
  POSTMAN = 'postman',
}

export class TestEngine {
  private parser: ApiSchemaParser;
  private gherkinGenerator: GherkinGenerator;
  private restClient: RestClient;
  private postmanRunner: PostmanRunner;
  private mockDataGenerator: MockDataGenerator;
  private testCases: Map<string, TestCase>;
  private features: Map<string, GherkinFeature>;
  private apiSchema: ApiSchema | null;
  private useAI: boolean;
  private runnerType: RunnerType;

  constructor(options: { useAI?: boolean; runnerType?: RunnerType } = {}) {
    this.useAI = options.useAI ?? (process.env.OPENAI_API_KEY ? true : false);
    this.runnerType = options.runnerType || RunnerType.REST;
    this.parser = new ApiSchemaParser();
    this.gherkinGenerator = new GherkinGenerator(this.useAI);
    this.restClient = new RestClient();
    this.postmanRunner = new PostmanRunner();
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
      const featureId = `${method}_${path.replace(/\//g, '_')}`;
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

      this.testCases.set(testCase.id, testCase);
    }

    return this.testCases;
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
      const filePath = path.join(outputDir, `${id}.feature`);
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

    this.restClient.setBaseUrl(baseUrl);
    this.postmanRunner.setBaseUrl(baseUrl);

    const testCasesToRun = testCaseIds
      ? Array.from(this.testCases.entries())
          .filter(([id]) => testCaseIds.includes(id))
          .map(([, testCase]) => testCase)
      : Array.from(this.testCases.values());

    for (const testCase of testCasesToRun) {
      let result: TestResult;

      if (this.runnerType === RunnerType.POSTMAN) {
        result = await this.postmanRunner.executeTest(testCase);
      } else {
        result = await this.restClient.executeTest(testCase);
      }

      results.set(testCase.id, result);
    }

    return results;
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
   * Set the runner type
   * @param type Runner type
   */
  setRunnerType(type: RunnerType): void {
    this.runnerType = type;
  }
}

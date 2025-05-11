export interface ApiSchema {
  openapi?: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, any>;
    parameters?: Record<string, any>;
    responses?: Record<string, any>;
  };
}

export interface PathItem {
  summary?: string;
  description?: string;
  get?: Operation;
  post?: Operation;
  put?: Operation;
  delete?: Operation;
  patch?: Operation;
  options?: Operation;
  head?: Operation;
  parameters?: Parameter[];
}

export interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses?: Record<string, Response>;
}

export interface Parameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  schema?: any;
}

export interface RequestBody {
  description?: string;
  content: Record<string, MediaType>;
  required?: boolean;
}

export interface MediaType {
  schema?: any;
  examples?: Record<string, Example>;
}

export interface Response {
  description: string;
  content?: Record<string, MediaType>;
}

export interface Example {
  value: any;
  summary?: string;
  description?: string;
}

export interface GherkinFeature {
  title: string;
  description?: string;
  scenarios: GherkinScenario[];
}

export interface GherkinScenario {
  title: string;
  steps: GherkinStep[];
  tags?: string[];
}

export interface GherkinStep {
  keyword: 'Given' | 'When' | 'Then' | 'And' | 'But';
  text: string;
}

export interface FileUpload {
  fieldName: string;
  filePath: string;
  fileName?: string;
  contentType?: string;
}

export interface TestCase {
  id: string;
  feature: GherkinFeature;
  endpoint: string;
  method: string;
  request?: any;
  expectedResponse?: any;
  files?: FileUpload[];
}

export interface TestResult {
  testCase: TestCase;
  success: boolean;
  duration: number;
  response?: any;
  error?: string;
  assertions?: AssertionResult[];
}

export interface AssertionResult {
  name: string;
  success: boolean;
  error?: string;
  info?: string;
}

export interface Config {
  api: {
    defaultTimeout: number;
    retryAttempts: number;
    retryDelay: number;
  };
  openai: {
    apiKey: string;
    model: string;
    maxCompletionTokens: number;
    temperature: number;
    defaultOnly: boolean;
  };
  gherkin: {
    templates: {
      feature: string;
      scenario: string;
      step: string;
    };
  };
  runner: {
    parallel: number;
    defaultEnvironment: string;
  };
  mock: {
    dataPath: string;
  };
}

// Regression Testing Types
export interface RegressionResult {
  id: string;
  endpoint: string;
  method: string;
  baselineSuccess: boolean;
  currentSuccess: boolean;
  statusCodeChanged: boolean;
  baselineStatus?: number;
  currentStatus?: number;
  responseChanged: boolean;
  responseChanges?: ResponseDiff[];
  assertionsChanged: boolean;
  assertionChanges?: AssertionDiff[];
  isRegression: boolean;
}

export interface ResponseDiff {
  path: string;
  baselineValue: any;
  currentValue: any;
  details?: string[];
}

export interface AssertionDiff {
  name: string;
  baselineSuccess: boolean;
  currentSuccess: boolean;
}

export interface RegressionSummary {
  totalTests: number;
  newTests: number;
  removedTests: number;
  matchingTests: number;
  regressedTests: number;
  improvedTests: number;
  unchangedTests: number;
  details: RegressionResult[];
}

// Code to OpenAPI Generator Types
export interface ApiStructure {
  name: string;
  description?: string;
  version?: string;
  basePath?: string;
  endpoints: EndpointInfo[];
  models: ModelInfo[];
  securitySchemes?: SecurityScheme[];
}

export interface EndpointInfo {
  path: string;
  method: string;
  summary?: string;
  description?: string;
  parameters?: ParameterInfo[];
  requestBody?: RequestBodyInfo;
  responses?: ResponseInfo[];
  security?: SecurityRequirement[];
  tags?: string[];
}

export interface ParameterInfo {
  name: string;
  location: 'path' | 'query' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  schema?: SchemaInfo;
}

export interface RequestBodyInfo {
  description?: string;
  required?: boolean;
  contentType?: string;
  schema?: SchemaInfo;
}

export interface ResponseInfo {
  statusCode: string | number;
  description?: string;
  contentType?: string;
  schema?: SchemaInfo;
}

export interface ModelInfo {
  name: string;
  description?: string;
  properties: PropertyInfo[];
  required?: string[];
}

export interface PropertyInfo {
  name: string;
  type: string;
  description?: string;
  format?: string;
  enum?: any[];
  items?: SchemaInfo;
  properties?: PropertyInfo[];
  required?: boolean;
}

export interface SchemaInfo {
  type?: string;
  format?: string;
  reference?: string;
  description?: string;
  enum?: any[];
  items?: SchemaInfo;
  properties?: PropertyInfo[];
  required?: string[];
}

export interface SecurityScheme {
  name: string;
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  location?: 'query' | 'header' | 'cookie';
  scheme?: string;
}

export interface SecurityRequirement {
  name: string;
  scopes?: string[];
}

export interface CodebaseAnalysisResult {
  detectedLanguage: string;
  detectedFramework: string;
  apiStructure: ApiStructure;
  parserUsed: string;
  warnings?: string[];
}

/**
 * Configuration options for the SpecGenerator
 */
export interface SpecGeneratorOptions {
  /**
   * Whether to preserve API prefix paths like /api in routes
   */
  preserveApiPrefix: boolean;

  /**
   * Whether to group endpoints by resource type
   */
  groupByResource: boolean;

  /**
   * Whether to enhance parameter names with resource context
   */
  enhanceParameterNames: boolean;

  /**
   * Whether to extract JSDoc comments for route documentation
   */
  extractJSDocComments: boolean;

  /**
   * Base URL for the API server
   */
  baseUrl: string;
}

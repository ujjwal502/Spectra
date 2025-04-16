export interface ApiSchema {
  info: {
    title: string;
    version: string;
    description?: string;
  };
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
    maxTokens: number;
    temperature: number;
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

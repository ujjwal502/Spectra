import { OpenAPIV3 } from 'openapi-types';

// State interface for our LangGraph workflow
export interface TestingState {
  // Understanding Layer
  apiSpec: OpenAPIV3.Document;
  systemMap?: SystemMap;

  // Testing Layer
  testScenarios: TestScenario[];
  testResults: TestResult[];

  // Gherkin Layer (NEW)
  gherkinFeatures: GherkinFeature[];
  gherkinSummary?: GherkinSummary;

  // Analysis Layer
  analysis?: TestAnalysis;
  recommendations: string[];

  // Workflow control
  currentPhase: 'understanding' | 'testing' | 'gherkin' | 'execution' | 'analysis' | 'complete';
  messages: string[];
}

export interface SystemMap {
  endpoints: EndpointInfo[];
  schemas: SchemaInfo[];
  dataFlow: DataFlowInfo[];
  dependencies: DependencyInfo[];
}

export interface EndpointInfo {
  path: string;
  method: string;
  parameters: ParameterInfo[];
  requestBody?: SchemaInfo;
  responses: ResponseInfo[];
  relatedEndpoints: string[];
}

export interface ParameterInfo {
  name: string;
  type: string;
  required: boolean;
  validValues?: any[];
  format?: string;
}

export interface SchemaInfo {
  name: string;
  type: string;
  properties: Record<string, any>;
  required: string[];
  examples: any[];
}

export interface TestScenario {
  id: string;
  type: 'functional' | 'security' | 'boundary' | 'error' | 'integration';
  endpoint: string;
  method: string;
  description: string;
  intent: string;
  testData: any;
  expectedOutcome: ExpectedOutcome;
  dependencies: string[];
}

export interface ExpectedOutcome {
  statusCode: number;
  schema?: any;
  errorType?: string;
  securityCheck?: string;
}

export interface TestResult {
  scenarioId: string;
  success: boolean;
  actualStatusCode: number;
  expectedStatusCode: number;
  response: any;
  duration: number;
  errors: string[];
  insights: string[];
}

export interface TestAnalysis {
  overallSuccessRate: number;
  phaseResults: Record<string, number>;
  criticalIssues: Issue[];
  patterns: Pattern[];
  riskAssessment: RiskAssessment;
}

export interface Issue {
  type: 'critical' | 'warning' | 'info';
  category: 'security' | 'functionality' | 'performance' | 'data-integrity';
  description: string;
  affectedEndpoints: string[];
  recommendation: string;
}

export interface Pattern {
  type: string;
  description: string;
  frequency: number;
  examples: string[];
}

export interface RiskAssessment {
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
  mitigations: string[];
}

export interface DataFlowInfo {
  source: string;
  target: string;
  dataType: string;
  transformations: string[];
}

export interface DependencyInfo {
  endpoint: string;
  dependsOn: string[];
  affects: string[];
  type: 'data' | 'state' | 'security';
}

export interface ResponseInfo {
  statusCode: number;
  schema?: any;
  description: string;
}

// NEW: Gherkin-related interfaces
export interface GherkinFeature {
  title: string;
  description: string;
  background?: GherkinBackground;
  scenarios: GherkinScenario[];
  tags: string[];
  endpointContext: {
    path: string;
    method: string;
    businessDomain: string;
  };
}

export interface GherkinBackground {
  title: string;
  steps: GherkinStep[];
}

export interface GherkinScenario {
  title: string;
  description?: string;
  tags: string[];
  steps: GherkinStep[];
  examples?: GherkinExampleTable;
  testScenarioId?: string; // Links to TestScenario
}

export interface GherkinStep {
  keyword: 'Given' | 'When' | 'Then' | 'And' | 'But';
  text: string;
  docString?: string;
  dataTable?: string[][];
}

export interface GherkinExampleTable {
  headers: string[];
  rows: string[][];
}

export interface GherkinSummary {
  totalFeatures: number;
  totalScenarios: number;
  featuresByDomain: Record<string, number>;
  scenariosByType: Record<string, number>;
  coverageMetrics: {
    endpointsCovered: number;
    businessRulesCovered: number;
    errorScenariosCovered: number;
  };
}

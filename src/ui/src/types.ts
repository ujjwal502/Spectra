export interface TestStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  description: string;
  startTime?: Date | string;
  endTime?: Date | string;
  duration?: number;
  details?: any;
}

export interface TestResult {
  id: string;
  testCase: {
    id: string;
    endpoint: string;
    method: string;
    feature: {
      title: string;
      description?: string;
    };
  };
  success: boolean;
  duration: number;
  response?: any;
  error?: string;
  assertions?: Array<{
    name: string;
    success: boolean;
    error?: string;
  }>;
  nonFunctionalResults?: Array<{
    type: string;
    success: boolean;
    metrics: Record<string, any>;
    details?: string;
    error?: string;
  }>;
}

export interface DemoMetrics {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
  coverage: number;
  performanceMetrics?: {
    avgResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
  };
  securityMetrics?: {
    vulnerabilitiesFound: number;
    securityScore: number;
  };
}

export interface LogEntry {
  timestamp: Date | string;
  message: string;
  level?: 'info' | 'warn' | 'error' | 'success';
}

export interface GeneratedCode {
  gherkin: string;
  testCases: string;
  openApiSpec: string;
}

export interface DemoState {
  isRunning: boolean;
  currentStep: TestStep | null;
  steps: TestStep[];
  testResults: TestResult[];
  metrics: DemoMetrics;
  logs: LogEntry[];
  generatedCode: GeneratedCode;
}

export interface DemoConfig {
  apiUrl: string;
  schemaPath?: string;
  testType: 'functional' | 'non-functional' | 'both' | 'backend';
  useAI: boolean;
  endpoints?: string[];
  generateSpec?: boolean;
  sourcePath?: string;
  description?: string;
}

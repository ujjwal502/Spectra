const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Try to import Spectra components, fallback to mock if not available
let TestEngine, EnhancedSpecIntegration;
try {
  TestEngine = require('../core/engine').TestEngine;
  EnhancedSpecIntegration =
    require('../integrations/enhancedSpecIntegration').EnhancedSpecIntegration;
} catch (error) {
  console.warn('Spectra components not found, using mock implementations for demo');
  // Mock implementations for demo purposes
  TestEngine = class MockTestEngine {
    constructor(config) {
      this.config = config;
      this.testCases = new Map();
    }

    async loadApiSchema(schemaPath) {
      // Mock implementation
      return Promise.resolve();
    }

    setApiSchema(schema) {
      // Mock implementation
    }

    async generateTestCases() {
      // Generate mock test cases
      const mockTestCases = new Map();
      const endpoints = ['/users', '/posts', '/comments'];
      const methods = ['GET', 'POST', 'PUT', 'DELETE'];

      for (let i = 0; i < 5; i++) {
        const endpoint = endpoints[i % endpoints.length];
        const method = methods[i % methods.length];
        const id = `test-${i + 1}`;

        mockTestCases.set(id, {
          id,
          endpoint: `${endpoint}${i > 0 ? `/${i}` : ''}`,
          method,
          feature: {
            title: `Test ${method} ${endpoint}`,
            description: `Verify ${method} operation on ${endpoint} endpoint`,
            scenarios: [
              {
                title: `Should handle ${method} request successfully`,
                steps: [
                  { keyword: 'Given', text: `the API is available` },
                  { keyword: 'When', text: `I send a ${method} request to ${endpoint}` },
                  { keyword: 'Then', text: `I should receive a valid response` },
                ],
              },
            ],
          },
          request: {},
          expectedResponse: { status: 200 },
        });
      }

      this.testCases = mockTestCases;
      return mockTestCases;
    }

    getAllTestCases() {
      return this.testCases;
    }

    async executeTests(apiUrl, testIds) {
      const results = new Map();

      for (const id of testIds) {
        const testCase = this.testCases.get(id);
        if (testCase) {
          // Simulate test execution
          await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000));

          const success = Math.random() > 0.2; // 80% success rate
          const duration = 100 + Math.random() * 500;

          results.set(id, {
            testCase,
            success,
            duration: Math.round(duration),
            response: success ? { status: 200, data: {} } : null,
            error: success ? null : 'Mock error for demonstration',
            assertions: [
              {
                name: 'Status code is 200',
                success,
                error: success ? null : 'Expected 200, got 500',
              },
              { name: 'Response has valid structure', success: success || Math.random() > 0.5 },
            ],
          });
        }
      }

      return results;
    }

    async executeNonFunctionalTests(apiUrl, testIds) {
      const results = new Map();

      for (const id of testIds) {
        const testCase = this.testCases.get(id);
        if (testCase) {
          await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 1200));

          results.set(id, {
            testCase,
            duration: 150 + Math.random() * 300,
            nonFunctionalResults: [
              {
                type: 'performance',
                success: Math.random() > 0.3,
                metrics: {
                  responseTime: Math.round(100 + Math.random() * 400),
                  throughput: Math.round(50 + Math.random() * 100),
                  cpuUsage: Math.round(20 + Math.random() * 60),
                },
                details: 'Performance test completed',
              },
              {
                type: 'security',
                success: Math.random() > 0.1,
                metrics: {
                  vulnerabilities: Math.floor(Math.random() * 3),
                  securityScore: Math.round(7 + Math.random() * 3),
                },
                details: 'Security scan completed',
              },
            ],
          });
        }
      }

      return results;
    }
  };

  EnhancedSpecIntegration = class MockEnhancedSpecIntegration {
    constructor(config) {
      this.config = config;
    }

    async generateSpec(sourcePath) {
      // Mock enhanced OpenAPI spec generation
      await new Promise((resolve) => setTimeout(resolve, 2000));

      return {
        openapi: '3.0.0',
        info: {
          title: 'Mock API (Enhanced)',
          version: '1.0.0',
          description: 'Generated from enhanced AI-powered analysis',
        },
        servers: [{ url: this.config.baseUrl }],
        paths: {
          '/users': {
            get: {
              summary: 'Get all users',
              responses: { 200: { description: 'Success' } },
            },
            post: {
              summary: 'Create user',
              responses: { 201: { description: 'Created' } },
            },
          },
          '/users/{id}': {
            get: {
              summary: 'Get user by ID',
              parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
              responses: { 200: { description: 'Success' } },
            },
          },
        },
      };
    }
  };
}

// Generate UUID function
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// Store active test sessions
const activeTests = new Map();

class TestSession {
  constructor(socketId, config) {
    this.id = uuidv4();
    this.socketId = socketId;
    this.config = config;
    this.isRunning = false;
    this.steps = [];
    this.testResults = [];
    this.metrics = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      duration: 0,
      coverage: 0,
    };
    this.process = null;
    this.startTime = null;
  }

  async start() {
    this.isRunning = true;
    this.startTime = Date.now();
    this.emit('demo:started');

    try {
      // Check if backend is running
      await this.checkBackendHealth();

      // Start the actual backend test process
      await this.runBackendTest();
    } catch (error) {
      this.emit('demo:log', `Error: ${error.message}`);
      this.failCurrentStep(error.message);
      this.emit('demo:completed');
    } finally {
      this.isRunning = false;
    }
  }

  async checkBackendHealth() {
    this.addStep(
      'check-backend',
      'Checking Backend Health',
      'Verifying that the backend server is running on localhost:3000',
    );

    try {
      const response = await fetch('http://localhost:3000/health');
      if (!response.ok) {
        throw new Error(`Backend health check failed: ${response.status}`);
      }
      const data = await response.json();
      this.emit('demo:log', `✅ Backend is running: ${JSON.stringify(data)}`);
      this.completeStep('check-backend');
    } catch (error) {
      this.emit(
        'demo:log',
        '❌ Backend is not running. Please start it with: cd examples/backend && npm run dev',
      );
      throw new Error('Backend server is not accessible at http://localhost:3000');
    }
  }

  async runBackendTest() {
    this.addStep(
      'run-tests',
      'Running Backend Tests',
      'Executing npm run test:backend with real-time monitoring',
    );

    return new Promise((resolve, reject) => {
      // Get the project root directory (two levels up from src/ui)
      const projectRoot = path.resolve(__dirname, '../..');

      // Spawn the test process
      this.process = spawn('npm', ['run', 'test:backend'], {
        cwd: projectRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      let outputBuffer = '';
      let currentStep = null;

      // Handle stdout
      this.process.stdout.on('data', (data) => {
        const output = data.toString();
        outputBuffer += output;

        // Parse and emit logs
        const lines = output.split('\n').filter((line) => line.trim());
        lines.forEach((line) => {
          this.emit('demo:log', line);
          this.parseTestOutput(line);
        });
      });

      // Handle stderr
      this.process.stderr.on('data', (data) => {
        const output = data.toString();
        this.emit('demo:log', `Error: ${output}`);
      });

      // Handle process completion
      this.process.on('close', (code) => {
        if (code === 0) {
          this.completeStep('run-tests');
          this.emit('demo:log', '✅ Backend tests completed successfully');
          this.loadTestResults();
          resolve();
        } else {
          this.failCurrentStep(`Test process exited with code ${code}`);
          reject(new Error(`Test process failed with exit code ${code}`));
        }
        this.emit('demo:completed');
      });

      // Handle process errors
      this.process.on('error', (error) => {
        this.emit('demo:log', `Process error: ${error.message}`);
        this.failCurrentStep(error.message);
        reject(error);
      });
    });
  }

  parseTestOutput(line) {
    // Track completed steps to avoid duplicates
    if (!this.completedSteps) {
      this.completedSteps = new Set();
    }

    // Parse different types of output from the backend test
    if (line.includes('Starting Spectra backend API testing')) {
      this.addStep('init', 'Initializing Spectra', 'Starting backend API testing framework');
      this.completeStep('init');
    } else if (line.includes('Backend is running:') && !this.completedSteps.has('backend-health')) {
      this.completeStep('check-backend');
      this.completedSteps.add('backend-health');
    } else if (line.includes('Creating TestEngine')) {
      this.addStep(
        'create-engine',
        'Creating Test Engine',
        'Initializing Spectra test engine with AI capabilities',
      );
      this.completeStep('create-engine');
    } else if (
      line.includes('Loading API schema from') &&
      !this.completedSteps.has('load-schema')
    ) {
      this.addStep(
        'load-schema',
        'Loading API Schema',
        'Reading OpenAPI specification from backend/openapi.json',
      );
    } else if (
      line.includes('Successfully loaded API schema') &&
      !this.completedSteps.has('load-schema')
    ) {
      this.completeStep('load-schema');
      this.completedSteps.add('load-schema');
    } else if (
      line.includes('Resolving schema references') &&
      !this.completedSteps.has('resolve-refs')
    ) {
      this.addStep(
        'resolve-refs',
        'Resolving Schema References',
        'Processing OpenAPI schema references and dependencies',
      );
    } else if (
      line.includes('Schema references resolved') &&
      !this.completedSteps.has('resolve-refs')
    ) {
      this.completeStep('resolve-refs');
      this.completedSteps.add('resolve-refs');
    } else if (
      line.includes('Generating test cases') &&
      !this.completedSteps.has('generate-tests')
    ) {
      this.addStep(
        'generate-tests',
        'Generating Test Cases',
        'Creating AI-powered test cases from API schema',
      );
    } else if (
      line.includes('Generated') &&
      line.includes('test cases') &&
      !this.completedSteps.has('generate-tests')
    ) {
      this.completeStep('generate-tests');
      this.completedSteps.add('generate-tests');
      // Extract test count
      const match = line.match(/Generated (\d+) test cases/);
      if (match) {
        this.metrics.totalTests = parseInt(match[1]);
        this.emit('demo:metrics', this.metrics);
      }
    } else if (
      line.includes('Applying direct fixes to feature files') &&
      !this.completedSteps.has('fix-features')
    ) {
      this.addStep(
        'fix-features',
        'Applying Test Fixes',
        'Optimizing test cases for backend endpoints',
      );
    } else if (line.includes('Fixed post__') && !this.completedSteps.has('fix-features')) {
      // Complete when we see the first fix applied
      this.completeStep('fix-features');
      this.completedSteps.add('fix-features');
    } else if (
      line.includes('Saved Gherkin feature files') &&
      !this.completedSteps.has('save-features')
    ) {
      this.addStep(
        'save-features',
        'Saving Feature Files',
        'Writing Gherkin feature files to disk',
      );
      this.completeStep('save-features');
      this.completedSteps.add('save-features');
    } else if (
      line.includes('Final Test Cases:') &&
      !this.completedSteps.has('prepare-execution')
    ) {
      this.addStep(
        'prepare-execution',
        'Preparing Test Execution',
        'Finalizing test cases and preparing for execution',
      );
      this.completeStep('prepare-execution');
      this.completedSteps.add('prepare-execution');
    } else if (
      line.includes('Executing tests against') &&
      !this.completedSteps.has('execute-tests')
    ) {
      this.addStep(
        'execute-tests',
        'Executing Tests',
        'Running test cases against backend API endpoints',
      );
    } else if (line.includes('Test Results:') && !this.completedSteps.has('execute-tests')) {
      this.completeStep('execute-tests');
      this.completedSteps.add('execute-tests');
    } else if (
      line.includes('Generating HTML reports') &&
      !this.completedSteps.has('generate-reports')
    ) {
      this.addStep(
        'generate-reports',
        'Generating Reports',
        'Creating HTML test reports and documentation',
      );
    } else if (
      line.includes('HTML reports generated') &&
      !this.completedSteps.has('generate-reports')
    ) {
      this.completeStep('generate-reports');
      this.completedSteps.add('generate-reports');
    } else if (line.includes('Test results saved to') && !this.completedSteps.has('save-results')) {
      this.addStep('save-results', 'Saving Results', 'Persisting test results to JSON file');
      this.completeStep('save-results');
      this.completedSteps.add('save-results');
    }

    // Parse test results during execution
    if (line.includes('✅ PASS') || line.includes('❌ FAIL')) {
      this.parseTestResult(line);
    }

    // Parse summary metrics
    if (
      line.includes('Total:') ||
      line.includes('Passed:') ||
      line.includes('Failed:') ||
      line.includes('Success rate:')
    ) {
      this.parseMetrics(line);
    }
  }

  parseTestResult(line) {
    // Extract test result information from actual backend test output
    // Format: "  ✅ PASS test-1: GET /todos (123ms)" or "  ❌ FAIL test-2: POST /todos (456ms)"
    const resultMatch = line.match(
      /\s*(✅ PASS|❌ FAIL)\s+([^:]+):\s+(GET|POST|PUT|DELETE|PATCH)\s+([^\s]+)\s+\((\d+)ms\)/,
    );

    if (resultMatch) {
      const [, status, testId, method, endpoint, duration] = resultMatch;
      const isSuccess = status.includes('✅');

      const result = {
        id: testId,
        testCase: {
          id: testId,
          endpoint: endpoint,
          method: method.toLowerCase(),
          feature: {
            title: `Test ${method} ${endpoint}`,
            description: `Verify ${method} operation on ${endpoint} endpoint`,
          },
        },
        success: isSuccess,
        duration: parseInt(duration),
        assertions: [
          {
            name: 'Status code validation',
            success: isSuccess,
            error: isSuccess ? null : 'Status code mismatch',
          },
        ],
      };

      this.testResults.push(result);
      this.emit('demo:result', result);

      // Update metrics
      if (isSuccess) {
        this.metrics.passedTests++;
      } else {
        this.metrics.failedTests++;
      }
      this.emit('demo:metrics', this.metrics);
    }
  }

  parseMetrics(line) {
    // Parse summary metrics from test output
    const totalMatch = line.match(/Total:\s*(\d+)\s*tests/);
    const passedMatch = line.match(/Passed:\s*(\d+)\s*tests/);
    const failedMatch = line.match(/Failed:\s*(\d+)\s*tests/);
    const successRateMatch = line.match(/Success rate:\s*(\d+)%/);

    if (totalMatch) {
      this.metrics.totalTests = parseInt(totalMatch[1]);
    }
    if (passedMatch) {
      this.metrics.passedTests = parseInt(passedMatch[1]);
    }
    if (failedMatch) {
      this.metrics.failedTests = parseInt(failedMatch[1]);
    }
    if (successRateMatch) {
      this.metrics.coverage = parseInt(successRateMatch[1]);
    }

    // Calculate duration if we have start time
    if (this.startTime) {
      this.metrics.duration = Date.now() - this.startTime;
    }

    this.emit('demo:metrics', this.metrics);
  }

  async loadTestResults() {
    // Try to load the actual test results file
    try {
      const resultsPath = path.resolve(__dirname, '../../examples/backend/test-results.json');
      if (fs.existsSync(resultsPath)) {
        const resultsData = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

        // Convert actual results to UI format
        if (resultsData.results) {
          this.testResults = resultsData.results.map((result) => ({
            id: result.id || uuidv4(),
            testCase: {
              id: result.testCase?.id || uuidv4(),
              endpoint: result.testCase?.endpoint || 'Unknown',
              method: result.testCase?.method || 'GET',
              feature: {
                title:
                  result.testCase?.feature?.title ||
                  `Test ${result.testCase?.method} ${result.testCase?.endpoint}`,
                description: result.testCase?.feature?.description || '',
              },
            },
            success: result.success || false,
            duration: result.duration || 0,
            response: result.response,
            error: result.error,
            assertions: result.assertions || [],
            nonFunctionalResults: result.nonFunctionalResults || [],
          }));

          // Emit all results
          this.testResults.forEach((result) => {
            this.emit('demo:result', result);
          });

          // Update final metrics
          this.metrics = {
            totalTests: this.testResults.length,
            passedTests: this.testResults.filter((r) => r.success).length,
            failedTests: this.testResults.filter((r) => !r.success).length,
            duration: Date.now() - this.startTime,
            coverage: resultsData.summary?.coverage || 0,
          };

          // Add performance metrics if available
          if (resultsData.summary?.performanceMetrics) {
            this.metrics.performanceMetrics = resultsData.summary.performanceMetrics;
          }

          this.emit('demo:metrics', this.metrics);
        }
      }
    } catch (error) {
      this.emit('demo:log', `Warning: Could not load detailed test results: ${error.message}`);
    }
  }

  addStep(id, name, description) {
    const step = {
      id,
      name,
      description,
      status: 'running',
      startTime: new Date(),
    };

    this.steps.push(step);
    this.emit('demo:step', step);
    this.emit('demo:log', `Started: ${name}`);
  }

  completeStep(id) {
    const step = this.steps.find((s) => s.id === id);
    if (step) {
      step.status = 'completed';
      step.endTime = new Date();
      step.duration = step.endTime - step.startTime;
      this.emit('demo:step', step);
      this.emit('demo:log', `Completed: ${step.name} (${step.duration}ms)`);
    }
  }

  failCurrentStep(error) {
    const runningStep = this.steps.find((s) => s.status === 'running');
    if (runningStep) {
      runningStep.status = 'failed';
      runningStep.endTime = new Date();
      runningStep.duration = runningStep.endTime - runningStep.startTime;
      runningStep.error = error;
      this.emit('demo:step', runningStep);
    }
  }

  emit(event, data) {
    io.to(this.socketId).emit(event, data);
  }

  stop() {
    this.isRunning = false;
    if (this.process) {
      this.process.kill('SIGTERM');
    }
    this.emit('demo:completed');
  }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('demo:start', async (config) => {
    console.log('Starting backend test monitoring with config:', config);

    // Stop any existing test for this socket
    const existingTest = activeTests.get(socket.id);
    if (existingTest) {
      existingTest.stop();
    }

    // Create new test session
    const testSession = new TestSession(socket.id, config);
    activeTests.set(socket.id, testSession);

    // Start the test
    await testSession.start();
  });

  socket.on('demo:stop', () => {
    const testSession = activeTests.get(socket.id);
    if (testSession) {
      testSession.stop();
      activeTests.delete(socket.id);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const testSession = activeTests.get(socket.id);
    if (testSession) {
      testSession.stop();
      activeTests.delete(socket.id);
    }
  });
});

// Serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Demo server running on port ${PORT}`);
  console.log(`WebSocket server ready for real-time test monitoring`);
  console.log(`\nTo use:`);
  console.log(`1. Start backend: cd examples/backend && npm run dev`);
  console.log(`2. Open UI: http://localhost:${PORT}`);
  console.log(
    `3. Click "Start Backend Test" to run npm run test:backend with real-time monitoring`,
  );
});

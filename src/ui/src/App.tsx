import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import Header from './components/Header';
import DemoControls from './components/DemoControls';
import ProcessViewer from './components/ProcessViewer';
import TestResults from './components/TestResults';
import CodeViewer from './components/CodeViewer';
import MetricsPanel from './components/MetricsPanel';
import { DemoState, TestStep, TestResult } from './types';

const App: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const logsContainerRef = React.useRef<HTMLDivElement>(null);
  const [demoState, setDemoState] = useState<DemoState>({
    isRunning: false,
    currentStep: null,
    steps: [],
    testResults: [],
    metrics: {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      duration: 0,
      coverage: 0,
    },
    logs: [],
    generatedCode: {
      gherkin: '',
      testCases: '',
      openApiSpec: '',
    },
  });

  useEffect(() => {
    // Connect to WebSocket server
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    // Listen for demo events
    newSocket.on('demo:step', (step: TestStep) => {
      setDemoState((prev) => ({
        ...prev,
        currentStep: step,
        steps: [...prev.steps, step],
      }));
    });

    newSocket.on('demo:result', (result: TestResult) => {
      setDemoState((prev) => ({
        ...prev,
        testResults: [...prev.testResults, result],
      }));
    });

    newSocket.on('demo:metrics', (metrics: any) => {
      setDemoState((prev) => ({
        ...prev,
        metrics,
      }));
    });

    newSocket.on('demo:log', (log: string) => {
      setDemoState((prev) => ({
        ...prev,
        logs: [...prev.logs, { timestamp: new Date(), message: log }],
      }));

      // Auto-scroll to bottom when new log arrives
      setTimeout(() => {
        if (logsContainerRef.current) {
          logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
        }
      }, 100);
    });

    newSocket.on('demo:code', (code: any) => {
      setDemoState((prev) => ({
        ...prev,
        generatedCode: { ...prev.generatedCode, ...code },
      }));
    });

    newSocket.on('demo:started', () => {
      setDemoState((prev) => ({
        ...prev,
        isRunning: true,
        steps: [],
        testResults: [],
        logs: [],
      }));
    });

    newSocket.on('demo:completed', () => {
      setDemoState((prev) => ({
        ...prev,
        isRunning: false,
        currentStep: null,
      }));
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const startDemo = (config: any) => {
    if (socket) {
      socket.emit('demo:start', config);
    }
  };

  const stopDemo = () => {
    if (socket) {
      socket.emit('demo:stop');
    }
  };

  const clearDemo = () => {
    setDemoState((prev) => ({
      ...prev,
      steps: [],
      testResults: [],
      logs: [],
      currentStep: null,
      generatedCode: {
        gherkin: '',
        testCases: '',
        openApiSpec: '',
      },
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Top Section - Controls and Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-1">
            <DemoControls
              isRunning={demoState.isRunning}
              onStart={startDemo}
              onStop={stopDemo}
              onClear={clearDemo}
            />
          </div>
          <div className="lg:col-span-2">
            <MetricsPanel metrics={demoState.metrics} />
          </div>
        </div>

        {/* Middle Section - Process Timeline and Live Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div>
            <ProcessViewer
              currentStep={demoState.currentStep}
              steps={demoState.steps}
              logs={[]} // Remove logs from ProcessViewer
            />
          </div>
          <div>
            {/* Dedicated Live Logs Section */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Live Logs</h3>
                <span className="text-sm text-gray-500">{demoState.logs.length} entries</span>
              </div>
              <div className="card-body">
                <div
                  ref={logsContainerRef}
                  className="logs-container"
                  style={{ maxHeight: '500px', minHeight: '300px' }}
                >
                  {demoState.logs.length === 0 ? (
                    <div className="text-gray-500 text-center py-8">
                      No logs yet. Logs will appear here during test execution.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {demoState.logs.map((log, index) => (
                        <div key={index} className="log-entry">
                          <span className="log-timestamp">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span
                            className={`log-message ${
                              log.level === 'error'
                                ? 'log-error'
                                : log.level === 'warn'
                                  ? 'log-warning'
                                  : log.level === 'success'
                                    ? 'log-success'
                                    : ''
                            }`}
                          >
                            {log.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section - Test Results and Generated Code */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <TestResults results={demoState.testResults} />
          <CodeViewer code={demoState.generatedCode} />
        </div>
      </div>
    </div>
  );
};

export default App;

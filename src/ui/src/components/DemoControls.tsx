import React, { useState } from 'react';
import {
  Play,
  Square,
  RotateCcw,
  Settings,
  FileText,
  Zap,
  Server,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { DemoConfig } from '../types';

interface DemoControlsProps {
  isRunning: boolean;
  onStart: (config: DemoConfig) => void;
  onStop: () => void;
  onClear: () => void;
}

const DemoControls: React.FC<DemoControlsProps> = ({ isRunning, onStart, onStop, onClear }) => {
  const [config, setConfig] = useState<DemoConfig>({
    apiUrl: 'http://localhost:3000',
    testType: 'backend',
    useAI: true,
    description: 'Runs the existing backend test suite with real-time monitoring',
  });

  const handleStart = () => {
    onStart(config);
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="card-modern">
        <div className="flex items-center space-x-3 mb-6">
          <div className="control-icon-container bg-gradient-to-br from-indigo-500 to-purple-600">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Test Configuration</h2>
            <p className="text-sm text-gray-600">Configure and execute backend API tests</p>
          </div>
        </div>

        {/* Quick Setup Guide */}
        <div className="setup-guide">
          <div className="setup-header">
            <Server className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-gray-800">Quick Setup</h3>
          </div>
          <div className="setup-steps">
            <div className="setup-step">
              <div className="step-number">1</div>
              <div className="step-content">
                <div className="step-title">Start Backend Server</div>
                <div className="step-command">
                  <code>cd examples/backend && npm run dev</code>
                </div>
              </div>
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <div className="setup-step">
              <div className="step-number">2</div>
              <div className="step-content">
                <div className="step-title">Launch Test Suite</div>
                <div className="step-description">
                  Click "Start Backend Test" to execute npm run test:backend
                </div>
              </div>
              <Play className="w-5 h-5 text-blue-500" />
            </div>
            <div className="setup-step">
              <div className="step-number">3</div>
              <div className="step-content">
                <div className="step-title">Monitor Results</div>
                <div className="step-description">Watch real-time test execution and results</div>
              </div>
              <Zap className="w-5 h-5 text-yellow-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Card */}
      <div className="card-modern">
        <div className="config-section">
          <h3 className="config-title">
            <FileText className="w-5 h-5 text-gray-600" />
            Test Configuration
          </h3>

          {/* API URL Configuration */}
          <div className="config-field">
            <label className="config-label">Backend API URL</label>
            <div className="input-group">
              <Server className="input-icon" />
              <input
                type="url"
                value={config.apiUrl}
                onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
                className="config-input"
                placeholder="http://localhost:3000"
                disabled={isRunning}
              />
            </div>
            <div className="config-hint">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span>Ensure your backend server is running at this URL</span>
            </div>
          </div>

          {/* AI Enhancement Toggle */}
          <div className="config-toggle">
            <div className="toggle-container">
              <input
                type="checkbox"
                id="useAI"
                checked={config.useAI}
                onChange={(e) => setConfig({ ...config, useAI: e.target.checked })}
                className="toggle-input"
                disabled={isRunning}
              />
              <label htmlFor="useAI" className="toggle-label">
                <div className="toggle-switch">
                  <div className="toggle-thumb"></div>
                </div>
                <div className="toggle-content">
                  <div className="toggle-title">AI-Enhanced Testing</div>
                  <div className="toggle-description">
                    Enables intelligent test generation and analysis (requires OPENAI_API_KEY)
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Action Controls */}
      <div className="card-modern">
        <div className="controls-header">
          <h3 className="controls-title">Execute Tests</h3>
          <p className="controls-subtitle">Start your backend test suite or manage results</p>
        </div>

        <div className="controls-grid">
          {!isRunning ? (
            <button onClick={handleStart} className="control-btn control-btn-primary">
              <div className="control-icon bg-green-500">
                <Play className="w-5 h-5 text-white" />
              </div>
              <div className="control-content">
                <div className="control-title">Start Backend Test</div>
                <div className="control-subtitle">Execute test suite with monitoring</div>
              </div>
            </button>
          ) : (
            <button onClick={onStop} className="control-btn control-btn-danger">
              <div className="control-icon bg-red-500">
                <Square className="w-5 h-5 text-white" />
              </div>
              <div className="control-content">
                <div className="control-title">Stop Test Execution</div>
                <div className="control-subtitle">Terminate running tests</div>
              </div>
            </button>
          )}

          <button
            onClick={onClear}
            className="control-btn control-btn-secondary"
            disabled={isRunning}
          >
            <div className="control-icon bg-gray-500">
              <RotateCcw className="w-4 h-4 text-white" />
            </div>
            <div className="control-content">
              <div className="control-title">Clear Results</div>
              <div className="control-subtitle">Reset all test data</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DemoControls;

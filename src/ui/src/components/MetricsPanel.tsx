import React from 'react';
import {
  BarChart3,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  Zap,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { DemoMetrics } from '../types';

interface MetricsPanelProps {
  metrics: DemoMetrics;
}

const MetricsPanel: React.FC<MetricsPanelProps> = ({ metrics }) => {
  const successRate = metrics.totalTests > 0 ? (metrics.passedTests / metrics.totalTests) * 100 : 0;
  const completionRate =
    metrics.totalTests > 0
      ? ((metrics.passedTests + metrics.failedTests) / metrics.totalTests) * 100
      : 0;

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className="space-y-6">
      {/* Main Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tests */}
        <div className="metric-card-modern bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="metric-icon-container bg-blue-500">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div className="metric-content">
            <div className="metric-value text-blue-700">{metrics.totalTests}</div>
            <div className="metric-label text-blue-600">Total Tests</div>
          </div>
        </div>

        {/* Passed Tests */}
        <div className="metric-card-modern bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="metric-icon-container bg-green-500">
            <CheckCircle className="w-5 h-5 text-white" />
          </div>
          <div className="metric-content">
            <div className="metric-value text-green-700">{metrics.passedTests}</div>
            <div className="metric-label text-green-600">Passed</div>
          </div>
        </div>

        {/* Failed Tests */}
        <div className="metric-card-modern bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <div className="metric-icon-container bg-red-500">
            <XCircle className="w-5 h-5 text-white" />
          </div>
          <div className="metric-content">
            <div className="metric-value text-red-700">{metrics.failedTests}</div>
            <div className="metric-label text-red-600">Failed</div>
          </div>
        </div>

        {/* Success Rate */}
        <div
          className={`metric-card-modern ${
            successRate >= 80
              ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200'
              : successRate >= 60
                ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200'
                : 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200'
          }`}
        >
          <div
            className={`metric-icon-container ${
              successRate >= 80
                ? 'bg-emerald-500'
                : successRate >= 60
                  ? 'bg-yellow-500'
                  : 'bg-orange-500'
            }`}
          >
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div className="metric-content">
            <div
              className={`metric-value ${
                successRate >= 80
                  ? 'text-emerald-700'
                  : successRate >= 60
                    ? 'text-yellow-700'
                    : 'text-orange-700'
              }`}
            >
              {successRate.toFixed(1)}%
            </div>
            <div
              className={`metric-label ${
                successRate >= 80
                  ? 'text-emerald-600'
                  : successRate >= 60
                    ? 'text-yellow-600'
                    : 'text-orange-600'
              }`}
            >
              Success Rate
            </div>
          </div>
        </div>
      </div>

      {/* Progress Section */}
      {metrics.totalTests > 0 && (
        <div className="card-modern">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-indigo-500" />
              <h3 className="text-lg font-semibold text-gray-800">Test Execution Progress</h3>
            </div>
            <div className="text-sm font-medium text-gray-600">
              {metrics.passedTests + metrics.failedTests} / {metrics.totalTests} completed
            </div>
          </div>

          {/* Progress Bar */}
          <div className="progress-bar-modern mb-4">
            <div
              className="progress-fill-modern bg-gradient-to-r from-indigo-500 to-purple-600"
              style={{ width: `${completionRate}%` }}
            />
          </div>

          {/* Duration and Status */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">Duration: {formatDuration(metrics.duration)}</span>
              </div>
              {metrics.coverage > 0 && (
                <div className="flex items-center space-x-1">
                  <Shield className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-600">Coverage: {metrics.coverage}%</span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <div className="status-indicator bg-green-500"></div>
              <span className="text-gray-600">Live Monitoring</span>
            </div>
          </div>
        </div>
      )}

      {/* Performance & Security Metrics */}
      {(metrics.performanceMetrics || metrics.securityMetrics) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance Metrics */}
          {metrics.performanceMetrics && (
            <div className="card-modern">
              <div className="flex items-center space-x-2 mb-4">
                <Zap className="w-5 h-5 text-blue-500" />
                <h4 className="text-lg font-semibold text-gray-800">Performance</h4>
              </div>
              <div className="space-y-3">
                <div className="performance-metric">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Avg Response Time</span>
                    <span className="text-lg font-bold text-blue-600">
                      {metrics.performanceMetrics.avgResponseTime.toFixed(0)}ms
                    </span>
                  </div>
                  <div className="performance-bar">
                    <div
                      className="performance-fill bg-blue-500"
                      style={{
                        width: `${Math.min((metrics.performanceMetrics.avgResponseTime / 1000) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="performance-stat">
                    <div className="text-xs text-gray-500">Min</div>
                    <div className="text-sm font-semibold text-green-600">
                      {metrics.performanceMetrics.minResponseTime.toFixed(0)}ms
                    </div>
                  </div>
                  <div className="performance-stat">
                    <div className="text-xs text-gray-500">Max</div>
                    <div className="text-sm font-semibold text-red-600">
                      {metrics.performanceMetrics.maxResponseTime.toFixed(0)}ms
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security Metrics */}
          {metrics.securityMetrics && (
            <div className="card-modern">
              <div className="flex items-center space-x-2 mb-4">
                <Shield className="w-5 h-5 text-green-500" />
                <h4 className="text-lg font-semibold text-gray-800">Security</h4>
              </div>
              <div className="space-y-3">
                <div className="security-metric">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Security Score</span>
                    <span className="text-lg font-bold text-green-600">
                      {metrics.securityMetrics.securityScore.toFixed(1)}/10
                    </span>
                  </div>
                  <div className="security-bar">
                    <div
                      className="security-fill bg-green-500"
                      style={{ width: `${(metrics.securityMetrics.securityScore / 10) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="security-stat">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Vulnerabilities</span>
                    <span
                      className={`text-lg font-bold ${
                        metrics.securityMetrics.vulnerabilitiesFound === 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {metrics.securityMetrics.vulnerabilitiesFound}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MetricsPanel;

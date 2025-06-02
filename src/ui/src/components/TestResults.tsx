import React, { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  Zap,
  BarChart3,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { TestResult } from '../types';

interface TestResultsProps {
  results: TestResult[];
}

const TestResults: React.FC<TestResultsProps> = ({ results }) => {
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedResults);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedResults(newExpanded);
  };

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="w-5 h-5 text-green-500" />
    ) : (
      <XCircle className="w-5 h-5 text-red-500" />
    );
  };

  const getMethodColor = (method: string) => {
    switch (method.toLowerCase()) {
      case 'get':
        return 'bg-blue-100 text-blue-800';
      case 'post':
        return 'bg-green-100 text-green-800';
      case 'put':
        return 'bg-yellow-100 text-yellow-800';
      case 'delete':
        return 'bg-red-100 text-red-800';
      case 'patch':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getNonFunctionalIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'performance':
        return <Clock className="w-4 h-4" />;
      case 'security':
        return <Shield className="w-4 h-4" />;
      case 'load':
        return <BarChart3 className="w-4 h-4" />;
      case 'reliability':
        return <Zap className="w-4 h-4" />;
      default:
        return <BarChart3 className="w-4 h-4" />;
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Test Results</h3>
        <span className="text-sm text-gray-500">{results.length} tests</span>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {results.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No test results yet. Results will appear here as tests complete.</p>
          </div>
        ) : (
          results.map((result) => {
            const isExpanded = expandedResults.has(result.id);
            return (
              <div
                key={result.id}
                className={`border rounded-lg p-4 transition-all duration-200 ${
                  result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                }`}
              >
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleExpanded(result.id)}
                >
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(result.success)}
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${getMethodColor(result.testCase.method)}`}
                    >
                      {result.testCase.method.toUpperCase()}
                    </span>
                    <span className="font-medium text-gray-900">{result.testCase.endpoint}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">{result.duration}ms</span>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 space-y-4">
                    {/* Test Case Details */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Test Case</h4>
                      <div className="bg-white rounded p-3 border">
                        <p className="text-sm font-medium">{result.testCase.feature.title}</p>
                        {result.testCase.feature.description && (
                          <p className="text-xs text-gray-600 mt-1">
                            {result.testCase.feature.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Functional Assertions */}
                    {result.assertions && result.assertions.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Functional Tests</h4>
                        <div className="space-y-2">
                          {result.assertions.map((assertion, index) => (
                            <div key={index} className="flex items-center space-x-2 text-sm">
                              {getStatusIcon(assertion.success)}
                              <span
                                className={assertion.success ? 'text-gray-700' : 'text-red-700'}
                              >
                                {assertion.name}
                              </span>
                              {assertion.error && (
                                <span className="text-red-600 text-xs">- {assertion.error}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Non-Functional Results */}
                    {result.nonFunctionalResults && result.nonFunctionalResults.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Non-Functional Tests</h4>
                        <div className="space-y-3">
                          {result.nonFunctionalResults.map((nfResult, index) => (
                            <div key={index} className="bg-white rounded p-3 border">
                              <div className="flex items-center space-x-2 mb-2">
                                {getNonFunctionalIcon(nfResult.type)}
                                <span className="font-medium text-sm capitalize">
                                  {nfResult.type}
                                </span>
                                {getStatusIcon(nfResult.success)}
                              </div>
                              {nfResult.details && (
                                <p className="text-xs text-gray-600 mb-2">{nfResult.details}</p>
                              )}
                              {Object.keys(nfResult.metrics).length > 0 && (
                                <div className="text-xs text-gray-500">
                                  <strong>Metrics:</strong>
                                  <div className="mt-1 space-y-1">
                                    {Object.entries(nfResult.metrics).map(([key, value]) => (
                                      <div key={key} className="flex justify-between">
                                        <span>{key}:</span>
                                        <span className="font-mono">
                                          {typeof value === 'number'
                                            ? value.toFixed(2)
                                            : String(value)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {nfResult.error && (
                                <p className="text-xs text-red-600 mt-2">Error: {nfResult.error}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Error Details */}
                    {result.error && (
                      <div>
                        <h4 className="font-medium text-red-900 mb-2">Error Details</h4>
                        <div className="bg-red-50 border border-red-200 rounded p-3">
                          <p className="text-sm text-red-700 font-mono">{result.error}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TestResults;

import React, { useState } from 'react';
import { Code, FileText, Settings } from 'lucide-react';
import { GeneratedCode } from '../types';

interface CodeViewerProps {
  code: GeneratedCode;
}

const CodeViewer: React.FC<CodeViewerProps> = ({ code }) => {
  const [activeTab, setActiveTab] = useState<'gherkin' | 'testCases' | 'openApiSpec'>('gherkin');

  const tabs = [
    { id: 'gherkin', label: 'Gherkin Features', icon: FileText, content: code.gherkin },
    { id: 'testCases', label: 'Test Cases', icon: Code, content: code.testCases },
    { id: 'openApiSpec', label: 'OpenAPI Spec', icon: Settings, content: code.openApiSpec },
  ];

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Generated Code</h3>
      </div>

      <div className="space-y-4">
        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Code Content */}
        <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-auto">
          {tabs.find((tab) => tab.id === activeTab)?.content ? (
            <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap">
              {tabs.find((tab) => tab.id === activeTab)?.content}
            </pre>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Code className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>
                No {tabs.find((tab) => tab.id === activeTab)?.label.toLowerCase()} generated yet.
              </p>
              <p className="text-sm mt-1">Code will appear here during demo execution.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CodeViewer;

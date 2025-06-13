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
        {/* Modern Tab Navigation */}
        <div className="tab-container-modern">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`tab-button-modern ${activeTab === tab.id ? 'active' : ''}`}
              >
                <Icon className="tab-icon" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Code Content */}
        <div className="code-content-modern">
          {tabs.find((tab) => tab.id === activeTab)?.content ? (
            <pre className="code-pre-modern">
              {tabs.find((tab) => tab.id === activeTab)?.content}
            </pre>
          ) : (
            <div className="code-empty-state">
              <Code className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium text-gray-600 mb-1">
                No {tabs.find((tab) => tab.id === activeTab)?.label.toLowerCase()} generated yet
              </p>
              <p className="text-sm text-gray-500">Code will appear here during demo execution</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CodeViewer;

import React from 'react';
import { CheckCircle, Clock, XCircle, Loader2, FileText, Terminal, Activity } from 'lucide-react';
import { TestStep, LogEntry } from '../types';

interface ProcessViewerProps {
  currentStep: TestStep | null;
  steps: TestStep[];
  logs: LogEntry[];
}

const ProcessViewer: React.FC<ProcessViewerProps> = ({ currentStep, steps, logs }) => {
  const getStepIcon = (status: TestStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStepStatusColor = (status: TestStep['status']) => {
    switch (status) {
      case 'completed':
        return 'step-completed';
      case 'failed':
        return 'step-failed';
      case 'running':
        return 'step-running';
      default:
        return 'step-pending';
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Step */}
      {currentStep && (
        <div className="card-modern">
          <div className="flex items-center space-x-2 mb-4">
            <Activity className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-semibold text-gray-800">Current Step</h3>
          </div>
          <div className={`current-step-card ${getStepStatusColor(currentStep.status)}`}>
            <div className="flex items-center space-x-3">
              <div className="step-icon-container">{getStepIcon(currentStep.status)}</div>
              <div className="flex-1">
                <h4 className="step-title">{currentStep.name}</h4>
                <p className="step-description">{currentStep.description}</p>
                {currentStep.duration && (
                  <p className="step-duration">Duration: {currentStep.duration}ms</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step Timeline */}
      <div className="card-modern">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-800">Process Timeline</h3>
          </div>
          <span className="text-sm font-medium text-gray-600">{steps.length} steps</span>
        </div>

        <div className="timeline-container">
          {steps.length === 0 ? (
            <div className="empty-state">
              <Terminal className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-500 text-center">
                No steps yet. Start a test to see the process.
              </p>
            </div>
          ) : (
            <div className="timeline-steps">
              {steps.map((step, index) => (
                <div key={step.id} className={`timeline-step ${getStepStatusColor(step.status)}`}>
                  <div className="timeline-connector">
                    <div className="timeline-line"></div>
                    <div className="timeline-dot">{getStepIcon(step.status)}</div>
                  </div>
                  <div className="timeline-content">
                    <div className="timeline-header">
                      <h4 className="timeline-title">
                        {index + 1}. {step.name}
                      </h4>
                      {step.duration && (
                        <span className="timeline-duration">{step.duration}ms</span>
                      )}
                    </div>
                    <p className="timeline-description">{step.description}</p>
                    {step.startTime && (
                      <p className="timeline-timestamp">
                        {new Date(step.startTime).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProcessViewer;

import React from 'react';
import { Zap, Brain, Shield, BarChart3, Sparkles, Activity } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="header-modern">
      <div className="header-content-modern">
        <div className="header-brand-modern">
          <div className="header-logo-modern">
            <div className="logo-icon">
              <Zap className="w-7 h-7" />
            </div>
            <div className="logo-glow"></div>
          </div>
          <div className="header-text">
            <h1 className="header-title-modern">
              Spectra
              <span className="title-accent">Test Monitor</span>
            </h1>
            <p className="header-subtitle-modern">
              <Activity className="w-4 h-4" />
              Real-time Backend API Testing & Analysis
            </p>
          </div>
        </div>

        <div className="header-features-modern">
          <div className="feature-badge-modern ai-feature">
            <div className="feature-icon">
              <Brain className="w-4 h-4" />
            </div>
            <div className="feature-content">
              <span className="feature-title">AI-Enhanced</span>
              <span className="feature-subtitle">Smart Testing</span>
            </div>
            <Sparkles className="w-3 h-3 feature-sparkle" />
          </div>

          <div className="feature-badge-modern security-feature">
            <div className="feature-icon">
              <Shield className="w-4 h-4" />
            </div>
            <div className="feature-content">
              <span className="feature-title">Security</span>
              <span className="feature-subtitle">Vulnerability Scan</span>
            </div>
          </div>

          <div className="feature-badge-modern performance-feature">
            <div className="feature-icon">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div className="feature-content">
              <span className="feature-title">Performance</span>
              <span className="feature-subtitle">Real-time Metrics</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

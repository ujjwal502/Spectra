import * as fs from 'fs';
import * as path from 'path';
import { TestResult, TestCase } from '../types';

/**
 * Modern Dashboard Service for comprehensive test reporting
 * Generates interactive, real-time dashboards with complete test lifecycle visibility
 */
export class ModernDashboardService {
  private dashboardData: any = {
    specGeneration: [],
    testGeneration: [],
    testExecution: [],
    insights: [],
    recommendations: [],
    metrics: {
      totalEndpoints: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      successRate: 0,
      averageResponseTime: 0,
      totalDuration: 0,
    },
    timeline: [],
    nonFunctionalResults: [],
  };

  /**
   * Generate comprehensive dashboard
   */
  public generateDashboard(
    outputDir: string,
    options: {
      title?: string;
      theme?: 'light' | 'dark';
    } = {},
  ): void {
    const { title = 'Spectra Test Dashboard', theme = 'light' } = options;

    console.log('🎨 Generating modern dashboard...');

    const dashboardDir = path.join(outputDir, 'spectra-dashboard');
    this.ensureDirectory(dashboardDir);

    const assetsDir = path.join(dashboardDir, 'assets');
    this.ensureDirectory(assetsDir);

    this.scanAllTestData(outputDir);
    this.generateMainHTML(dashboardDir, title, theme);
    this.generateModernCSS(assetsDir);
    this.generateModernJS(assetsDir);
    this.generateDataAPI(dashboardDir);

    console.log(`✅ Modern dashboard generated at: ${dashboardDir}/index.html`);
  }

  private ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private scanAllTestData(outputDir: string): void {
    const possibleDirs = [
      path.join(outputDir, 'enhanced-tests'),
      path.join(outputDir, 'test-results'),
      path.join(outputDir, 'specs'),
      path.join(outputDir, 'results'),
    ];

    possibleDirs.forEach((dir) => {
      if (fs.existsSync(dir)) {
        this.loadDataFromDirectory(dir);
      }
    });
  }

  private loadDataFromDirectory(dir: string): void {
    try {
      const files = fs.readdirSync(dir);

      files.forEach((file) => {
        const filePath = path.join(dir, file);

        if (file.endsWith('_tests.json')) {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          this.dashboardData.testGeneration.push({
            id: `test-gen-${Date.now()}`,
            timestamp: new Date().toISOString(),
            endpoint: data.endpoint || file,
            testCasesGenerated: data.testCases?.length || 0,
            gherkinFeatures: data.gherkinFeatures?.length || 0,
            coverage: data.coverage || {},
            success: true,
          });
        } else if (file.endsWith('_results.json')) {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          if (data.detailedResults) {
            this.dashboardData.testExecution.push({
              id: `execution-${Date.now()}`,
              timestamp: new Date().toISOString(),
              results: data.detailedResults,
              summary: data.summary || {},
            });
          }

          if (data.insights) {
            this.dashboardData.insights.push(
              ...data.insights.map((insight: string) => ({
                id: `insight-${Date.now()}-${Math.random()}`,
                text: insight,
                timestamp: new Date().toISOString(),
              })),
            );
          }

          if (data.recommendations) {
            this.dashboardData.recommendations.push(
              ...data.recommendations.map((rec: string) => ({
                id: `rec-${Date.now()}-${Math.random()}`,
                text: rec,
                timestamp: new Date().toISOString(),
              })),
            );
          }
        }
      });
    } catch (error) {
      console.warn(`Warning: Could not load data from ${dir}:`, error);
    }
  }

  private generateMainHTML(dashboardDir: string, title: string, theme: string): void {
    const html = `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="stylesheet" href="./assets/modern-styles.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="dashboard-layout">
        <nav class="dashboard-sidebar">
            <div class="sidebar-header">
                <i class="fas fa-chart-line"></i>
                <h1>Spectra</h1>
            </div>
            <ul class="sidebar-nav">
                <li><a href="#overview" class="nav-link active" data-tab="overview">
                    <i class="fas fa-tachometer-alt"></i> Overview
                </a></li>
                <li><a href="#spec-generation" class="nav-link" data-tab="spec-generation">
                    <i class="fas fa-file-code"></i> Spec Generation
                </a></li>
                <li><a href="#test-generation" class="nav-link" data-tab="test-generation">
                    <i class="fas fa-vials"></i> Test Generation
                </a></li>
                <li><a href="#execution" class="nav-link" data-tab="execution">
                    <i class="fas fa-play-circle"></i> Test Execution
                </a></li>
                <li><a href="#insights" class="nav-link" data-tab="insights">
                    <i class="fas fa-lightbulb"></i> Insights
                </a></li>
            </ul>
        </nav>

        <main class="dashboard-main">
            <header class="dashboard-header">
                <h2 id="page-title">Dashboard Overview</h2>
                <div class="header-actions">
                    <button id="refresh-btn" class="btn-icon">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                    <button id="theme-toggle" class="btn-icon">
                        <i class="fas fa-moon"></i>
                    </button>
                </div>
            </header>

            <div class="tab-content">
                <div id="overview-tab" class="tab-pane active">
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-vial"></i>
                            </div>
                            <div class="stat-content">
                                <h3 id="total-tests">0</h3>
                                <p>Total Tests</p>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-check-circle"></i>
                            </div>
                            <div class="stat-content">
                                <h3 id="passed-tests">0</h3>
                                <p>Passed</p>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-times-circle"></i>
                            </div>
                            <div class="stat-content">
                                <h3 id="failed-tests">0</h3>
                                <p>Failed</p>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-percentage"></i>
                            </div>
                            <div class="stat-content">
                                <h3 id="success-rate">0%</h3>
                                <p>Success Rate</p>
                            </div>
                        </div>
                    </div>

                    <div class="charts-section">
                        <div class="chart-container">
                            <h3>Test Results</h3>
                            <canvas id="results-chart"></canvas>
                        </div>
                        <div class="chart-container">
                            <h3>Response Times</h3>
                            <canvas id="response-chart"></canvas>
                        </div>
                    </div>
                </div>

                <div id="spec-generation-tab" class="tab-pane"></div>
                <div id="test-generation-tab" class="tab-pane"></div>
                <div id="execution-tab" class="tab-pane"></div>
                <div id="insights-tab" class="tab-pane"></div>
            </div>
        </main>
    </div>

    <script src="./assets/modern-dashboard.js"></script>
</body>
</html>`;

    fs.writeFileSync(path.join(dashboardDir, 'index.html'), html);
  }

  private generateModernCSS(assetsDir: string): void {
    const css = `/* Modern Dashboard Styles */
:root {
  --primary: #6366f1;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --border: #e2e8f0;
  --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

[data-theme="dark"] {
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --text-primary: #f8fafc;
  --text-secondary: #cbd5e1;
  --border: #334155;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.dashboard-layout {
  display: flex;
  min-height: 100vh;
}

.dashboard-sidebar {
  width: 280px;
  background: var(--bg-primary);
  border-right: 1px solid var(--border);
  box-shadow: var(--shadow);
}

.sidebar-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.sidebar-header i {
  font-size: 1.5rem;
  color: var(--primary);
}

.sidebar-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
}

.sidebar-nav {
  list-style: none;
  padding: 1rem 0;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.5rem;
  color: var(--text-secondary);
  text-decoration: none;
  transition: all 0.2s;
}

.nav-link:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.nav-link.active {
  background: var(--primary);
  color: white;
}

.dashboard-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.dashboard-header {
  height: 70px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border);
  padding: 0 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-icon {
  width: 40px;
  height: 40px;
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: var(--primary);
  color: white;
}

.tab-content {
  flex: 1;
  padding: 2rem;
}

.tab-pane {
  display: none;
}

.tab-pane.active {
  display: block;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: var(--bg-primary);
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: var(--shadow);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.stat-content h3 {
  font-size: 2rem;
  font-weight: 700;
}

.stat-content p {
  color: var(--text-secondary);
}

.charts-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 2rem;
}

.chart-container {
  background: var(--bg-primary);
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: var(--shadow);
}

.chart-container h3 {
  margin-bottom: 1rem;
  font-size: 1.125rem;
}

@media (max-width: 768px) {
  .dashboard-sidebar {
    width: 70px;
  }
  
  .sidebar-header h1 {
    display: none;
  }
  
  .nav-link span {
    display: none;
  }
  
  .nav-link {
    justify-content: center;
  }
}`;

    fs.writeFileSync(path.join(assetsDir, 'modern-styles.css'), css);
  }

  private generateModernJS(assetsDir: string): void {
    const js = `// Modern Dashboard JavaScript
class SpectraDashboard {
  constructor() {
    this.currentTab = 'overview';
    this.data = {};
    this.charts = {};
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadData();
    this.renderCurrentTab();
  }

  setupEventListeners() {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = e.currentTarget.dataset.tab;
        this.switchTab(tab);
      });
    });

    document.getElementById('theme-toggle').addEventListener('click', () => {
      this.toggleTheme();
    });

    document.getElementById('refresh-btn').addEventListener('click', () => {
      this.refreshData();
    });
  }

  async loadData() {
    try {
      const response = await fetch('./data-api.json');
      this.data = await response.json();
    } catch (error) {
      console.error('Failed to load data:', error);
      this.data = this.getDefaultData();
    }
  }

  switchTab(tabName) {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });
    document.querySelector(\`[data-tab="\${tabName}"]\`).classList.add('active');

    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });
    document.getElementById(\`\${tabName}-tab\`).classList.add('active');

    const titles = {
      'overview': 'Dashboard Overview',
      'spec-generation': 'Specification Generation',
      'test-generation': 'Test Generation',
      'execution': 'Test Execution',
      'insights': 'AI Insights'
    };
    document.getElementById('page-title').textContent = titles[tabName] || 'Dashboard';

    this.currentTab = tabName;
    this.renderCurrentTab();
  }

  renderCurrentTab() {
    switch (this.currentTab) {
      case 'overview':
        this.renderOverview();
        break;
      case 'spec-generation':
        this.renderSpecGeneration();
        break;
      case 'test-generation':
        this.renderTestGeneration();
        break;
      case 'execution':
        this.renderExecution();
        break;
      case 'insights':
        this.renderInsights();
        break;
    }
  }

  renderOverview() {
    const metrics = this.data.metrics || {};
    
    document.getElementById('total-tests').textContent = metrics.totalTests || 0;
    document.getElementById('passed-tests').textContent = metrics.passedTests || 0;
    document.getElementById('failed-tests').textContent = metrics.failedTests || 0;
    document.getElementById('success-rate').textContent = \`\${Math.round((metrics.successRate || 0) * 100)}%\`;

    this.renderResultsChart();
    this.renderResponseChart();
  }

  renderResultsChart() {
    const ctx = document.getElementById('results-chart').getContext('2d');
    const metrics = this.data.metrics || {};
    
    if (this.charts.results) {
      this.charts.results.destroy();
    }

    this.charts.results = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Passed', 'Failed'],
        datasets: [{
          data: [metrics.passedTests || 0, metrics.failedTests || 0],
          backgroundColor: ['#10b981', '#ef4444'],
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      }
    });
  }

  renderResponseChart() {
    const ctx = document.getElementById('response-chart').getContext('2d');
    const executions = this.data.testExecution || [];
    
    if (this.charts.response) {
      this.charts.response.destroy();
    }

    const labels = executions.map((_, index) => \`Run \${index + 1}\`);
    const data = executions.map(exec => exec.averageResponseTime || 0);

    this.charts.response = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Response Time (ms)',
          data,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      }
    });
  }

  renderSpecGeneration() {
    const tabContent = document.getElementById('spec-generation-tab');
    const specs = this.data.specGeneration || [];
    
    const html = \`
      <div class="content-section">
        <h3>Specification Generation History</h3>
        <div class="table-container">
          \${specs.length > 0 ? \`
            <table class="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Endpoint</th>
                  <th>Endpoints</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                \${specs.map(spec => \`
                  <tr>
                    <td>\${new Date(spec.timestamp).toLocaleString()}</td>
                    <td>\${spec.endpoint || spec.codebasePath || 'N/A'}</td>
                    <td>\${spec.endpointsDetected || 0}</td>
                    <td><span class="status \${spec.success ? 'success' : 'error'}">\${spec.success ? 'Success' : 'Failed'}</span></td>
                  </tr>
                \`).join('')}
              </tbody>
            </table>
          \` : '<p>No specification generation data available</p>'}
        </div>
      </div>
    \`;

    tabContent.innerHTML = html;
  }

  renderTestGeneration() {
    const tabContent = document.getElementById('test-generation-tab');
    const tests = this.data.testGeneration || [];
    
    const html = \`
      <div class="content-section">
        <h3>Test Generation Results</h3>
        <div class="table-container">
          \${tests.length > 0 ? \`
            <table class="data-table">
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>Test Cases</th>
                  <th>Gherkin Features</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                \${tests.map(test => \`
                  <tr>
                    <td>\${test.endpoint}</td>
                    <td>\${test.testCasesGenerated}</td>
                    <td>\${test.gherkinFeatures}</td>
                    <td><span class="status \${test.success ? 'success' : 'error'}">\${test.success ? 'Success' : 'Failed'}</span></td>
                  </tr>
                \`).join('')}
              </tbody>
            </table>
          \` : '<p>No test generation data available</p>'}
        </div>
      </div>
    \`;

    tabContent.innerHTML = html;
  }

  renderExecution() {
    const tabContent = document.getElementById('execution-tab');
    const executions = this.data.testExecution || [];
    
    const html = \`
      <div class="content-section">
        <h3>Test Execution Results</h3>
        \${executions.length > 0 ? executions.map(execution => \`
          <div class="execution-card">
            <h4>Execution - \${new Date(execution.timestamp).toLocaleString()}</h4>
            <div class="execution-stats">
              <span class="stat success">\${execution.passedTests || 0} Passed</span>
              <span class="stat error">\${execution.failedTests || 0} Failed</span>
            </div>
          </div>
        \`).join('') : '<p>No test execution data available</p>'}
      </div>
    \`;

    tabContent.innerHTML = html;
  }

  renderInsights() {
    const tabContent = document.getElementById('insights-tab');
    const insights = this.data.insights || [];
    const recommendations = this.data.recommendations || [];
    
    const html = \`
      <div class="content-section">
        <div class="insights-grid">
          <div class="insights-column">
            <h3>AI Insights</h3>
            \${insights.length > 0 ? insights.map(insight => \`
              <div class="insight-item">
                <p>\${insight.text}</p>
                <small>\${new Date(insight.timestamp).toLocaleString()}</small>
              </div>
            \`).join('') : '<p>No insights available</p>'}
          </div>
          <div class="insights-column">
            <h3>Recommendations</h3>
            \${recommendations.length > 0 ? recommendations.map(rec => \`
              <div class="recommendation-item">
                <p>\${rec.text}</p>
                <small>\${new Date(rec.timestamp).toLocaleString()}</small>
              </div>
            \`).join('') : '<p>No recommendations available</p>'}
          </div>
        </div>
      </div>
    \`;

    tabContent.innerHTML = html;
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    
    const icon = document.querySelector('#theme-toggle i');
    icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }

  async refreshData() {
    await this.loadData();
    this.renderCurrentTab();
  }

  getDefaultData() {
    return {
      metrics: { totalTests: 0, passedTests: 0, failedTests: 0, successRate: 0 },
      specGeneration: [],
      testGeneration: [],
      testExecution: [],
      insights: [],
      recommendations: [],
    };
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new SpectraDashboard();
});`;

    fs.writeFileSync(path.join(assetsDir, 'modern-dashboard.js'), js);
  }

  private generateDataAPI(dashboardDir: string): void {
    const data = {
      ...this.dashboardData,
      lastUpdated: new Date().toISOString(),
    };

    fs.writeFileSync(path.join(dashboardDir, 'data-api.json'), JSON.stringify(data, null, 2));
  }
}

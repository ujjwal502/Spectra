// Header component
function renderHeader() {
  return `
    <header class="bg-white border-b border-gray-200 shadow-sm">
      <div class="flex items-center justify-between px-6 py-3">
        <div class="flex items-center">
          <svg class="h-8 w-8 text-blue-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4V20M20 12H4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h1 class="ml-2 text-xl font-bold text-gray-800">Spectra Dashboard</h1>
        </div>
        <div class="flex items-center space-x-4">
          <button class="flex items-center text-sm text-gray-700 hover:text-blue-600">
            <i class="fas fa-sync-alt mr-1"></i>
            Refresh
          </button>
          <div class="h-6 border-l border-gray-300"></div>
          <button class="flex items-center text-sm text-gray-700 hover:text-blue-600">
            <i class="fas fa-cog mr-1"></i>
            Settings
          </button>
        </div>
      </div>
    </header>
  `;
}

// Sidebar component
function renderSidebar() {
  return `
    <aside class="sidebar w-64 flex-shrink-0 overflow-y-auto">
      <div class="p-4">
        <div class="mb-6">
          <div class="text-xs uppercase tracking-wider text-gray-500 mb-2 px-3">
            Main
          </div>
          <ul>
            <li>
              <a href="#" data-nav="dashboard" class="nav-item ${state.currentView === 'dashboard' ? 'active' : ''} flex items-center px-3 py-2 rounded-md text-gray-100">
                <i class="fas fa-tachometer-alt w-5 h-5 mr-2"></i>
                Dashboard
              </a>
            </li>
            <li>
              <a href="#" data-nav="features" class="nav-item ${state.currentView === 'features' || state.currentView === 'feature-detail' ? 'active' : ''} flex items-center px-3 py-2 rounded-md text-gray-100 mt-1">
                <i class="fas fa-file-alt w-5 h-5 mr-2"></i>
                Features
              </a>
            </li>
            <li>
              <a href="#" data-nav="results" class="nav-item ${state.currentView === 'results' ? 'active' : ''} flex items-center px-3 py-2 rounded-md text-gray-100 mt-1">
                <i class="fas fa-vial w-5 h-5 mr-2"></i>
                Test Results
              </a>
            </li>
            <li>
              <a href="#" data-nav="regression" class="nav-item ${state.currentView === 'regression' ? 'active' : ''} flex items-center px-3 py-2 rounded-md text-gray-100 mt-1">
                <i class="fas fa-chart-line w-5 h-5 mr-2"></i>
                Regression
              </a>
            </li>
          </ul>
        </div>
        
        <div>
          <div class="text-xs uppercase tracking-wider text-gray-500 mb-2 px-3">
            Actions
          </div>
          <ul>
            <li>
              <a href="http://localhost:3000" target="_blank" class="nav-item flex items-center px-3 py-2 rounded-md text-gray-100">
                <i class="fas fa-server w-5 h-5 mr-2"></i>
                API Server
              </a>
            </li>
            <li>
              <a href="#" class="nav-item flex items-center px-3 py-2 rounded-md text-gray-100 mt-1">
                <i class="fas fa-play w-5 h-5 mr-2"></i>
                Run Tests
              </a>
            </li>
            <li>
              <a href="#" class="nav-item flex items-center px-3 py-2 rounded-md text-gray-100 mt-1">
                <i class="fas fa-download w-5 h-5 mr-2"></i>
                Export Report
              </a>
            </li>
          </ul>
        </div>
        
        <div class="border-t border-gray-700 mt-6 pt-4">
          <div class="px-3 mb-2">
            <div class="text-xs uppercase tracking-wider text-gray-500">Test Status</div>
            ${renderTestStatusIndicator()}
          </div>
        </div>
      </div>
    </aside>
  `;
}

// Test status indicator
function renderTestStatusIndicator() {
  if (
    !state.data.summary ||
    !state.data.summary.testResults ||
    !state.data.summary.testResults.available
  ) {
    return `<div class="text-sm text-gray-400 mt-1">No test data available</div>`;
  }

  const { passed, failed, total } = state.data.summary.testResults;
  const passRate = Math.round((passed / total) * 100);

  let statusColor = 'bg-red-500';
  if (passRate >= 90) {
    statusColor = 'bg-green-500';
  } else if (passRate >= 70) {
    statusColor = 'bg-yellow-500';
  }

  return `
    <div class="mt-1">
      <div class="flex items-center justify-between text-sm">
        <span class="text-gray-300">${passed}/${total} Passed</span>
        <span class="text-gray-300">${passRate}%</span>
      </div>
      <div class="mt-1 w-full bg-gray-700 rounded-full h-2">
        <div class="${statusColor} h-2 rounded-full" style="width: ${passRate}%"></div>
      </div>
    </div>
  `;
}

// Main content
function renderContent() {
  switch (state.currentView) {
    case 'dashboard':
      return renderDashboard();
    case 'features':
      return renderFeaturesList();
    case 'feature-detail':
      return renderFeatureDetail();
    case 'results':
      return renderTestResults();
    case 'regression':
      return renderRegression();
    default:
      return renderDashboard();
  }
}

// Dashboard view
function renderDashboard() {
  if (!state.data.summary) {
    return `
      <div class="flex items-center justify-center h-full">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p class="text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    `;
  }

  const { features, testResults, regression, baseline } = state.data.summary;

  return `
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-800">Dashboard</h1>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        ${renderStatCard('Features', features.count, 'text-blue-600', 'fa-file-alt')}
        ${renderStatCard('Test Cases', testResults.available ? testResults.total : 0, 'text-green-600', 'fa-vial')}
        ${renderStatCard('Pass Rate', testResults.available ? testResults.passRate + '%' : 'N/A', 'text-yellow-600', 'fa-check-circle')}
        ${renderStatCard('Regressions', regression.available ? regression.summary.regressedTests : 0, 'text-red-600', 'fa-exclamation-triangle')}
      </div>
      
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="card p-5">
          <h2 class="text-lg font-semibold text-gray-800 mb-4">Test Results Overview</h2>
          <div>
            <canvas id="resultsChart" height="200"></canvas>
          </div>
        </div>
        
        <div class="card p-5">
          <h2 class="text-lg font-semibold text-gray-800 mb-4">Feature Coverage</h2>
          <div>
            <canvas id="featuresChart" height="200"></canvas>
          </div>
        </div>
      </div>
      
      <div class="card p-5">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-800">Recent Features</h2>
          <a href="#" data-nav="features" class="text-sm text-blue-600 hover:text-blue-800">View All</a>
        </div>
        
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th class="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th class="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                <th class="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Endpoint</th>
                <th class="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scenarios</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              ${renderRecentFeatures()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// Initialize dashboard charts
function initDashboardCharts() {
  if (!state.data.summary) return;

  const { testResults, features } = state.data.summary;

  // Results chart
  if (testResults.available) {
    const resultsChartCtx = document.getElementById('resultsChart');
    if (resultsChartCtx) {
      new Chart(resultsChartCtx, {
        type: 'pie',
        data: {
          labels: ['Passed', 'Failed'],
          datasets: [
            {
              data: [testResults.passed, testResults.failed],
              backgroundColor: ['#10B981', '#EF4444'],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
            },
          },
        },
      });
    }
  }

  // Features chart
  if (features.list && features.list.length > 0) {
    const methodCounts = {};
    features.list.forEach((feature) => {
      if (!methodCounts[feature.method]) {
        methodCounts[feature.method] = 0;
      }
      methodCounts[feature.method]++;
    });

    const featuresChartCtx = document.getElementById('featuresChart');
    if (featuresChartCtx) {
      new Chart(featuresChartCtx, {
        type: 'bar',
        data: {
          labels: Object.keys(methodCounts),
          datasets: [
            {
              label: 'Feature Count by Method',
              data: Object.values(methodCounts),
              backgroundColor: [
                '#3B82F6', // GET - Blue
                '#10B981', // POST - Green
                '#F59E0B', // PUT - Yellow
                '#6366F1', // PATCH - Indigo
                '#EF4444', // DELETE - Red
              ],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                precision: 0,
              },
            },
          },
        },
      });
    }
  }
}

// Helper function to render stat cards
function renderStatCard(title, value, textColor, icon) {
  return `
    <div class="card stat-card p-5">
      <div class="flex items-center">
        <div class="flex-shrink-0 ${textColor}">
          <i class="fas ${icon} text-2xl"></i>
        </div>
        <div class="ml-5">
          <p class="text-sm font-medium text-gray-500">${title}</p>
          <p class="text-xl font-semibold ${textColor}">${value}</p>
        </div>
      </div>
    </div>
  `;
}

// Helper function to render recent features table
function renderRecentFeatures() {
  if (
    !state.data.summary ||
    !state.data.summary.features.list ||
    state.data.summary.features.list.length === 0
  ) {
    return `
      <tr>
        <td colspan="4" class="px-4 py-4 text-sm text-gray-500 text-center">No features available</td>
      </tr>
    `;
  }

  // Take the first 5 features
  const recentFeatures = state.data.summary.features.list.slice(0, 5);

  return recentFeatures
    .map(
      (feature) => `
    <tr class="hover:bg-gray-50 cursor-pointer" data-feature-id="${feature.id}">
      <td class="px-4 py-3 text-sm text-gray-800">${feature.title}</td>
      <td class="px-4 py-3 text-sm">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
          ${getMethodBadgeColor(feature.method)}">
          ${feature.method}
        </span>
      </td>
      <td class="px-4 py-3 text-sm text-gray-500 font-mono">${feature.endpoint}</td>
      <td class="px-4 py-3 text-sm text-gray-800">${feature.scenarioCount}</td>
    </tr>
  `,
    )
    .join('');
}

// Helper function to get badge color for HTTP methods
function getMethodBadgeColor(method) {
  switch (method) {
    case 'GET':
      return 'bg-blue-100 text-blue-800';
    case 'POST':
      return 'bg-green-100 text-green-800';
    case 'PUT':
      return 'bg-yellow-100 text-yellow-800';
    case 'PATCH':
      return 'bg-indigo-100 text-indigo-800';
    case 'DELETE':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

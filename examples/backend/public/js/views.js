// Features list view
function renderFeaturesList() {
  if (!state.data.features || state.data.features.length === 0) {
    return `
      <div class="flex items-center justify-center h-full">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p class="text-gray-600">Loading features...</p>
        </div>
      </div>
    `;
  }

  return `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-800">Features</h1>
        <div class="flex space-x-2">
          <div class="relative">
            <input type="text" placeholder="Search features..." class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i class="fas fa-search text-gray-400"></i>
            </div>
          </div>
          <div>
            <select class="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
              <option value="">All Methods</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
        </div>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${renderFeatureCards()}
      </div>
    </div>
  `;
}

// Helper function to render feature cards
function renderFeatureCards() {
  return state.data.features
    .map(
      (feature) => `
    <div class="card hover:shadow-lg transition-shadow duration-200 cursor-pointer" data-feature-id="${feature.id}">
      <div class="border-b p-4 flex items-center justify-between">
        <h3 class="font-medium text-gray-800 truncate" title="${feature.title}">${feature.title}</h3>
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getMethodBadgeColor(feature.method)}">
          ${feature.method}
        </span>
      </div>
      <div class="p-4">
        <p class="text-sm text-gray-500 mb-3 line-clamp-2">${feature.description || 'No description available'}</p>
        <div class="flex justify-between text-xs text-gray-500">
          <span class="flex items-center">
            <i class="fas fa-list-alt mr-1"></i>
            ${feature.scenarios.length} Scenarios
          </span>
          <span class="flex items-center">
            <i class="fas fa-link mr-1"></i>
            <span class="font-mono">${feature.endpoint}</span>
          </span>
        </div>
      </div>
    </div>
  `,
    )
    .join('');
}

// Feature detail view
function renderFeatureDetail() {
  if (!state.selectedFeature || !state.data.features) {
    return `
      <div class="flex items-center justify-center h-full">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p class="text-gray-600">Loading feature details...</p>
        </div>
      </div>
    `;
  }

  const feature = state.data.features.find((f) => f.id === state.selectedFeature);

  if (!feature) {
    return `
      <div class="flex items-center justify-center h-full">
        <div class="text-center">
          <div class="text-red-500 text-4xl mb-4">
            <i class="fas fa-exclamation-circle"></i>
          </div>
          <h1 class="text-xl font-bold text-gray-800 mb-2">Feature Not Found</h1>
          <p class="text-gray-600 mb-4">The selected feature could not be found.</p>
          <button class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md" data-nav="features">
            Return to Features
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div class="space-y-6">
      <div class="flex items-center">
        <button class="text-gray-500 hover:text-gray-800 mr-3" data-nav="features">
          <i class="fas fa-arrow-left"></i>
        </button>
        <h1 class="text-2xl font-bold text-gray-800">${feature.title}</h1>
        <span class="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getMethodBadgeColor(feature.method)}">
          ${feature.method}
        </span>
      </div>
      
      <div class="card p-5">
        <div class="mb-6">
          <h2 class="text-lg font-semibold text-gray-800 mb-1">Endpoint</h2>
          <div class="bg-gray-100 rounded-md p-3 font-mono text-gray-800">
            ${feature.endpoint}
          </div>
        </div>
        
        <div class="mb-6">
          <h2 class="text-lg font-semibold text-gray-800 mb-1">Description</h2>
          <p class="text-gray-700">${feature.description || 'No description available'}</p>
        </div>
        
        <div>
          <h2 class="text-lg font-semibold text-gray-800 mb-3">Scenarios</h2>
          <div class="space-y-4">
            ${renderScenarios(feature)}
          </div>
        </div>
      </div>
      
      <div class="card p-5">
        <h2 class="text-lg font-semibold text-gray-800 mb-3">Gherkin Source</h2>
        <div class="code-block p-4 text-gray-200 font-mono text-sm whitespace-pre overflow-x-auto">
          ${escapeHtml(feature.rawContent)}
        </div>
      </div>
    </div>
  `;
}

// Helper function to render scenarios
function renderScenarios(feature) {
  return feature.scenarios
    .map(
      (scenario, index) => `
    <div class="border border-gray-200 rounded-md overflow-hidden">
      <div class="bg-gray-50 px-4 py-3 flex items-center justify-between">
        <h3 class="font-medium text-gray-800">${scenario.title}</h3>
        <button class="text-gray-500 hover:text-gray-800 focus:outline-none" 
                onclick="toggleScenario(${index})">
          <i class="fas fa-chevron-down"></i>
        </button>
      </div>
      <div class="p-4 border-t border-gray-200">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h4 class="text-sm font-medium text-gray-800 mb-2">Setup</h4>
            <ul class="space-y-1">
              ${
                scenario.testSteps.setup
                  .map(
                    (step) => `
                <li class="text-sm text-gray-600">
                  <i class="fas fa-check-circle text-green-500 mr-1"></i>
                  ${step}
                </li>
              `,
                  )
                  .join('') || `<li class="text-sm text-gray-500">No setup steps</li>`
              }
            </ul>
          </div>
          <div>
            <h4 class="text-sm font-medium text-gray-800 mb-2">Action</h4>
            <ul class="space-y-1">
              ${
                scenario.testSteps.action
                  .map(
                    (step) => `
                <li class="text-sm text-gray-600">
                  <i class="fas fa-arrow-right text-blue-500 mr-1"></i>
                  ${step}
                </li>
              `,
                  )
                  .join('') || `<li class="text-sm text-gray-500">No action steps</li>`
              }
            </ul>
          </div>
          <div>
            <h4 class="text-sm font-medium text-gray-800 mb-2">Verification</h4>
            <ul class="space-y-1">
              ${
                scenario.testSteps.verification
                  .map(
                    (step) => `
                <li class="text-sm text-gray-600">
                  <i class="fas fa-check text-yellow-500 mr-1"></i>
                  ${step}
                </li>
              `,
                  )
                  .join('') || `<li class="text-sm text-gray-500">No verification steps</li>`
              }
            </ul>
          </div>
        </div>
      </div>
    </div>
  `,
    )
    .join('');
}

// Test results view
function renderTestResults() {
  if (!state.data.results || !state.data.results.summary) {
    return `
      <div class="text-center p-10">
        <div class="text-yellow-500 text-4xl mb-4">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h1 class="text-xl font-bold text-gray-800 mb-2">No Test Results Available</h1>
        <p class="text-gray-600 mb-4">Run tests first with npm run test:backend</p>
        <a href="#" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md">
          <i class="fas fa-play mr-1"></i>
          Run Tests
        </a>
      </div>
    `;
  }

  const { summary, results } = state.data.results;

  return `
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-800">Test Results</h1>
      
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        ${renderStatCard('Total Tests', summary.total, 'text-blue-600', 'fa-vial')}
        ${renderStatCard('Passed', summary.passed, 'text-green-600', 'fa-check-circle')}
        ${renderStatCard('Failed', summary.failed, 'text-red-600', 'fa-times-circle')}
        ${renderStatCard('Pass Rate', summary.passRate + '%', 'text-yellow-600', 'fa-percentage')}
      </div>
      
      <div class="card p-5">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-800">Test Results</h2>
          <div class="flex space-x-2">
            <div class="relative">
              <input type="text" placeholder="Search results..." class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i class="fas fa-search text-gray-400"></i>
              </div>
            </div>
            <div>
              <select class="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                <option value="">All Results</option>
                <option value="pass">Passed</option>
                <option value="fail">Failed</option>
              </select>
            </div>
          </div>
        </div>
        
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th class="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th class="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Endpoint</th>
                <th class="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                <th class="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                <th class="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              ${renderTestResultsRows(results)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// Helper function to render test results rows
function renderTestResultsRows(results) {
  if (!results || results.length === 0) {
    return `
      <tr>
        <td colspan="6" class="px-4 py-4 text-sm text-gray-500 text-center">No test results available</td>
      </tr>
    `;
  }

  return results
    .map(
      (result) => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3 text-sm text-gray-800 font-mono">${result.id}</td>
      <td class="px-4 py-3 text-sm text-gray-800 font-mono">${result.testCase?.endpoint || 'Unknown'}</td>
      <td class="px-4 py-3 text-sm">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getMethodBadgeColor(result.testCase?.method?.toUpperCase() || 'UNKNOWN')}">
          ${result.testCase?.method?.toUpperCase() || 'UNKNOWN'}
        </span>
      </td>
      <td class="px-4 py-3 text-sm">
        ${
          result.success
            ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
               <i class="fas fa-check-circle mr-1"></i> PASS
             </span>`
            : `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
               <i class="fas fa-times-circle mr-1"></i> FAIL
             </span>`
        }
      </td>
      <td class="px-4 py-3 text-sm text-gray-500">${result.duration}ms</td>
      <td class="px-4 py-3 text-sm">
        <button class="text-blue-600 hover:text-blue-800 focus:outline-none" data-view-details="${result.id}" data-details-type="result">
          <i class="fas fa-eye"></i>
        </button>
      </td>
    </tr>
  `,
    )
    .join('');
}

// Regression view
function renderRegression() {
  if (!state.data.regression) {
    return `
      <div class="text-center p-10">
        <div class="text-yellow-500 text-4xl mb-4">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h1 class="text-xl font-bold text-gray-800 mb-2">No Regression Results Available</h1>
        <p class="text-gray-600 mb-4">Run regression tests first with npm run test:backend:regression</p>
        <a href="#" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md">
          <i class="fas fa-play mr-1"></i>
          Run Regression Tests
        </a>
      </div>
    `;
  }

  const regression = state.data.regression;

  return `
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-800">Regression Analysis</h1>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        ${renderStatCard('Total Tests', regression.totalTests, 'text-blue-600', 'fa-vial')}
        ${renderStatCard('Regressions', regression.regressedTests, 'text-red-600', 'fa-arrow-down')}
        ${renderStatCard('Improvements', regression.improvedTests, 'text-green-600', 'fa-arrow-up')}
        ${renderStatCard('Unchanged', regression.unchangedTests, 'text-gray-600', 'fa-minus')}
      </div>
      
      <div class="card p-5">
        <h2 class="text-lg font-semibold text-gray-800 mb-4">Regression Details</h2>
        
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th class="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Endpoint</th>
                <th class="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                <th class="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Baseline</th>
                <th class="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current</th>
                <th class="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              ${renderRegressionRows(regression.details)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// Helper function to render regression rows
function renderRegressionRows(details) {
  if (!details || details.length === 0) {
    return `
      <tr>
        <td colspan="6" class="px-4 py-4 text-sm text-gray-500 text-center">No regression details available</td>
      </tr>
    `;
  }

  return details
    .map(
      (detail) => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3 text-sm text-gray-800 font-mono">${detail.endpoint}</td>
      <td class="px-4 py-3 text-sm">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getMethodBadgeColor(detail.method?.toUpperCase() || 'UNKNOWN')}">
          ${detail.method?.toUpperCase() || 'UNKNOWN'}
        </span>
      </td>
      <td class="px-4 py-3 text-sm">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${detail.baselineSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
          ${detail.baselineSuccess ? 'PASS' : 'FAIL'}
        </span>
      </td>
      <td class="px-4 py-3 text-sm">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${detail.currentSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
          ${detail.currentSuccess ? 'PASS' : 'FAIL'}
        </span>
      </td>
      <td class="px-4 py-3 text-sm">
        ${getRegressionStatusBadge(detail)}
      </td>
      <td class="px-4 py-3 text-sm">
        <button class="text-blue-600 hover:text-blue-800 focus:outline-none" data-view-details="${detail.id}" data-details-type="regression">
          <i class="fas fa-eye"></i>
        </button>
      </td>
    </tr>
  `,
    )
    .join('');
}

// Helper function to get regression status badge
function getRegressionStatusBadge(detail) {
  if (detail.isRegression) {
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
      <i class="fas fa-arrow-down mr-1"></i> REGRESSION
    </span>`;
  } else if (detail.baselineSuccess !== detail.currentSuccess && detail.currentSuccess) {
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
      <i class="fas fa-arrow-up mr-1"></i> IMPROVED
    </span>`;
  } else {
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
      <i class="fas fa-minus mr-1"></i> UNCHANGED
    </span>`;
  }
}

// Helper function to escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Toggle scenario expansion
function toggleScenario(index) {
  // This will be implemented with event listeners
  console.log('Toggle scenario', index);
}

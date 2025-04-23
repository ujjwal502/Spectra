// Spectra Dashboard

// Global state
const state = {
  currentView: 'dashboard',
  selectedFeature: null,
  selectedItemId: null,
  modalOpen: false,
  modalContent: null,
  data: {
    summary: null,
    features: [],
    results: [],
    regression: null,
    baseline: null,
  },
  view: 'regression',
  testResults: [],
  regressionDetails: [],
  filters: {
    method: 'all',
    endpoint: '',
    status: 'all',
  },
};

// API endpoints
const API = {
  base: '/api/spectra',
  summary: '/api/spectra/summary',
  features: '/api/spectra/features',
  results: '/api/spectra/results',
  regression: '/api/spectra/regression',
  baseline: '/api/spectra/baseline',
};

// Router
function navigateTo(view, params = {}) {
  state.currentView = view;
  if (params.featureId) {
    state.selectedFeature = params.featureId;
  }
  renderApp();
}

// Load data from API
async function loadData() {
  try {
    const summaryResponse = await fetch(API.summary);
    if (summaryResponse.ok) {
      state.data.summary = await summaryResponse.json();
    }

    const featuresResponse = await fetch(API.features);
    if (featuresResponse.ok) {
      state.data.features = await featuresResponse.json();
    }

    try {
      const resultsResponse = await fetch(API.results);
      if (resultsResponse.ok) {
        state.data.results = await resultsResponse.json();
      }
    } catch (e) {
      console.log('No test results available yet');
    }

    try {
      const regressionResponse = await fetch(API.regression);
      if (regressionResponse.ok) {
        state.data.regression = await regressionResponse.json();
      }
    } catch (e) {
      console.log('No regression results available yet');
    }

    try {
      const baselineResponse = await fetch(API.baseline);
      if (baselineResponse.ok) {
        state.data.baseline = await baselineResponse.json();
      }
    } catch (e) {
      console.log('No baseline available yet');
    }

    renderApp();
  } catch (error) {
    console.error('Error loading data:', error);
    renderError('Failed to load data. Please ensure the backend server is running.');
  }
}

// Main render function
function renderApp() {
  const app = document.getElementById('app');

  // Create app container
  app.innerHTML = `
    <div class="flex flex-col h-screen">
      ${renderHeader()}
      <div class="flex flex-1 overflow-hidden">
        ${renderSidebar()}
        <main class="flex-1 overflow-y-auto p-6">
          ${renderContent()}
        </main>
      </div>
      ${state.modalOpen ? renderModal() : ''}
    </div>
  `;

  // Initialize charts after DOM is ready
  if (state.currentView === 'dashboard') {
    initDashboardCharts();
  }

  // Add event listeners
  addEventListeners();
}

// Event listeners
function addEventListeners() {
  // Navigation links
  document.querySelectorAll('[data-nav]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(e.currentTarget.dataset.nav);
    });
  });

  // Feature list items
  document.querySelectorAll('[data-feature-id]').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const featureId = e.currentTarget.dataset.featureId;
      navigateTo('feature-detail', { featureId });
    });
  });

  // Eye icon buttons for viewing details
  document.querySelectorAll('[data-view-details]').forEach((button) => {
    button.addEventListener('click', function () {
      const itemId = this.getAttribute('data-view-details');
      const detailsType = this.getAttribute('data-details-type');

      if (detailsType === 'regression') {
        const regressionDetail = state.data.regression.details.find(
          (detail) => detail.id === itemId,
        );
        if (regressionDetail) {
          showDetailsModal(regressionDetail, 'regression');
        }
      } else if (detailsType === 'result') {
        const testResult = state.data.results
          ? state.data.results.find((result) => result.id === itemId)
          : state.testResults
            ? state.testResults.find((result) => result.id === itemId)
            : null;
        if (testResult) {
          showDetailsModal(testResult, 'result');
        }
      }
    });
  });

  // Modal close button
  const closeBtn = document.querySelector('.modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      state.modalOpen = false;
      state.modalContent = null;
      state.selectedItemId = null;
      renderApp();
    });
  }

  // Close modal when clicking outside
  const modal = document.querySelector('.modal-overlay');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        state.modalOpen = false;
        state.modalContent = null;
        state.selectedItemId = null;
        renderApp();
      }
    });
  }
}

// Show details modal
function showDetailsModal(item, type) {
  state.selectedItemId = item.id;
  state.modalOpen = true;

  if (type === 'regression') {
    state.modalContent = renderRegressionDetails(item);
  } else if (type === 'result') {
    state.modalContent = renderTestResultDetails(item);
  }

  renderApp();
}

// Render modal
function renderModal() {
  return `
    <div class="modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="modal-container bg-white w-11/12 md:max-w-2xl mx-auto rounded-lg shadow-lg overflow-y-auto max-h-screen">
        <div class="modal-content p-6">
          <div class="flex justify-between items-center pb-3 border-b mb-4">
            <h3 class="text-xl font-semibold text-gray-900">Details</h3>
            <button class="modal-close text-gray-500 hover:text-gray-700">
              <i class="fas fa-times"></i>
            </button>
          </div>
          ${state.modalContent || 'No details available'}
        </div>
      </div>
    </div>
  `;
}

// Render regression details
function renderRegressionDetails(detail) {
  const baselineData = detail.baselineResponse || {};
  const currentData = detail.currentResponse || {};

  const statusCodeChanged = baselineData.statusCode !== currentData.statusCode;
  const responseChanged = JSON.stringify(baselineData.body) !== JSON.stringify(currentData.body);
  const assertionsChanged = detail.baselineSuccess !== detail.currentSuccess;

  return `
    <div class="space-y-6">
      <div>
        <h3 class="text-lg font-medium leading-6 text-gray-900">Regression Details</h3>
        <p class="mt-1 text-sm text-gray-500">Endpoint: ${detail.method?.toUpperCase() || 'UNKNOWN'} ${detail.endpoint || 'Unknown'}</p>
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        <div class="border rounded-md p-4">
          <h4 class="font-medium text-gray-900 mb-2">Baseline Response</h4>
          <p class="text-sm text-gray-700 mb-1">Status: 
            <span class="px-2 py-0.5 rounded-full text-xs font-medium ${baselineData.statusCode >= 400 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}">
              ${baselineData.statusCode || 'Unknown'}
            </span>
          </p>
          <p class="text-sm text-gray-700 mb-1">Duration: ${detail.baselineDuration || 0}ms</p>
          <p class="text-sm text-gray-700 mb-1">Assertions: 
            <span class="px-2 py-0.5 rounded-full text-xs font-medium ${detail.baselineSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
              ${detail.baselineSuccess ? 'PASS' : 'FAIL'}
            </span>
          </p>
          <div class="mt-3">
            <p class="text-sm font-medium text-gray-700 mb-1">Response Body:</p>
            <pre class="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-64">${JSON.stringify(baselineData.body || {}, null, 2)}</pre>
          </div>
        </div>
        
        <div class="border rounded-md p-4">
          <h4 class="font-medium text-gray-900 mb-2">Current Response</h4>
          <p class="text-sm text-gray-700 mb-1">Status: 
            <span class="px-2 py-0.5 rounded-full text-xs font-medium ${currentData.statusCode >= 400 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'} ${statusCodeChanged ? 'border-2 border-yellow-400' : ''}">
              ${currentData.statusCode || 'Unknown'}
            </span>
          </p>
          <p class="text-sm text-gray-700 mb-1">Duration: ${detail.currentDuration || 0}ms</p>
          <p class="text-sm text-gray-700 mb-1">Assertions: 
            <span class="px-2 py-0.5 rounded-full text-xs font-medium ${detail.currentSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} ${assertionsChanged ? 'border-2 border-yellow-400' : ''}">
              ${detail.currentSuccess ? 'PASS' : 'FAIL'}
            </span>
          </p>
          <div class="mt-3">
            <p class="text-sm font-medium text-gray-700 mb-1">Response Body:</p>
            <pre class="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-64 ${responseChanged ? 'border-2 border-yellow-400' : ''}">${JSON.stringify(currentData.body || {}, null, 2)}</pre>
          </div>
        </div>
      </div>
      
      ${
        detail.failures && detail.failures.length > 0
          ? `
        <div class="border rounded-md p-4">
          <h4 class="font-medium text-gray-900 mb-2">Failures</h4>
          <ul class="list-disc list-inside space-y-1">
            ${detail.failures.map((failure) => `<li class="text-sm text-red-600">${failure}</li>`).join('')}
          </ul>
        </div>
      `
          : ''
      }
    </div>
  `;
}

// Render test result details
function renderTestResultDetails(result) {
  const testCase = result.testCase || {};
  const response = result.response || {};

  return `
    <div class="space-y-6">
      <div>
        <h3 class="text-lg font-medium leading-6 text-gray-900">Test Result Details</h3>
        <p class="mt-1 text-sm text-gray-500">Endpoint: ${testCase.method?.toUpperCase() || 'UNKNOWN'} ${testCase.endpoint || 'Unknown'}</p>
      </div>
      
      <div class="border rounded-md p-4">
        <h4 class="font-medium text-gray-900 mb-2">Test Result</h4>
        <p class="text-sm text-gray-700 mb-1">Status: 
          <span class="px-2 py-0.5 rounded-full text-xs font-medium ${result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
            ${result.success ? 'PASS' : 'FAIL'}
          </span>
        </p>
        <p class="text-sm text-gray-700 mb-1">Duration: ${result.duration || 0}ms</p>
      </div>
      
      <div class="border rounded-md p-4">
        <h4 class="font-medium text-gray-900 mb-2">Response</h4>
        <p class="text-sm text-gray-700 mb-1">Status: 
          <span class="px-2 py-0.5 rounded-full text-xs font-medium ${response.statusCode >= 400 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}">
            ${response.statusCode || 'Unknown'}
          </span>
        </p>
        <div class="mt-3">
          <p class="text-sm font-medium text-gray-700 mb-1">Response Body:</p>
          <pre class="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-64">${JSON.stringify(response.body || {}, null, 2)}</pre>
        </div>
      </div>
      
      ${
        result.failures && result.failures.length > 0
          ? `
        <div class="border rounded-md p-4">
          <h4 class="font-medium text-gray-900 mb-2">Failures</h4>
          <ul class="list-disc list-inside space-y-1">
            ${result.failures.map((failure) => `<li class="text-sm text-red-600">${failure}</li>`).join('')}
          </ul>
        </div>
      `
          : ''
      }
    </div>
  `;
}

// Error display
function renderError(message) {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="flex items-center justify-center h-screen">
      <div class="text-center">
        <div class="text-red-500 text-5xl mb-4">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h1 class="text-2xl font-bold text-gray-800 mb-2">Oops, something went wrong</h1>
        <p class="text-gray-600 mb-4">${message}</p>
        <button class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md" 
                onclick="loadData()">
          Try Again
        </button>
      </div>
    </div>
  `;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadData();
});

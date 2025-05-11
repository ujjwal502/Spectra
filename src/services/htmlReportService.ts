import * as fs from 'fs';
import * as path from 'path';
import { TestResult, TestCase } from '../types';

/**
 * Service for generating HTML reports of test execution directly in the project being tested
 */
export class HtmlReportService {
  /**
   * Generate HTML test report for test results
   * @param results Map of test results
   * @param outputDir Directory to output HTML reports
   */
  public generateTestReport(results: Map<string, TestResult>, outputDir: string): void {
    // Create reports directory if it doesn't exist
    const reportsDir = path.join(outputDir, 'spectra-reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Create assets directory for CSS and JavaScript
    const assetsDir = path.join(reportsDir, 'assets');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    // Generate CSS file
    this.generateCssFile(assetsDir);

    // Generate JavaScript file
    this.generateJsFile(assetsDir);

    // Generate index.html (summary report)
    this.generateSummaryReport(results, reportsDir);

    // Generate detailed reports for each test case
    this.generateDetailedReports(results, reportsDir);

    // Generate feature reports
    this.generateFeatureReports(results, reportsDir);

    console.log(`✅ HTML reports generated in ${reportsDir}`);
  }

  /**
   * Generate summary report
   * @param results Map of test results
   * @param reportsDir Directory for reports
   */
  private generateSummaryReport(results: Map<string, TestResult>, reportsDir: string): void {
    const totalTests = results.size;
    const passedTests = Array.from(results.values()).filter((r) => r.success).length;
    const failedTests = totalTests - passedTests;
    const passRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

    const resultsArray = Array.from(results.entries());
    const timestamp = new Date().toISOString();

    let html = this.getHtmlHeader('Spectra Test Results');

    html += `
      <div class="container">
        <h1>Spectra Test Results</h1>
        <p class="timestamp">Generated on: ${new Date().toLocaleString()}</p>

        <div class="summary">
          <div class="summary-item">
            <div class="summary-title">Total Tests</div>
            <div class="summary-value">${totalTests}</div>
          </div>
          <div class="summary-item ${passedTests > 0 ? 'success' : ''}">
            <div class="summary-title">Passed</div>
            <div class="summary-value">${passedTests}</div>
          </div>
          <div class="summary-item ${failedTests > 0 ? 'failure' : ''}">
            <div class="summary-title">Failed</div>
            <div class="summary-value">${failedTests}</div>
          </div>
          <div class="summary-item ${passRate >= 80 ? 'success' : passRate >= 50 ? 'warning' : 'failure'}">
            <div class="summary-title">Pass Rate</div>
            <div class="summary-value">${passRate}%</div>
          </div>
        </div>

        <div class="table-container">
          <h2>Test Results</h2>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Endpoint</th>
                <th>Method</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
    `;

    resultsArray.forEach(([id, result]) => {
      const method = result.testCase.method.toUpperCase();
      const methodClass = this.getMethodClass(method);

      html += `
        <tr>
          <td>${id}</td>
          <td>${result.testCase.endpoint}</td>
          <td><span class="method ${methodClass}">${method}</span></td>
          <td><span class="status ${result.success ? 'success' : 'failure'}">${result.success ? 'PASS' : 'FAIL'}</span></td>
          <td>${result.duration}ms</td>
          <td><a href="./details-${id}.html">View Details</a></td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
        </div>
        
        <div class="navigation">
          <a href="./features.html" class="button">View Feature Files</a>
        </div>
      </div>
    `;

    html += this.getHtmlFooter();

    fs.writeFileSync(path.join(reportsDir, 'index.html'), html);
  }

  /**
   * Generate detailed report for each test case
   * @param results Map of test results
   * @param reportsDir Directory for reports
   */
  private generateDetailedReports(results: Map<string, TestResult>, reportsDir: string): void {
    for (const [id, result] of results.entries()) {
      let html = this.getHtmlHeader(`Test Details: ${id}`);

      html += `
        <div class="container">
          <div class="back-link">
            <a href="./index.html">← Back to Summary</a>
          </div>
          
          <h1>Test Details: ${id}</h1>
          <div class="status-banner ${result.success ? 'success' : 'failure'}">
            ${result.success ? 'PASSED' : 'FAILED'}
          </div>

          <div class="details-section">
            <h2>Test Information</h2>
            <table>
              <tr>
                <th>Endpoint</th>
                <td>${result.testCase.endpoint}</td>
              </tr>
              <tr>
                <th>Method</th>
                <td><span class="method ${this.getMethodClass(result.testCase.method.toUpperCase())}">${result.testCase.method.toUpperCase()}</span></td>
              </tr>
              <tr>
                <th>Duration</th>
                <td>${result.duration}ms</td>
              </tr>
            </table>
          </div>

          <div class="details-section">
            <h2>Feature Description</h2>
            <div class="feature-box">
              <h3>${result.testCase.feature.title}</h3>
              ${this.renderScenarios(result.testCase.feature.scenarios)}
            </div>
          </div>
      `;

      if (result.assertions && result.assertions.length > 0) {
        html += `
          <div class="details-section">
            <h2>Assertions</h2>
            <table>
              <thead>
                <tr>
                  <th>Assertion</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
        `;

        result.assertions.forEach((assertion) => {
          html += `
            <tr>
              <td>${assertion.name}</td>
              <td><span class="status ${assertion.success ? 'success' : 'failure'}">${assertion.success ? 'PASS' : 'FAIL'}</span></td>
              <td>${assertion.error || '-'}</td>
            </tr>
          `;
        });

        html += `
              </tbody>
            </table>
          </div>
        `;
      }

      // Request details
      const requestData = (result as any).request || {};
      html += `
        <div class="details-section">
          <h2>Request</h2>
          <pre class="code-block">${this.stringifyForHtml(requestData)}</pre>
        </div>
      `;

      // Response details if available
      if (result.response) {
        html += `
          <div class="details-section">
            <h2>Response</h2>
            <div class="response-details">
              <div class="response-status">
                <span class="response-status-code ${result.response.status >= 200 && result.response.status < 300 ? 'success' : result.response.status >= 400 ? 'failure' : 'warning'}">
                  ${result.response.status}
                </span>
                <span class="response-status-text">${this.getStatusText(result.response.status)}</span>
              </div>
              <h3>Headers</h3>
              <pre class="code-block">${this.stringifyForHtml(result.response.headers || {})}</pre>
              <h3>Body</h3>
              <pre class="code-block">${this.stringifyForHtml(result.response.body || {})}</pre>
            </div>
          </div>
        `;
      }

      // Error message if any
      if (result.error) {
        html += `
          <div class="details-section error-section">
            <h2>Error</h2>
            <div class="error-message">${result.error}</div>
          </div>
        `;
      }

      html += `
        </div>
      `;

      html += this.getHtmlFooter();

      fs.writeFileSync(path.join(reportsDir, `details-${id}.html`), html);
    }
  }

  /**
   * Generate feature files report
   * @param results Map of test results
   * @param reportsDir Directory for reports
   */
  private generateFeatureReports(results: Map<string, TestResult>, reportsDir: string): void {
    // Extract unique features and their tests
    const featuresMap = new Map<string, TestCase[]>();

    for (const [id, result] of results.entries()) {
      const featureTitle = result.testCase.feature.title;

      if (!featuresMap.has(featureTitle)) {
        featuresMap.set(featureTitle, []);
      }

      featuresMap.get(featureTitle)?.push(result.testCase);
    }

    // Create features overview page
    let html = this.getHtmlHeader('Spectra Feature Files');

    html += `
      <div class="container">
        <div class="back-link">
          <a href="./index.html">← Back to Summary</a>
        </div>
        
        <h1>Feature Files</h1>
        <p>This page shows all Gherkin feature files used for testing.</p>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Feature</th>
                <th>Scenarios</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
    `;

    const featureEntries = Array.from(featuresMap.entries());
    featureEntries.forEach(([title, testCases], index) => {
      const featureId = `feature-${index}`;

      html += `
        <tr>
          <td>${title}</td>
          <td>${testCases.length}</td>
          <td><a href="./${featureId}.html">View Feature</a></td>
        </tr>
      `;

      // Generate individual feature file page
      this.generateFeatureFilePage(title, testCases, reportsDir, featureId);
    });

    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;

    html += this.getHtmlFooter();

    fs.writeFileSync(path.join(reportsDir, 'features.html'), html);
  }

  /**
   * Generate a page for a specific feature file
   * @param title Feature title
   * @param testCases Test cases for this feature
   * @param reportsDir Directory for reports
   * @param featureId Unique ID for this feature
   */
  private generateFeatureFilePage(
    title: string,
    testCases: TestCase[],
    reportsDir: string,
    featureId: string,
  ): void {
    let html = this.getHtmlHeader(`Feature: ${title}`);

    html += `
      <div class="container">
        <div class="back-link">
          <a href="./features.html">← Back to Features</a>
        </div>
        
        <h1>Feature: ${title}</h1>

        <div class="feature-content">
    `;

    testCases.forEach((testCase) => {
      html += `
        <div class="feature-box">
          <div class="feature-header">
            <span class="method ${this.getMethodClass(testCase.method.toUpperCase())}">${testCase.method.toUpperCase()}</span>
            <span class="endpoint">${testCase.endpoint}</span>
          </div>
          ${this.renderScenarios(testCase.feature.scenarios)}
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    html += this.getHtmlFooter();

    fs.writeFileSync(path.join(reportsDir, `${featureId}.html`), html);
  }

  /**
   * Render scenarios in HTML
   * @param scenarios Test scenarios
   * @returns HTML string
   */
  private renderScenarios(scenarios: any[]): string {
    if (!scenarios || scenarios.length === 0) {
      return '<p>No scenarios defined</p>';
    }

    let html = '';

    scenarios.forEach((scenario) => {
      html += `
        <div class="scenario">
          <h4>Scenario: ${scenario.title}</h4>
          <ul class="steps">
      `;

      if (scenario.steps && scenario.steps.length > 0) {
        scenario.steps.forEach((step: any) => {
          html += `
            <li class="step">
              <span class="keyword">${step.keyword}</span> ${step.text}
            </li>
          `;
        });
      } else {
        html += '<li>No steps defined</li>';
      }

      html += `
          </ul>
        </div>
      `;
    });

    return html;
  }

  /**
   * Generate CSS file for styling the reports
   * @param assetsDir Directory for assets
   */
  private generateCssFile(assetsDir: string): void {
    const css = `
      /* Spectra Test Report Styles */
      :root {
        --color-primary: #4f46e5;
        --color-success: #22c55e;
        --color-warning: #eab308;
        --color-danger: #ef4444;
        --color-info: #3b82f6;
        --color-bg: #f9fafb;
        --color-text: #1f2937;
        --color-text-light: #6b7280;
        --color-border: #e5e7eb;
        --method-get: #22c55e;
        --method-post: #3b82f6;
        --method-put: #eab308;
        --method-patch: #8b5cf6;
        --method-delete: #ef4444;
      }

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        line-height: 1.5;
        color: var(--color-text);
        background-color: var(--color-bg);
      }

      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 2rem;
      }

      h1, h2, h3, h4 {
        margin-bottom: 1rem;
        color: var(--color-text);
      }

      h1 {
        font-size: 2rem;
        border-bottom: 1px solid var(--color-border);
        padding-bottom: 0.5rem;
        margin-bottom: 1.5rem;
      }

      h2 {
        font-size: 1.5rem;
        margin-top: 2rem;
      }

      p {
        margin-bottom: 1rem;
      }

      a {
        color: var(--color-primary);
        text-decoration: none;
      }

      a:hover {
        text-decoration: underline;
      }

      .timestamp {
        color: var(--color-text-light);
        font-style: italic;
        margin-bottom: 2rem;
      }

      .summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 2rem;
      }

      .summary-item {
        padding: 1.5rem;
        background-color: white;
        border-radius: 0.5rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        text-align: center;
      }

      .summary-title {
        font-weight: 600;
        color: var(--color-text-light);
        margin-bottom: 0.5rem;
      }

      .summary-value {
        font-size: 2rem;
        font-weight: 700;
      }

      .summary-item.success .summary-value {
        color: var(--color-success);
      }

      .summary-item.warning .summary-value {
        color: var(--color-warning);
      }

      .summary-item.failure .summary-value {
        color: var(--color-danger);
      }

      .table-container {
        margin-bottom: 2rem;
        overflow-x: auto;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 2rem;
      }

      th, td {
        padding: 0.75rem 1rem;
        text-align: left;
        border-bottom: 1px solid var(--color-border);
      }

      th {
        background-color: rgba(0,0,0,0.02);
        font-weight: 600;
      }

      tr:hover {
        background-color: rgba(0,0,0,0.01);
      }

      .method {
        display: inline-block;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        font-weight: 600;
        font-size: 0.75rem;
        color: white;
      }

      .method.get {
        background-color: var(--method-get);
      }

      .method.post {
        background-color: var(--method-post);
      }

      .method.put {
        background-color: var(--method-put);
      }

      .method.patch {
        background-color: var(--method-patch);
      }

      .method.delete {
        background-color: var(--method-delete);
      }

      .status {
        display: inline-block;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        font-weight: 600;
        font-size: 0.75rem;
        color: white;
      }

      .status.success {
        background-color: var(--color-success);
      }

      .status.failure {
        background-color: var(--color-danger);
      }

      .status.warning {
        background-color: var(--color-warning);
      }

      .navigation {
        margin-top: 2rem;
        display: flex;
        justify-content: flex-end;
      }

      .button {
        display: inline-block;
        background-color: var(--color-primary);
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 0.25rem;
        text-decoration: none;
      }

      .button:hover {
        opacity: 0.9;
        text-decoration: none;
      }

      .back-link {
        margin-bottom: 1rem;
      }

      .details-section {
        background-color: white;
        border-radius: 0.5rem;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }

      .details-section h2 {
        margin-top: 0;
        border-bottom: 1px solid var(--color-border);
        padding-bottom: 0.5rem;
        margin-bottom: 1rem;
      }

      .status-banner {
        padding: 0.75rem;
        text-align: center;
        font-weight: bold;
        color: white;
        border-radius: 0.25rem;
        margin-bottom: 1.5rem;
      }

      .status-banner.success {
        background-color: var(--color-success);
      }

      .status-banner.failure {
        background-color: var(--color-danger);
      }

      .code-block {
        background-color: #f3f4f6;
        padding: 1rem;
        border-radius: 0.25rem;
        overflow-x: auto;
        font-family: monospace;
        white-space: pre-wrap;
        margin-bottom: 1rem;
      }

      .error-section {
        border-left: 4px solid var(--color-danger);
      }

      .error-message {
        color: var(--color-danger);
        font-family: monospace;
        white-space: pre-wrap;
      }

      .response-status {
        display: flex;
        align-items: center;
        margin-bottom: 1rem;
      }

      .response-status-code {
        display: inline-block;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        font-weight: 600;
        color: white;
        margin-right: 0.5rem;
      }

      .response-status-text {
        color: var(--color-text-light);
      }

      .feature-box {
        border: 1px solid var(--color-border);
        border-radius: 0.25rem;
        margin-bottom: 1rem;
        overflow: hidden;
      }

      .feature-header {
        padding: 0.75rem;
        background-color: rgba(0,0,0,0.02);
        border-bottom: 1px solid var(--color-border);
      }

      .feature-header .endpoint {
        margin-left: 0.5rem;
        font-family: monospace;
      }

      .scenario {
        padding: 1rem;
        border-bottom: 1px solid var(--color-border);
      }

      .scenario:last-child {
        border-bottom: none;
      }

      .scenario h4 {
        margin-bottom: 0.5rem;
      }

      .steps {
        list-style: none;
      }

      .step {
        margin-bottom: 0.25rem;
        padding-left: 1rem;
      }

      .step .keyword {
        font-weight: 600;
        color: var(--color-primary);
      }

      .feature-content {
        margin-top: 1.5rem;
      }

      /* Responsive */
      @media (max-width: 768px) {
        .container {
          padding: 1rem;
        }
        
        .summary {
          grid-template-columns: 1fr;
        }
      }
    `;

    fs.writeFileSync(path.join(assetsDir, 'styles.css'), css);
  }

  /**
   * Generate JavaScript file for report interactivity
   * @param assetsDir Directory for assets
   */
  private generateJsFile(assetsDir: string): void {
    const js = `
      // Spectra Report JavaScript functionality
      document.addEventListener('DOMContentLoaded', function() {
        // Any interactive functionality can be added here
        
        // Code highlighting for JSON
        const codeBlocks = document.querySelectorAll('.code-block');
        codeBlocks.forEach(block => {
          try {
            const content = block.textContent;
            if (content && content.trim().startsWith('{')) {
              // It's likely JSON, attempt to format it
              const parsed = JSON.parse(content);
              block.textContent = JSON.stringify(parsed, null, 2);
            }
          } catch (e) {
            // Not valid JSON or other error, leave as is
          }
        });
      });
    `;

    fs.writeFileSync(path.join(assetsDir, 'script.js'), js);
  }

  /**
   * Get HTML header with styles and meta information
   * @param title Page title
   * @returns HTML header string
   */
  private getHtmlHeader(title: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="./assets/styles.css">
</head>
<body>
`;
  }

  /**
   * Get HTML footer with scripts
   * @returns HTML footer string
   */
  private getHtmlFooter(): string {
    return `
  <script src="./assets/script.js"></script>
</body>
</html>`;
  }

  /**
   * Safely stringify an object for HTML display
   * @param obj Object to stringify
   * @returns Safe string for HTML
   */
  private stringifyForHtml(obj: any): string {
    try {
      return JSON.stringify(obj, null, 2)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    } catch (e) {
      return String(obj);
    }
  }

  /**
   * Get CSS class for HTTP method
   * @param method HTTP method
   * @returns CSS class name
   */
  private getMethodClass(method: string): string {
    const methodLower = method.toLowerCase();
    return ['get', 'post', 'put', 'patch', 'delete'].includes(methodLower) ? methodLower : 'get';
  }

  /**
   * Get status text for HTTP status code
   * @param status HTTP status code
   * @returns Status text
   */
  private getStatusText(status: number): string {
    const statusTexts: { [key: number]: string } = {
      200: 'OK',
      201: 'Created',
      204: 'No Content',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      500: 'Internal Server Error',
    };

    return statusTexts[status] || 'Unknown Status';
  }
}

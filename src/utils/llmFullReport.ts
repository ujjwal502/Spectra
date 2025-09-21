import * as fs from 'fs';
import * as path from 'path';
import { OpenAPIV3 } from 'openapi-types';
import {
	TestingState,
	TestScenario,
	TestResult,
	TestAnalysis,
	GherkinFeature,
} from '../types/langGraphTypes';

function ensureDir(dir: string): void {
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function computeAnalysis(results: TestResult[]): TestAnalysis {
	const total = results.length;
	const passed = results.filter((r) => r.success).length;
	const overallSuccessRate = total > 0 ? Math.round((passed / total) * 100) : 0;
	return {
		overallSuccessRate,
		phaseResults: { functional: overallSuccessRate },
		criticalIssues: [],
		patterns: [],
		riskAssessment: {
			level: overallSuccessRate >= 80 ? 'low' : overallSuccessRate >= 50 ? 'medium' : 'high',
			factors: [],
			mitigations: [],
		},
	};
}

function writeJsonReport(state: TestingState, outBaseDir: string): void {
	const reportsDir = path.join(outBaseDir, 'spectra', 'test-results');
	ensureDir(reportsDir);

	const report = {
		timestamp: new Date().toISOString(),
		testingFramework: 'Spectra Systems Inspector',
		version: '2.0.0',
		summary: {
			totalScenarios: state.testScenarios.length,
			totalResults: state.testResults.length,
			totalGherkinFeatures: state.gherkinFeatures.length,
			totalGherkinScenarios: state.gherkinFeatures.reduce((sum, f) => sum + f.scenarios.length, 0),
			overallSuccessRate: state.analysis?.overallSuccessRate || 0,
			riskLevel: state.analysis?.riskAssessment.level || 'unknown',
			criticalIssues: state.analysis?.criticalIssues.length || 0,
			patternsFound: state.analysis?.patterns.length || 0,
			recommendationsGenerated: state.recommendations.length,
		},
		testScenarios: state.testScenarios,
		gherkinFeatures: state.gherkinFeatures,
		gherkinSummary: state.gherkinSummary,
		testResults: state.testResults,
		analysis: state.analysis,
		recommendations: state.recommendations,
		messages: state.messages,
	};
	fs.writeFileSync(path.join(reportsDir, 'spectra-test-report.json'), JSON.stringify(report, null, 2));
}

function writeDetailedResults(state: TestingState, outBaseDir: string): void {
	const reportsDir = path.join(outBaseDir, 'spectra', 'test-results');
	ensureDir(reportsDir);

	const resultsByType = state.testResults.reduce(
		(acc, result) => {
			const scenario = state.testScenarios.find((s) => s.id === result.scenarioId);
			const type = scenario?.type || 'unknown';
			if (!acc[type]) acc[type] = [] as any[];
			acc[type].push({ scenario, result, insights: result.insights, duration: result.duration });
			return acc;
		},
		{} as Record<string, any[]>,
	);

	const detailed = {
		timestamp: new Date().toISOString(),
		resultsByType,
		statistics: {
			byType: Object.entries(resultsByType).reduce((acc, [type, list]) => {
				const passed = (list as any[]).filter((r: any) => r.result.success).length;
				(acc as any)[type] = {
					total: (list as any[]).length,
					passed,
					failed: (list as any[]).length - passed,
					successRate: ((passed / (list as any[]).length) * 100).toFixed(1) + '%',
				};
				return acc;
			}, {} as Record<string, any>),
		},
	};

	fs.writeFileSync(path.join(reportsDir, 'detailed-test-results.json'), JSON.stringify(detailed, null, 2));
}

function writeTestCases(state: TestingState, outBaseDir: string): void {
	const reportsDir = path.join(outBaseDir, 'spectra', 'test-results');
	ensureDir(reportsDir);

	const testCases = {
		timestamp: new Date().toISOString(),
		totalTestCases: state.testScenarios.length,
		testFramework: 'Spectra Systems Inspector v2.0',
		testCasesByType: state.testScenarios.reduce((acc, s) => { (acc as any)[s.type] = ([...(acc as any)[s.type] || [], s]); return acc; }, {} as Record<string, TestScenario[]>),
		testCasesByEndpoint: state.testScenarios.reduce((acc, s) => { const k = `${s.method} ${s.endpoint}`; (acc as any)[k] = ([...(acc as any)[k] || [], s]); return acc; }, {} as Record<string, TestScenario[]>),
		allTestCases: state.testScenarios.map((scenario) => ({
			id: scenario.id,
			type: scenario.type,
			endpoint: scenario.endpoint,
			method: scenario.method,
			description: scenario.description,
			intent: scenario.intent,
			testData: scenario.testData,
			expectedOutcome: scenario.expectedOutcome,
			dependencies: scenario.dependencies,
			createdAt: new Date().toISOString(),
			tags: [scenario.type, scenario.method.toLowerCase()],
			executionStatus: (state.testResults.find((r) => r.scenarioId === scenario.id)?.success ?? null) === null ? 'not_executed' : (state.testResults.find((r) => r.scenarioId === scenario.id)?.success ? 'passed' : 'failed'),
		})),
		summary: {
			byType: state.testScenarios.reduce((acc, s) => { (acc as any)[s.type] = ((acc as any)[s.type] || 0) + 1; return acc; }, {} as Record<string, number>),
			byEndpoint: state.testScenarios.reduce((acc, s) => { const k = `${s.method} ${s.endpoint}`; (acc as any)[k] = ((acc as any)[k] || 0) + 1; return acc; }, {} as Record<string, number>),
			totalEndpoints: new Set(state.testScenarios.map((s) => s.endpoint)).size,
		},
	};

	fs.writeFileSync(path.join(reportsDir, 'test-cases.json'), JSON.stringify(testCases, null, 2));
}

function generateTestCasesHtml(testScenarios: TestScenario[], testResults: TestResult[]): string {
	if (testScenarios.length === 0) {
		return '<p>No test cases generated. Run the Spectra testing workflow to generate test cases.</p>';
	}
	const testsByType = testScenarios.reduce((acc, s) => { (acc as any)[s.type] = ([...(acc as any)[s.type] || [], s]); return acc; }, {} as Record<string, TestScenario[]>);
	return Object.entries(testsByType).map(([type, scenarios]) => `
		<div class="feature-card">
			<div class="feature-header">
				<h3 class="feature-title">🧪 ${type.toUpperCase()} Test Cases</h3>
				<span class="feature-tag">${(scenarios as TestScenario[]).length} test cases</span>
			</div>
			<div class="scenarios-list">
				${(scenarios as TestScenario[]).map((scenario) => {
					const executionResult = testResults.find((r) => r.scenarioId === scenario.id);
					const status = executionResult ? (executionResult.success ? 'passed' : 'failed') : 'not_executed';
					const statusIcon = status === 'passed' ? '✅' : status === 'failed' ? '❌' : '⏳';
					return `
					<div class="scenario-item">
						<div class="scenario-title">
							${statusIcon} ${scenario.description}
							<span class="tag" style="background: ${status === 'passed' ? 'var(--accent-green)' : status === 'failed' ? 'var(--accent-red)' : 'var(--accent-orange)'}">${status.replace('_', ' ')}</span>
						</div>
						<div class="test-case-details">
							<div class="detail-row"><strong>Endpoint:</strong> ${scenario.method} ${scenario.endpoint}</div>
							<div class="detail-row"><strong>Intent:</strong> ${scenario.intent}</div>
							<div class="detail-row"><strong>Expected Status:</strong> ${scenario.expectedOutcome.statusCode}</div>
							${executionResult ? `<div class=\"detail-row\"><strong>Actual Status:</strong> ${executionResult.actualStatusCode}</div><div class=\"detail-row\"><strong>Duration:</strong> ${executionResult.duration}ms</div>` : ''}
							<div class="detail-row"><strong>Test Data:</strong><pre class="test-data-preview">${JSON.stringify(scenario.testData, null, 2)}</pre></div>
						</div>
					</div>`;
				}).join('')}
			</div>
		</div>
	`).join('');
}

function writeHtmlDashboard(state: TestingState, outBaseDir: string): void {
	const dashboardDir = path.join(outBaseDir, 'spectra', 'dashboard');
	ensureDir(dashboardDir);
	const totalTests = state.testResults.length;
	const passedTests = state.testResults.filter((r) => r.success).length;
	const failedTests = totalTests - passedTests;
	const totalGherkinFeatures = state.gherkinFeatures.length;
	const totalGherkinScenarios = state.gherkinFeatures.reduce((sum, f) => sum + f.scenarios.length, 0);
	const avgResponseTime = state.testResults.length > 0 ? Math.round(state.testResults.reduce((sum, r) => sum + (r.duration || 0), 0) / state.testResults.length) : 0;
	const resultsByType = state.testResults.reduce((acc, r) => {
		const s = state.testScenarios.find((x) => x.id === r.scenarioId);
		const t = s?.type || 'unknown';
		(acc as any)[t] = (acc as any)[t] || { total: 0, passed: 0, failed: 0 };
		(acc as any)[t].total++;
		if (r.success) (acc as any)[t].passed++; else (acc as any)[t].failed++;
		return acc;
	}, {} as Record<string, { total: number; passed: number; failed: number }>);
	const successRate = state.analysis?.overallSuccessRate || 0;
	const testCasesHtml = generateTestCasesHtml(state.testScenarios, state.testResults);
	const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Spectra Enterprise Dashboard</title>
	<style>body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0;background:#f8fafc;color:#111827} .container{padding:24px} .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:24px} .card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px} .h{font-size:20px;font-weight:700;margin:0 0 8px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #e5e7eb;padding:8px;text-align:left;font-size:14px} .tag{display:inline-block;background:#2563eb;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px} .ok{color:#16a34a} .warn{color:#f59e0b} .bad{color:#dc2626}</style>
</head>
<body>
	<div class="container">
		<h1 class="h">Spectra Enterprise Dashboard</h1>
		<div class="grid">
			<div class="card"><div class="h">Success Rate</div><div class="${successRate>=80?'ok':successRate>=60?'warn':'bad'}">${successRate}%</div></div>
			<div class="card"><div class="h">Total Tests</div><div>${totalTests}</div></div>
			<div class="card"><div class="h">Passed</div><div class="ok">${passedTests}</div></div>
			<div class="card"><div class="h">Failed</div><div class="bad">${failedTests}</div></div>
			<div class="card"><div class="h">Avg Response</div><div>${avgResponseTime}ms</div></div>
		</div>
		<div class="card"><div class="h">Test Category Breakdown</div>
			<table><thead><tr><th>Type</th><th>Passed</th><th>Failed</th><th>Total</th><th>Success%</th></tr></thead><tbody>
			${Object.entries(resultsByType).map(([t,st]:any)=>`<tr><td>${t.toUpperCase()}</td><td>${st.passed}</td><td>${st.failed}</td><td>${st.total}</td><td>${Math.round((st.passed/st.total)*100)}%</td></tr>`).join('')}
			</tbody></table>
		</div>
		<div class="card"><div class="h">Generated Test Cases</div>${testCasesHtml}</div>
	</div>
</body>
</html>`;
	fs.writeFileSync(path.join(dashboardDir, 'spectra-dashboard.html'), html);
}

export async function writeFullLlmReports(
	sourceSpecPath: string,
	apiSpec: OpenAPIV3.Document,
	scenarios: TestScenario[],
	results: Array<{ id: string; success: boolean; status?: number; duration?: number; error?: string }>,
	outBaseDir: string,
): Promise<void> {
	const testResults: TestResult[] = results.map((r) => ({
		scenarioId: r.id,
		success: !!r.success,
		actualStatusCode: typeof r.status === 'number' ? r.status : 0,
		expectedStatusCode: scenarios.find((s) => s.id === r.id)?.expectedOutcome.statusCode || 200,
		response: { status: r.status, body: undefined },
		duration: r.duration || 0,
		errors: r.error ? [r.error] : [],
		insights: [],
	}));
	const analysis = computeAnalysis(testResults);
	const state: TestingState = {
		apiSpec,
		testScenarios: scenarios,
		testResults,
		gherkinFeatures: [] as GherkinFeature[],
		recommendations: [],
		currentPhase: 'complete',
		messages: ['LLM-cURL full report'],
		analysis,
	};
	writeJsonReport(state, outBaseDir);
	writeDetailedResults(state, outBaseDir);
	writeTestCases(state, outBaseDir);
	writeHtmlDashboard(state, outBaseDir);
}

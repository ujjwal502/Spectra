import * as fs from 'fs';
import * as path from 'path';

export interface CurlStepResultSummary {
	id: string;
	success: boolean;
	status?: number;
	duration?: number;
	error?: string;
}

export interface CurlRunReport {
	timestamp: string;
	sourceSpec: string;
	baseUrl?: string;
	total: number;
	passed: number;
	failed: number;
	results: CurlStepResultSummary[];
}

export function ensureDir(dir: string): void {
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
}

export function writeJsonReport(report: CurlRunReport, outDir: string): string {
	ensureDir(outDir);
	const file = path.join(outDir, 'llm-curl-report.json');
	fs.writeFileSync(file, JSON.stringify(report, null, 2), 'utf-8');
	return file;
}

export function writeHtmlReport(report: CurlRunReport, outDir: string): string {
	ensureDir(outDir);
	const file = path.join(outDir, 'llm-curl-report.html');
	const passRate = report.total > 0 ? Math.round((report.passed / report.total) * 100) : 0;
	const rows = report.results
		.map(
			(r) => `
		<tr>
			<td>${r.id}</td>
			<td>${r.success ? 'PASS' : 'FAIL'}</td>
			<td>${r.status ?? '-'}</td>
			<td>${r.duration ?? '-'}</td>
			<td>${r.error ? String(r.error) : ''}</td>
		</tr>`,
		)
		.join('');
	const html = `<!doctype html>
<html>
<head>
	<meta charset="utf-8" />
	<title>Spectra LLM cURL Report</title>
	<style>
		body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 24px; }
		h1 { margin: 0 0 8px; }
		.summary { margin-bottom: 16px; }
		table { border-collapse: collapse; width: 100%; }
		th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 14px; }
		th { background: #f8fafc; text-align: left; }
		.status-pass { color: #16a34a; }
		.status-fail { color: #dc2626; }
	</style>
</head>
<body>
	<h1>Spectra LLM cURL Report</h1>
	<div class="summary">
		<div><strong>Generated:</strong> ${report.timestamp}</div>
		<div><strong>Spec:</strong> ${report.sourceSpec}</div>
		<div><strong>Base URL:</strong> ${report.baseUrl || '-'}</div>
		<div><strong>Results:</strong> ${report.passed}/${report.total} passed (<span class="${passRate >= 80 ? 'status-pass' : 'status-fail'}">${passRate}%</span>)</div>
	</div>
	<table>
		<thead>
			<tr>
				<th>ID</th>
				<th>Status</th>
				<th>HTTP</th>
				<th>Duration (ms)</th>
				<th>Error</th>
			</tr>
		</thead>
		<tbody>
			${rows}
		</tbody>
	</table>
</body>
</html>`;
	fs.writeFileSync(file, html, 'utf-8');
	return file;
}

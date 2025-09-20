import * as fs from 'fs';
import * as path from 'path';

export interface CodeIndex {
  files: string[];
  lang: 'node' | 'java' | 'other';
  // simple symbol buckets for quick lookup
  routes: Record<string, string[]>; // key: METHOD PATH, value: code snippets
  validators: Record<string, string[]>; // key: DTO/Schema name, value: code snippets
  authHints: string[]; // simple strings indicating auth middleware/filters
}

export interface EndpointContext {
  implSnippets: string[];
  middlewares: string[];
  dtoNames: string[];
  produces: string[];
  consumes: string[];
}

export interface ValidationRule {
  path: string; // dot path within request body
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
}

export interface ValidationContext {
  rules: ValidationRule[];
  headersRequired?: string[];
  authRequired?: boolean;
}

function listFilesRecursive(root: string, exts: string[]): string[] {
  const results: string[] = [];
  const stack: string[] = [root];
  while (stack.length) {
    const current = stack.pop() as string;
    const stats = fs.existsSync(current) ? fs.statSync(current) : null;
    if (!stats) continue;
    if (stats.isDirectory()) {
      const entries = fs.readdirSync(current);
      for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'node_modules' || entry === 'target') continue;
        stack.push(path.join(current, entry));
      }
    } else if (stats.isFile()) {
      const ext = path.extname(current).toLowerCase();
      if (exts.includes(ext)) results.push(current);
    }
  }
  return results;
}

export async function buildCodeIndex(codeRoot: string): Promise<CodeIndex> {
  const exts = ['.ts', '.js', '.java'];
  const files = listFilesRecursive(codeRoot, exts);

  let lang: CodeIndex['lang'] = 'other';
  if (files.some((f) => f.endsWith('.ts') || f.endsWith('.js'))) lang = 'node';
  if (files.some((f) => f.endsWith('.java'))) lang = lang === 'node' ? 'node' : 'java';

  const routes: Record<string, string[]> = {};
  const validators: Record<string, string[]> = {};
  const authHints: string[] = [];

  for (const file of files) {
    let text = '';
    try {
      text = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }

    // Express/Router patterns
    if (file.endsWith('.ts') || file.endsWith('.js')) {
      const routeRegex = /(app|router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi;
      let match: RegExpExecArray | null;
      while ((match = routeRegex.exec(text))) {
        const method = match[2].toUpperCase();
        const p = match[3];
        const key = `${method} ${p}`;
        if (!routes[key]) routes[key] = [];
        routes[key].push(snippetAround(text, match.index));
      }

      // Zod/Joi/class-validator hints
      const validatorRegexes = [
        /z\.object\s*\([\s\S]*?\)/gi,
        /Joi\.object\s*\([\s\S]*?\)/gi,
        /@IsEmail\(.*?\)|@Length\(.*?\)|@IsNotEmpty\(.*?\)|@Min\(.*?\)|@Max\(.*?\)/g,
      ];
      for (const vr of validatorRegexes) {
        let m: RegExpExecArray | null;
        while ((m = vr.exec(text))) {
          const key = path.basename(file);
          if (!validators[key]) validators[key] = [];
          validators[key].push(snippetAround(text, m.index));
        }
      }

      // Auth middleware hints
      if (/passport|jwt|authorize|authMiddleware|verifyToken/i.test(text)) {
        authHints.push(file);
      }
    }

    // Spring Boot patterns
    if (file.endsWith('.java')) {
      const mappingRegex = /@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)\s*(\(.*?\))?[\s\S]*?public\s+[^{]+\{/g;
      let m: RegExpExecArray | null;
      while ((m = mappingRegex.exec(text))) {
        const ann = m[1];
        const annArgs = (m[2] || '').toString();
        const pathMatch = annArgs.match(/\(\s*value\s*=\s*\{?\s*"([^"]+)"/)
          || annArgs.match(/\(\s*"([^"]+)"/);
        const javaMethod = ann.replace('Mapping', '').toUpperCase();
        const p = pathMatch ? pathMatch[1] : '';
        const key = `${javaMethod} ${p}`;
        if (!routes[key]) routes[key] = [];
        routes[key].push(snippetAround(text, m.index));
      }

      // DTO validation via jakarta.validation
      const dtoRegex = /class\s+(\w+)\s*\{[\s\S]*?\}/g;
      let d: RegExpExecArray | null;
      while ((d = dtoRegex.exec(text))) {
        const cls = d[1];
        const body = d[0];
        if (/@NotNull|@NotBlank|@Email|@Size|@Min|@Max/.test(body)) {
          if (!validators[cls]) validators[cls] = [];
          validators[cls].push(snippetAround(text, d.index));
        }
      }

      // Spring Security hints
      if (/@PreAuthorize|OncePerRequestFilter|SecurityFilterChain|BearerToken/i.test(text)) {
        authHints.push(file);
      }
    }
  }

  return { files, lang, routes, validators, authHints };
}

export function getEndpointContext(index: CodeIndex, method: string, p: string): EndpointContext {
  const key = `${method.toUpperCase()} ${p}`;
  return {
    implSnippets: index.routes[key] || [],
    middlewares: (index.routes[key] || []).filter((s) => /auth|middleware|guard/i.test(s)),
    dtoNames: [],
    produces: [],
    consumes: [],
  };
}

export function getValidationContext(index: CodeIndex, dtoOrRef?: string): ValidationContext {
  const rules: ValidationRule[] = [];

  // Very lightweight heuristics from validator snippets
  const sources = dtoOrRef ? (index.validators[dtoOrRef] || []) : Object.values(index.validators).flat();
  const text = sources.join('\n');

  // class-validator and jakarta sizing
  const sizeRegex = /@Size\(\s*min\s*=\s*(\d+)\s*,\s*max\s*=\s*(\d+)\s*\)|@Length\(\s*(\d+)\s*,\s*(\d+)\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = sizeRegex.exec(text))) {
    const min = parseInt((m[1] || m[3]) || '0', 10);
    const max = parseInt((m[2] || m[4]) || '0', 10);
    rules.push({ path: '*', minLength: min, maxLength: max });
  }

  if (/@Email|@IsEmail/.test(text)) {
    rules.push({ path: '*', format: 'email' });
  }

  if (/@NotNull|@NotBlank|@IsNotEmpty/.test(text)) {
    rules.push({ path: '*', required: true });
  }

  return { rules, headersRequired: [], authRequired: index.authHints.length > 0 };
}

export function getAuthContext(index: CodeIndex): { type?: 'jwt' | 'basic' | 'session'; header?: string } | null {
  const joined = index.authHints.join('\n');
  if (/jwt|bearer/i.test(joined)) return { type: 'jwt', header: 'Authorization' };
  if (/basic/i.test(joined)) return { type: 'basic', header: 'Authorization' };
  if (/session|cookie/i.test(joined)) return { type: 'session' };
  return index.authHints.length ? { type: 'jwt', header: 'Authorization' } : null;
}

export function summarizeForLLM(ctx: any, tokenBudget = 1200): string {
  // Simple size-bounded summarizer: truncate strings and arrays
  const json = JSON.stringify(ctx, null, 2);
  if (json.length <= tokenBudget * 4) return json;
  return json.slice(0, tokenBudget * 4) + '\n...truncated...';
}

function snippetAround(text: string, index: number, span = 280): string {
  const start = Math.max(0, index - span);
  const end = Math.min(text.length, index + span);
  return text.slice(start, end);
}



import fs from 'fs';
import path from 'path';
import { Parser } from './parser';
import { ApiStructure, EndpointInfo, ParameterInfo, ResponseInfo, ModelInfo } from '../types';

/**
 * Parser that extracts API information from Express.js applications
 */
export class ExpressParser implements Parser {
  name = 'Express.js Parser';

  /**
   * Check if this parser can handle the given codebase
   */
  async canHandle(rootDir: string): Promise<boolean> {
    const packageJsonPath = path.join(rootDir, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const dependencies = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        return !!dependencies.express;
      } catch (error) {
        return false;
      }
    }

    return false;
  }

  /**
   * Parse Express.js codebase to extract API structure
   */
  async parse(rootDir: string): Promise<ApiStructure> {
    console.log(`Parsing Express.js application in ${rootDir}...`);

    // Find potential entry points
    const entryPoints = await this.findEntryPoints(rootDir);

    if (entryPoints.length === 0) {
      throw new Error('No entry points found for Express.js application');
    }

    // Find router files
    const routerFiles = await this.findRouterFiles(rootDir);

    // Extract routes from entry points and router files
    const endpoints: EndpointInfo[] = [];

    // First, find all API prefixes from entry points
    const apiPrefixes = await this.findApiPrefixes(entryPoints);
    console.log(
      `Found ${apiPrefixes.size} API prefixes: ${Array.from(apiPrefixes).join(', ') || 'none'}`,
    );

    // Then extract routes
    for (const filePath of [...entryPoints, ...routerFiles]) {
      const extractedEndpoints = await this.extractRoutesFromFile(filePath, rootDir, apiPrefixes);
      endpoints.push(...extractedEndpoints);
    }

    // Group endpoints by resource
    console.log(`Extracted ${endpoints.length} endpoints from ${routerFiles.length} router files`);

    // Identify models from route handlers
    const models = await this.extractModels(rootDir, endpoints);

    // Create API structure
    const packageJsonPath = path.join(rootDir, 'package.json');
    let apiName = 'Express API';
    let apiVersion = '1.0.0';

    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        apiName = packageJson.name || apiName;
        apiVersion = packageJson.version || apiVersion;
      } catch (error) {
        // Use defaults
      }
    }

    const apiStructure: ApiStructure = {
      name: apiName,
      version: apiVersion,
      description: `API extracted from Express.js application in ${path.basename(rootDir)}`,
      endpoints,
      models,
    };

    return apiStructure;
  }

  /**
   * Find API prefixes defined in entry point files
   */
  private async findApiPrefixes(entryPoints: string[]): Promise<Set<string>> {
    const apiPrefixes = new Set<string>();

    for (const filePath of entryPoints) {
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');

        // Look for app.use statements with API prefixes
        const apiPrefixRegex = /app\.use\s*\(\s*['"`](\/[^'"`]+)['"`]/g;
        let prefixMatch;

        while ((prefixMatch = apiPrefixRegex.exec(fileContent)) !== null) {
          const prefix = prefixMatch[1];
          // Only add if it's an API prefix (contains 'api' or related words)
          if (prefix.includes('api') || prefix.includes('v1') || prefix.includes('v2')) {
            apiPrefixes.add(prefix);
          }
        }
      } catch (error) {
        console.warn(`Error reading entry point file ${filePath}:`, error);
      }
    }

    return apiPrefixes;
  }

  /**
   * Find potential entry points for Express.js application
   */
  private async findEntryPoints(rootDir: string): Promise<string[]> {
    const potentialEntryPoints = ['index.js', 'app.js', 'server.js', 'main.js'];
    const entryPoints: string[] = [];

    // First check root directory
    for (const fileName of potentialEntryPoints) {
      const filePath = path.join(rootDir, fileName);
      if (fs.existsSync(filePath)) {
        entryPoints.push(filePath);
      }
    }

    // Then check src directory
    const srcDir = path.join(rootDir, 'src');
    if (fs.existsSync(srcDir)) {
      for (const fileName of potentialEntryPoints) {
        const filePath = path.join(srcDir, fileName);
        if (fs.existsSync(filePath)) {
          entryPoints.push(filePath);
        }
      }
    }

    return entryPoints;
  }

  /**
   * Find router files in the Express.js application
   */
  private async findRouterFiles(rootDir: string): Promise<string[]> {
    const routesDir = path.join(rootDir, 'routes');
    const srcRoutesDir = path.join(rootDir, 'src', 'routes');

    const routerFiles: string[] = [];

    // Check routes directory
    if (fs.existsSync(routesDir)) {
      const files = fs
        .readdirSync(routesDir)
        .filter((file) => file.endsWith('.js') || file.endsWith('.ts'))
        .map((file) => path.join(routesDir, file));

      routerFiles.push(...files);
    }

    // Check src/routes directory
    if (fs.existsSync(srcRoutesDir)) {
      const files = fs
        .readdirSync(srcRoutesDir)
        .filter((file) => file.endsWith('.js') || file.endsWith('.ts'))
        .map((file) => path.join(srcRoutesDir, file));

      routerFiles.push(...files);
    }

    // Check for pattern like 'router/users.js' or similar
    const routerDir = path.join(rootDir, 'router');
    if (fs.existsSync(routerDir)) {
      const files = fs
        .readdirSync(routerDir)
        .filter((file) => file.endsWith('.js') || file.endsWith('.ts'))
        .map((file) => path.join(routerDir, file));

      routerFiles.push(...files);
    }

    return routerFiles;
  }

  /**
   * Extract routes from a JavaScript/TypeScript file
   */
  private async extractRoutesFromFile(
    filePath: string,
    rootDir: string,
    apiPrefixes: Set<string>,
  ): Promise<EndpointInfo[]> {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const endpoints: EndpointInfo[] = [];

      // Get the resource name from the file name (e.g., users.js -> users)
      const fileName = path.basename(filePath, path.extname(filePath));
      const resourceName = fileName;

      // Regular expressions to match Express route definitions
      const appRouteRegex =
        /(app|router)\.(get|post|put|delete|patch|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/g;
      const routerRegex = /express\.Router\(\)/g;

      // Find all app.METHOD(...) and router.METHOD(...) calls
      let match;
      while ((match = appRouteRegex.exec(fileContent)) !== null) {
        const [_, routerVar, method, routePath] = match;

        // Get the line where this route is defined
        const lines = fileContent.substring(0, match.index).split('\n');
        const lineNumber = lines.length;

        // Get the route handler (simple version - in real implementation we'd need
        // a proper AST parser for JavaScript)
        const handlerStart = match.index + match[0].length;
        const handlerText = this.extractRouteHandlerText(fileContent.substring(handlerStart));

        // Extract JSDoc comments for documentation
        const jsdoc = this.extractJSDocFromRouteHandler(fileContent, match.index);

        // Extract parameters from route path
        const parameters = this.extractParametersFromPath(routePath, resourceName);

        // Extract potential response codes
        const responses = this.extractResponsesFromHandler(handlerText);

        const relativeFilePath = path.relative(rootDir, filePath);

        // Determine if we should tag this endpoint with a resource
        const tags = [resourceName];

        endpoints.push({
          path: routePath,
          method: method.toLowerCase(),
          summary: jsdoc?.summary || `${method.toUpperCase()} ${routePath}`,
          description:
            jsdoc?.description || `Route handler found in ${relativeFilePath}:${lineNumber}`,
          parameters,
          responses,
          tags,
        });
      }

      // Look for router definitions and base paths
      let routerMatch;
      let routerBasePath = '';

      if ((routerMatch = routerRegex.exec(fileContent)) !== null) {
        // This file creates a router, extract the router's base path from the file

        // Look for module.exports = router to confirm it's a router file
        if (
          fileContent.includes('module.exports = router') ||
          fileContent.includes('export default router') ||
          fileContent.includes('exports.router')
        ) {
          // Check if this is a resource router based on the filename
          routerBasePath = `/${resourceName}`;
        }

        // Also look for explicit router base paths
        const routerBasePathRegex =
          /app\.use\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(?:require\([^)]+\)|[^)]+)\)/g;
        let basePathMatch;

        while ((basePathMatch = routerBasePathRegex.exec(fileContent)) !== null) {
          routerBasePath = basePathMatch[1];
        }
      }

      // Apply API prefixes and router base paths to endpoints
      if (routerBasePath || apiPrefixes.size > 0) {
        endpoints.forEach((endpoint) => {
          // First, adjust for router base path if any
          if (routerBasePath && !endpoint.path.startsWith(routerBasePath)) {
            endpoint.path = this.joinPaths(routerBasePath, endpoint.path);
          }

          // Then check if we need to add an API prefix
          let needsApiPrefix = true;

          // Check if the path already starts with any of the API prefixes
          for (const prefix of apiPrefixes) {
            if (endpoint.path.startsWith(prefix)) {
              needsApiPrefix = false;
              break;
            }
          }

          // Apply the first API prefix if needed and available
          if (needsApiPrefix && apiPrefixes.size > 0) {
            const apiPrefix = Array.from(apiPrefixes)[0]; // Use the first prefix
            endpoint.path = this.joinPaths(apiPrefix, endpoint.path);
          }
        });
      }

      return endpoints;
    } catch (error) {
      console.warn(`Error extracting routes from ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Extract JSDoc comments for a route handler
   */
  private extractJSDocFromRouteHandler(
    fileContent: string,
    handlerPosition: number,
  ): { summary?: string; description?: string } | null {
    // Look for JSDoc comment before the route handler
    const contentBeforeHandler = fileContent.substring(0, handlerPosition);
    const lines = contentBeforeHandler.split('\n');

    let docComment = '';
    let i = lines.length - 1;

    // Skip whitespace and non-comment lines
    while (i >= 0 && !lines[i].trim().startsWith('/**')) {
      i--;
    }

    // If no JSDoc comment found
    if (i < 0 || !lines[i].trim().startsWith('/**')) {
      return null;
    }

    // Found start of JSDoc comment
    const docLines = [];

    // Extract all lines of the comment
    while (i < lines.length && !lines[i].includes('*/')) {
      const line = lines[i]
        .trim()
        .replace(/^\s*\/\*\*\s*/, '') // Remove opening /**
        .replace(/^\s*\*\s*/, ''); // Remove * at start of lines

      docLines.push(line);
      i++;
    }

    // Add the closing line if it exists
    if (i < lines.length) {
      const line = lines[i]
        .trim()
        .replace(/^\s*\*\s*/, '') // Remove * at start
        .replace(/\s*\*\/\s*$/, ''); // Remove closing */

      docLines.push(line);
    }

    // Process the comment to extract metadata
    const docText = docLines.join('\n').trim();

    // Look for @route annotation or similar
    const routeMatch = /@route\s+([^\n]+)/i.exec(docText);
    const descMatch = /@desc(?:ription)?\s+([^\n]+)/i.exec(docText);
    const summaryMatch = /@summary\s+([^\n]+)/i.exec(docText);

    // Extract summary and description
    let summary: string | undefined;
    let description: string | undefined;

    // If we have @summary, use it directly
    if (summaryMatch) {
      summary = summaryMatch[1].trim();
    }

    // If we have @description, use it directly
    if (descMatch) {
      description = descMatch[1].trim();
    }

    // If no specific annotations, use the first line as summary and the rest as description
    if (!summary && !description) {
      const parts = docText.split('\n').filter((p) => p.trim() !== '');
      if (parts.length > 0) {
        summary = parts[0].trim();
        if (parts.length > 1) {
          description = parts.slice(1).join(' ').trim();
        }
      }
    }

    return { summary, description };
  }

  /**
   * Extract route handler text from code starting at the handler position
   */
  private extractRouteHandlerText(text: string): string {
    let openParens = 1; // We start after the first opening parenthesis
    let closeIndex = 0;

    for (let i = 0; i < text.length; i++) {
      if (text[i] === '(') openParens++;
      if (text[i] === ')') openParens--;

      if (openParens === 0) {
        closeIndex = i;
        break;
      }
    }

    return text.substring(0, closeIndex);
  }

  /**
   * Extract parameters from an Express route path
   */
  private extractParametersFromPath(routePath: string, resourceName: string): ParameterInfo[] {
    const parameters: ParameterInfo[] = [];

    // Extract resource name from path
    let pathResource = resourceName;

    // Fallback: Extract resource from path if not provided by filename
    if (!pathResource) {
      const pathParts = routePath.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        pathResource = pathParts[0];
      }
    }

    // Get resource name in singular form (simple approach)
    const singularResource = pathResource.endsWith('s')
      ? pathResource.substring(0, pathResource.length - 1)
      : pathResource;

    // Find path parameters
    const paramRegex = /:([^\/]+)/g;
    let match;

    while ((match = paramRegex.exec(routePath)) !== null) {
      const paramName = match[1];
      let enhancedName = paramName;
      let paramDescription = `The ${paramName} parameter`;

      // If the parameter is named 'id', make it specific to the resource
      if (paramName === 'id') {
        enhancedName = `${singularResource}Id`;
        paramDescription = `Unique identifier of the ${singularResource}`;
      } else if (paramName.endsWith('Id')) {
        // It's already a resource ID, clarify the description
        const paramResource = paramName.substring(0, paramName.length - 2);
        paramDescription = `Unique identifier of the ${paramResource}`;
      }

      parameters.push({
        name: enhancedName,
        location: 'path',
        description: paramDescription,
        required: true,
        schema: {
          type: 'string',
        },
      });
    }

    return parameters;
  }

  /**
   * Extract potential response codes from a route handler
   */
  private extractResponsesFromHandler(handlerText: string): ResponseInfo[] {
    const responses: ResponseInfo[] = [];

    // Match res.status(XXX) patterns
    const statusRegex = /res\.status\((\d+)\)/g;
    let statusMatch;

    const statusDescriptions: { [key: string]: string } = {
      '200': 'Successful operation',
      '201': 'Resource created successfully',
      '204': 'No content, operation successful',
      '400': 'Bad request due to client error',
      '401': 'Authentication required',
      '403': 'Forbidden, insufficient permissions',
      '404': 'Resource not found',
      '500': 'Internal server error',
    };

    const addedStatuses = new Set<string>();

    while ((statusMatch = statusRegex.exec(handlerText)) !== null) {
      const statusCode = statusMatch[1];

      if (!addedStatuses.has(statusCode)) {
        responses.push({
          statusCode,
          description: statusDescriptions[statusCode] || `Status code ${statusCode}`,
        });
        addedStatuses.add(statusCode);
      }
    }

    // If no explicit status codes found, assume 200 OK
    if (responses.length === 0) {
      responses.push({
        statusCode: '200',
        description: 'Successful operation',
      });
    }

    return responses;
  }

  /**
   * Join path segments properly
   */
  private joinPaths(basePath: string, subPath: string): string {
    if (subPath.startsWith('/')) {
      subPath = subPath.substring(1);
    }

    if (basePath.endsWith('/')) {
      return `${basePath}${subPath}`;
    } else {
      return `${basePath}/${subPath}`;
    }
  }

  /**
   * Extract potential data models from the codebase
   */
  private async extractModels(rootDir: string, endpoints: EndpointInfo[]): Promise<ModelInfo[]> {
    // This is a simple implementation; a real-world version would
    // do more sophisticated model extraction
    const models: ModelInfo[] = [];

    // For now, return empty array
    return models;
  }
}

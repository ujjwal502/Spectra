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
          ...packageJson.devDependencies
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
    
    for (const filePath of [...entryPoints, ...routerFiles]) {
      const extractedEndpoints = await this.extractRoutesFromFile(filePath, rootDir);
      endpoints.push(...extractedEndpoints);
    }
    
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
      models
    };
    
    return apiStructure;
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
      const files = fs.readdirSync(routesDir)
        .filter(file => file.endsWith('.js') || file.endsWith('.ts'))
        .map(file => path.join(routesDir, file));
      
      routerFiles.push(...files);
    }
    
    // Check src/routes directory
    if (fs.existsSync(srcRoutesDir)) {
      const files = fs.readdirSync(srcRoutesDir)
        .filter(file => file.endsWith('.js') || file.endsWith('.ts'))
        .map(file => path.join(srcRoutesDir, file));
      
      routerFiles.push(...files);
    }
    
    // Check for pattern like 'router/users.js' or similar
    const routerDir = path.join(rootDir, 'router');
    if (fs.existsSync(routerDir)) {
      const files = fs.readdirSync(routerDir)
        .filter(file => file.endsWith('.js') || file.endsWith('.ts'))
        .map(file => path.join(routerDir, file));
      
      routerFiles.push(...files);
    }
    
    return routerFiles;
  }
  
  /**
   * Extract routes from a JavaScript/TypeScript file
   */
  private async extractRoutesFromFile(filePath: string, rootDir: string): Promise<EndpointInfo[]> {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const endpoints: EndpointInfo[] = [];
      
      // Regular expressions to match Express route definitions
      const appRouteRegex = /(app|router)\.(get|post|put|delete|patch|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/g;
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
        
        // Extract parameters from route path
        const parameters = this.extractParametersFromPath(routePath);
        
        // Extract potential response codes
        const responses = this.extractResponsesFromHandler(handlerText);
        
        const relativeFilePath = path.relative(rootDir, filePath);
        
        endpoints.push({
          path: routePath,
          method: method.toLowerCase(),
          summary: `${method.toUpperCase()} ${routePath}`,
          description: `Route handler found in ${relativeFilePath}:${lineNumber}`,
          parameters,
          responses
        });
      }
      
      // Look for router definitions
      let routerMatch;
      if ((routerMatch = routerRegex.exec(fileContent)) !== null) {
        // This file creates a router, extract the router's base path
        const routerBasePathRegex = /app\.use\s*\(\s*['"`]([^'"`]+)['"`]/g;
        let basePathMatch;
        
        while ((basePathMatch = routerBasePathRegex.exec(fileContent)) !== null) {
          const basePath = basePathMatch[1];
          
          // Adjust each endpoint's path to include the base path
          endpoints.forEach(endpoint => {
            endpoint.path = this.joinPaths(basePath, endpoint.path);
          });
        }
      }
      
      return endpoints;
    } catch (error) {
      console.warn(`Error extracting routes from ${filePath}:`, error);
      return [];
    }
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
  private extractParametersFromPath(routePath: string): ParameterInfo[] {
    const parameters: ParameterInfo[] = [];
    
    // Match :paramName segments
    const paramRegex = /:([a-zA-Z0-9_]+)/g;
    let match;
    
    while ((match = paramRegex.exec(routePath)) !== null) {
      parameters.push({
        name: match[1],
        location: 'path',
        required: true,
        schema: {
          type: 'string'
        }
      });
    }
    
    return parameters;
  }
  
  /**
   * Extract potential response status codes from handler code
   */
  private extractResponsesFromHandler(handlerText: string): ResponseInfo[] {
    const responses: ResponseInfo[] = [];
    
    // Regex to find res.status(XXX) calls
    const statusRegex = /res\.status\s*\(\s*(\d+)\s*\)/g;
    let match;
    
    while ((match = statusRegex.exec(handlerText)) !== null) {
      const statusCode = parseInt(match[1]);
      
      // Default descriptions for common status codes
      let description = 'Response';
      if (statusCode === 200) description = 'OK - Successful operation';
      if (statusCode === 201) description = 'Created - Resource created';
      if (statusCode === 204) description = 'No Content - Successful operation';
      if (statusCode === 400) description = 'Bad Request - Validation error';
      if (statusCode === 401) description = 'Unauthorized - Authentication required';
      if (statusCode === 403) description = 'Forbidden - Insufficient permissions';
      if (statusCode === 404) description = 'Not Found - Resource not found';
      if (statusCode === 500) description = 'Internal Server Error';
      
      responses.push({
        statusCode,
        description
      });
    }
    
    // If no explicit status codes, assume 200
    if (responses.length === 0) {
      responses.push({
        statusCode: 200,
        description: 'OK - Successful operation'
      });
    }
    
    return responses;
  }
  
  /**
   * Join two path segments correctly
   */
  private joinPaths(basePath: string, subPath: string): string {
    basePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
    subPath = subPath.startsWith('/') ? subPath : '/' + subPath;
    return basePath + subPath;
  }
  
  /**
   * Extract potential data models from endpoints and codebase
   */
  private async extractModels(rootDir: string, endpoints: EndpointInfo[]): Promise<ModelInfo[]> {
    // Look for model definitions in common locations
    const models: ModelInfo[] = [];
    const modelDirs = [
      path.join(rootDir, 'models'),
      path.join(rootDir, 'src', 'models'),
      path.join(rootDir, 'src', 'db', 'models')
    ];
    
    for (const modelDir of modelDirs) {
      if (fs.existsSync(modelDir)) {
        const files = fs.readdirSync(modelDir)
          .filter(file => file.endsWith('.js') || file.endsWith('.ts'));
        
        for (const file of files) {
          const modelFilePath = path.join(modelDir, file);
          
          try {
            const fileContent = fs.readFileSync(modelFilePath, 'utf8');
            const modelName = path.basename(file, path.extname(file));
            
            // Very basic model extraction - in a real implementation we'd need
            // proper AST parsing to identify properties
            const schemaRegex = /(?:schema|Schema)\s*=\s*{([^}]+)}/s;
            const schemaMatch = schemaRegex.exec(fileContent);
            
            if (schemaMatch) {
              const schemaText = schemaMatch[1];
              
              // Extract properties from schema
              const propertyRegex = /\s*([a-zA-Z0-9_]+)\s*:\s*{([^}]+)}/g;
              let propertyMatch;
              const properties = [];
              
              while ((propertyMatch = propertyRegex.exec(schemaText)) !== null) {
                const propName = propertyMatch[1];
                const propSchema = propertyMatch[2];
                
                // Try to determine type
                let type = 'string';
                if (propSchema.includes('type: String')) type = 'string';
                if (propSchema.includes('type: Number')) type = 'number';
                if (propSchema.includes('type: Boolean')) type = 'boolean';
                if (propSchema.includes('type: Date')) type = 'string';
                if (propSchema.includes('type: ObjectId')) type = 'string';
                
                // Check if required
                const required = propSchema.includes('required: true');
                
                properties.push({
                  name: propName,
                  type,
                  required
                });
              }
              
              if (properties.length > 0) {
                const relativeModelPath = path.relative(rootDir, modelFilePath);
                models.push({
                  name: modelName,
                  description: `Model extracted from ${relativeModelPath}`,
                  properties
                });
              }
            }
          } catch (error) {
            console.warn(`Error extracting model from ${modelFilePath}:`, error);
          }
        }
      }
    }
    
    return models;
  }
} 
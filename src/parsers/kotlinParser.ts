import fs from 'fs';
import path from 'path';
import * as glob from 'glob';
import { ApiStructure, EndpointInfo, ParameterInfo, ResponseInfo, ModelInfo, PropertyInfo } from '../types';

/**
 * Parser for Kotlin-based APIs
 * Focuses on Spring Boot and similar frameworks
 */
export class KotlinParser {
  name = 'Kotlin Parser';

  /**
   * Parse the codebase and extract API information from Kotlin files
   * 
   * @param rootDir Root directory of the codebase
   * @returns Structured API information
   */
  async parse(rootDir: string): Promise<ApiStructure> {
    console.log('Parsing Kotlin files for API endpoints...');

    // Find all Kotlin files in the project
    const kotlinFiles = this.findKotlinFiles(rootDir);
    console.log(`Found ${kotlinFiles.length} Kotlin files`);

    if (kotlinFiles.length === 0) {
      throw new Error('No Kotlin files found in the project');
    }

    // Find controller files - these typically define API endpoints
    const controllerFiles = this.filterControllerFiles(kotlinFiles);
    console.log(`Found ${controllerFiles.length} potential controller files`);

    // Parse controller files to extract API info
    const apiInfo = await this.parseControllerFiles(controllerFiles);

    // Extract data models from all Kotlin files
    const models = await this.extractDataModels(kotlinFiles);
    console.log(`Found ${models.length} data models`);

    // Look for application.properties or application.yml to find base path
    const basePath = await this.findBasePath(rootDir);

    // Create API structure
    const apiStructure: ApiStructure = {
      name: this.determineApiName(rootDir, controllerFiles),
      description: 'API extracted from Kotlin codebase',
      version: '1.0.0', // Default version, would be better to extract from build files
      basePath: basePath,
      endpoints: apiInfo.endpoints,
      models: models
    };

    return apiStructure;
  }

  /**
   * Find all Kotlin files in the codebase
   * 
   * @param rootDir Root directory of the codebase
   * @returns Array of paths to Kotlin files
   */
  private findKotlinFiles(rootDir: string): string[] {
    const pattern = path.join(rootDir, '**', '*.kt');
    const options = { nocase: true, ignore: ['**/build/**', '**/target/**', '**/test/**'] };
    return glob.sync(pattern, options);
  }

  /**
   * Filter files to find likely controller files
   * 
   * @param allFiles All Kotlin files in the codebase
   * @returns Array of controller file paths
   */
  private filterControllerFiles(allFiles: string[]): string[] {
    return allFiles.filter(file => {
      // Read file content
      try {
        const content = fs.readFileSync(file, 'utf-8');
        
        // Check if file has controller annotations or naming
        const hasControllerAnnotations = (
          content.includes('@RestController') ||
          content.includes('@Controller') ||
          content.includes('@RequestMapping') ||
          content.includes('@GetMapping') ||
          content.includes('@PostMapping') ||
          content.includes('@PutMapping') ||
          content.includes('@DeleteMapping') ||
          path.basename(file).toLowerCase().includes('controller')
        );

        // Also check for Spring components that might serve as message handlers or service endpoints
        const hasComponentAnnotations = (
          content.includes('@Component') ||
          content.includes('@Service') ||
          content.includes('ProcessMessage') || // Custom message processor interface
          content.includes('process(message:') || // process method signature
          content.includes('@EnableJms') || // JMS integration
          content.includes('WebClientService') || // Web client for outgoing requests
          content.includes('HttpMethod') || // HTTP method usage
          content.includes('@Autowired')
        );
        
        return hasControllerAnnotations || hasComponentAnnotations;
      } catch (error) {
        console.warn(`Error reading file ${file}:`, error);
        return false;
      }
    });
  }

  /**
   * Parse controller files to extract API information
   * 
   * @param controllerFiles Array of controller file paths
   * @returns API info containing endpoints and models
   */
  private async parseControllerFiles(controllerFiles: string[]): Promise<{ 
    endpoints: EndpointInfo[],
    models: any[]
  }> {
    const endpoints: EndpointInfo[] = [];
    const models: any[] = [];
    
    for (const file of controllerFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        
        // Extract class-level path
        const classPath = this.extractClassRequestMapping(lines);
        
        // Extract endpoints from method-level annotations
        const fileEndpoints = this.extractEndpoints(lines, classPath, file);
        endpoints.push(...fileEndpoints);
      } catch (error) {
        console.warn(`Error parsing controller file ${file}:`, error);
      }
    }
    
    return { endpoints, models };
  }

  /**
   * Extract class-level RequestMapping annotation
   * 
   * @param lines File content lines
   * @returns Base path from class-level annotation
   */
  private extractClassRequestMapping(lines: string[]): string {
    for (const line of lines) {
      if (line.includes('@RequestMapping')) {
        // Extract path from annotation, handling different formats
        const pathMatch = line.match(/value\s*=\s*["']([^"']+)["']/) || 
                          line.match(/path\s*=\s*["']([^"']+)["']/) ||
                          line.match(/@RequestMapping\s*\(["']([^"']+)["']/);
        
        if (pathMatch && pathMatch[1]) {
          return pathMatch[1];
        }
      }
    }
    
    return '';
  }

  /**
   * Extract endpoints from method-level annotations
   * 
   * @param lines File content lines
   * @param classPath Base path from class-level annotation
   * @param filePath Source file path for reference
   * @returns Array of endpoints
   */
  private extractEndpoints(lines: string[], classPath: string, filePath: string): EndpointInfo[] {
    const endpoints: EndpointInfo[] = [];
    const content = lines.join('\n');
    const fileName = path.basename(filePath);
    const className = fileName.replace('.kt', '');
    
    // Check for standard REST controller endpoints
    this.extractRestEndpoints(lines, classPath, endpoints);
    
    // Check for message processor components
    if (content.includes('ProcessMessage') || content.includes('process(message:')) {
      // This appears to be a message processor component
      const componentName = className.replace('Component', '').replace('Service', '');
      
      // Extract HTTP methods from the file content
      let method = 'post'; // Default for message processors which usually process/transform data
      
      if (content.includes('HttpMethod.GET')) method = 'get';
      else if (content.includes('HttpMethod.POST')) method = 'post';
      else if (content.includes('HttpMethod.PUT')) method = 'put';
      else if (content.includes('HttpMethod.DELETE')) method = 'delete';
      else if (content.includes('HttpMethod.PATCH')) method = 'patch';
      
      // Try to extract endpoint path from environment properties
      let path = '/process';
      const pathMatches = content.match(/path\s*=\s*[^"]*"([^"]+)"/g);
      
      if (pathMatches && pathMatches.length > 0) {
        const cleanPath = pathMatches[0].replace(/path\s*=\s*[^"]*"([^"]+)"/, '$1');
        if (cleanPath) {
          path = cleanPath;
        }
      }
      
      // Create endpoint for message processor
      const endpoint: EndpointInfo = {
        path: path,
        method,
        summary: `${componentName} processor endpoint`,
        description: `Message processor component that ${method === 'get' ? 'retrieves' : 'processes'} data through the ${componentName} service`,
        parameters: [],
        responses: this.generateDefaultResponses()
      };
      
      endpoints.push(endpoint);
      
      // If there are WebClient calls, add those too
      if (content.includes('webClientService') || content.includes('WebClientService')) {
        this.extractWebClientEndpoints(content, endpoints, componentName);
      }
    }
    
    return endpoints;
  }
  
  /**
   * Extract standard REST endpoints with annotations
   * 
   * @param lines File content lines
   * @param classPath Base path from class-level annotation
   * @param endpoints Array to add extracted endpoints to
   */
  private extractRestEndpoints(lines: string[], classPath: string, endpoints: EndpointInfo[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for mapping annotations
      if (line.includes('@GetMapping') || 
          line.includes('@PostMapping') || 
          line.includes('@PutMapping') || 
          line.includes('@DeleteMapping') ||
          line.includes('@PatchMapping') ||
          (line.includes('@RequestMapping') && i > 0 && lines[i-1].includes('fun '))) {
        
        // Determine HTTP method
        let method = 'get'; // Default
        if (line.includes('@PostMapping')) method = 'post';
        else if (line.includes('@PutMapping')) method = 'put';
        else if (line.includes('@DeleteMapping')) method = 'delete';
        else if (line.includes('@PatchMapping')) method = 'patch';
        else if (line.includes('@RequestMapping')) {
          // Extract method from RequestMapping
          const methodMatch = line.match(/method\s*=\s*(?:RequestMethod\.)?([A-Z]+)/i);
          if (methodMatch && methodMatch[1]) {
            method = methodMatch[1].toLowerCase();
          }
        }
        
        // Extract path from annotation
        let path = '';
        const pathMatch = line.match(/value\s*=\s*["']([^"']+)["']/) || 
                         line.match(/path\s*=\s*["']([^"']+)["']/) ||
                         line.match(/@(?:Get|Post|Put|Delete|Patch|Request)Mapping\s*\(["']([^"']+)["']/);
        
        if (pathMatch && pathMatch[1]) {
          path = pathMatch[1];
        }
        
        // Combine with class-level path
        const fullPath = classPath ? 
          (path ? `${classPath}${path.startsWith('/') ? path : '/' + path}` : classPath) :
          path;
        
        // Get method name (for summary/description)
        const nextLine = i < lines.length - 1 ? lines[i + 1] : '';
        const methodNameMatch = nextLine.match(/fun\s+([a-zA-Z0-9_]+)/);
        const methodName = methodNameMatch ? methodNameMatch[1] : 'unknownMethod';
        
        // Create endpoint
        const endpoint: EndpointInfo = {
          path: fullPath || '/',
          method,
          summary: `${methodName} endpoint`,
          description: `API endpoint for ${method.toUpperCase()} ${fullPath || '/'}`,
          parameters: this.extractParameters(lines, i),
          responses: this.generateDefaultResponses()
        };
        
        endpoints.push(endpoint);
      }
    }
  }
  
  /**
   * Extract endpoints from WebClient calls
   * 
   * @param content File content
   * @param endpoints Array to add extracted endpoints to
   * @param componentName Name of the component
   */
  private extractWebClientEndpoints(content: string, endpoints: EndpointInfo[], componentName: string): void {
    // Find all WebClient paths
    const pathMatches = content.match(/\.path\(([^)]+)\)/g);
    if (!pathMatches) return;
    
    for (const pathMatch of pathMatches) {
      // Extract path from match
      let path = '/api';
      const extractedPath = pathMatch.match(/path\(([^)]+)\)/);
      if (extractedPath && extractedPath[1]) {
        path = extractedPath[1].replace(/['"]/g, '').trim();
        
        // If it's a variable, try to find its value
        if (path.includes('!!')) {
          // Look for property references in the content
          const propMatches = content.match(/getProperty\("([^"]+)"\)/g);
          if (propMatches && propMatches.length > 0) {
            // Use the first property reference as a placeholder
            const prop = propMatches[0].match(/getProperty\("([^"]+)"\)/);
            if (prop && prop[1]) {
              path = `/${prop[1].split('.').pop()}`; // Use last part of property as endpoint
            }
          }
        }
      }
      
      // Determine HTTP method
      let method = 'get'; // Default
      if (content.includes('HttpMethod.POST')) method = 'post';
      else if (content.includes('HttpMethod.PUT')) method = 'put';
      else if (content.includes('HttpMethod.DELETE')) method = 'delete';
      else if (content.includes('HttpMethod.PATCH')) method = 'patch';
      else if (content.includes('HttpMethod.GET')) method = 'get';
      
      // Create endpoint for WebClient call
      const endpoint: EndpointInfo = {
        path: path,
        method,
        summary: `${componentName} Web Client ${method} endpoint`,
        description: `Web client ${method.toUpperCase()} request to external service at ${path}`,
        parameters: [],
        responses: this.generateDefaultResponses()
      };
      
      endpoints.push(endpoint);
    }
  }

  /**
   * Extract parameters from method
   * 
   * @param lines File content lines
   * @param mappingLineIndex Index of the mapping annotation line
   * @returns Array of parameters
   */
  private extractParameters(lines: string[], mappingLineIndex: number): ParameterInfo[] {
    const parameters: ParameterInfo[] = [];
    
    // Look for the method signature line (should be right after the mapping annotation)
    const methodLine = lines[mappingLineIndex + 1] || '';
    
    // Parse method parameters
    const paramsMatch = methodLine.match(/fun\s+[a-zA-Z0-9_]+\s*\((.*?)\)/);
    if (paramsMatch && paramsMatch[1]) {
      const paramsString = paramsMatch[1];
      const paramsList = paramsString.split(',').map(p => p.trim()).filter(p => p);
      
      for (const param of paramsList) {
        let paramType: 'path' | 'query' | 'header' | 'cookie' = 'query'; // Default
        let required = false;
        
        // Try to determine parameter type from annotations
        if (param.includes('@PathVariable')) {
          paramType = 'path';
          required = !param.includes('required = false');
        } else if (param.includes('@RequestParam')) {
          paramType = 'query';
          required = !param.includes('required = false');
        } else if (param.includes('@RequestHeader')) {
          paramType = 'header';
          required = !param.includes('required = false');
        } else if (param.includes('@CookieValue')) {
          paramType = 'cookie';
          required = !param.includes('required = false');
        } else if (param.includes('@RequestBody')) {
          // This isn't a parameter but a request body - would need special handling
          continue;
        }
        
        // Extract parameter name
        const nameMatch = param.match(/\b([a-zA-Z0-9_]+)(?::\s*[a-zA-Z0-9_<>.?]+)?$/);
        if (nameMatch) {
          parameters.push({
            name: nameMatch[1],
            location: paramType,
            required,
            description: `Parameter extracted from Kotlin code`
          });
        }
      }
    }
    
    return parameters;
  }

  /**
   * Generate default responses for endpoints
   * 
   * @returns Array of default responses
   */
  private generateDefaultResponses(): ResponseInfo[] {
    return [
      {
        statusCode: 200,
        description: 'Successful operation',
        contentType: 'application/json'
      },
      {
        statusCode: 400,
        description: 'Bad request',
        contentType: 'application/json' 
      },
      {
        statusCode: 500,
        description: 'Internal server error',
        contentType: 'application/json'
      }
    ];
  }

  /**
   * Find base path from application properties
   * 
   * @param rootDir Root directory of the codebase
   * @returns Base path from configuration
   */
  private async findBasePath(rootDir: string): Promise<string> {
    // Look for common Spring Boot config files
    const configFiles = [
      path.join(rootDir, 'src', 'main', 'resources', 'application.properties'),
      path.join(rootDir, 'src', 'main', 'resources', 'application.yml'),
      path.join(rootDir, 'src', 'main', 'resources', 'application.yaml')
    ];
    
    for (const configFile of configFiles) {
      if (fs.existsSync(configFile)) {
        const content = fs.readFileSync(configFile, 'utf-8');
        
        // Check for common server.servlet.context-path property
        if (configFile.endsWith('.properties')) {
          const contextPathMatch = content.match(/server\.servlet\.context-path\s*=\s*([^\n\r]+)/);
          if (contextPathMatch && contextPathMatch[1]) {
            return contextPathMatch[1].trim();
          }
        } else if (configFile.endsWith('.yml') || configFile.endsWith('.yaml')) {
          // Very basic YAML parsing - in a real implementation, use a proper YAML parser
          const serverSection = content.split('server:')[1];
          if (serverSection) {
            const servletSection = serverSection.split('servlet:')[1];
            if (servletSection) {
              const contextPathMatch = servletSection.match(/context-path:\s*([^\n\r]+)/);
              if (contextPathMatch && contextPathMatch[1]) {
                return contextPathMatch[1].trim();
              }
            }
          }
        }
      }
    }
    
    return ''; // Default empty base path
  }

  /**
   * Determine API name from codebase
   * 
   * @param rootDir Root directory
   * @param controllerFiles Controller files
   * @returns API name
   */
  private determineApiName(rootDir: string, controllerFiles: string[]): string {
    // Try to extract from package name in controller files
    for (const file of controllerFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const packageMatch = content.match(/package\s+([a-zA-Z0-9_.]+)/);
        if (packageMatch && packageMatch[1]) {
          const parts = packageMatch[1].split('.');
          // Use the last 2-3 parts of the package name
          if (parts.length >= 2) {
            return parts.slice(-2).join('-');
          }
        }
      } catch (error) {
        // Ignore errors
      }
    }
    
    // Fallback to directory name
    return path.basename(rootDir);
  }

  /**
   * Extract data models from Kotlin files
   * 
   * @param kotlinFiles Array of paths to Kotlin files
   * @returns Array of model information
   */
  private async extractDataModels(kotlinFiles: string[]): Promise<ModelInfo[]> {
    const models: ModelInfo[] = [];
    
    for (const file of kotlinFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        
        // Look for data class definitions
        this.extractDataClasses(lines, file, models);
        
        // Look for regular classes that might be models
        this.extractRegularClasses(lines, file, models);
        
        // Look for enum classes
        this.extractEnumClasses(lines, file, models);
      } catch (error) {
        console.warn(`Error extracting models from ${file}:`, error);
      }
    }
    
    return models;
  }
  
  /**
   * Extract data classes from file content
   * 
   * @param lines File content lines
   * @param filePath Source file path for reference
   * @param models Array to add models to
   */
  private extractDataClasses(lines: string[], filePath: string, models: ModelInfo[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Match data class definition
      const dataClassMatch = line.match(/data\s+class\s+([A-Za-z0-9_]+)\s*(\(|{)/);
      if (dataClassMatch) {
        const className = dataClassMatch[1];
        const properties: PropertyInfo[] = [];
        
        // Check if data class has constructor parameters (most common)
        if (dataClassMatch[2] === '(') {
          // Find the closing parenthesis for the constructor
          let constructorContent = "";
          let openParens = 1;
          let j = i;
          
          while (openParens > 0 && j < lines.length) {
            const currentLine = lines[j].trim();
            for (let k = 0; k < currentLine.length; k++) {
              if (currentLine[k] === '(') openParens++;
              if (currentLine[k] === ')') openParens--;
            }
            constructorContent += currentLine + " ";
            j++;
          }
          
          // Extract properties from constructor parameters
          const propsMatch = constructorContent.match(/\((.*?)\)/s);
          if (propsMatch && propsMatch[1]) {
            const propsContent = propsMatch[1];
            const propLines = propsContent.split(',').map(p => p.trim()).filter(p => p);
            
            for (const propLine of propLines) {
              const propMatch = propLine.match(/(?:val|var)?\s*([a-zA-Z0-9_]+)\s*:\s*([^=,)]+)(?:=.*)?/);
              if (propMatch) {
                const propName = propMatch[1];
                const propType = propMatch[2].trim();
                
                properties.push({
                  name: propName,
                  type: this.mapKotlinTypeToJsonType(propType),
                  description: `${propName} property of ${className}`,
                  required: !propLine.includes('?') && !propLine.includes('= null')
                });
              }
            }
          }
        } else {
          // For data classes with body, look for properties in the class body
          let j = i + 1;
          let braceCount = 1;
          
          while (j < lines.length && braceCount > 0) {
            const currentLine = lines[j].trim();
            
            // Count braces to find end of class body
            for (const char of currentLine) {
              if (char === '{') braceCount++;
              if (char === '}') braceCount--;
            }
            
            // Look for property definitions
            const propMatch = currentLine.match(/(?:val|var)\s+([a-zA-Z0-9_]+)\s*:\s*([^=]+)(?:=.*)?/);
            if (propMatch) {
              const propName = propMatch[1];
              const propType = propMatch[2].trim();
              
              properties.push({
                name: propName,
                type: this.mapKotlinTypeToJsonType(propType),
                description: `${propName} property of ${className}`,
                required: !currentLine.includes('?') && !currentLine.includes('= null')
              });
            }
            
            j++;
          }
        }
        
        // Add model to the list
        if (properties.length > 0) {
          models.push({
            name: className,
            description: `Data model for ${className}`,
            properties: properties
          });
        }
      }
    }
  }
  
  /**
   * Extract regular classes that might be used as models
   * 
   * @param lines File content lines
   * @param filePath Source file path for reference
   * @param models Array to add models to
   */
  private extractRegularClasses(lines: string[], filePath: string, models: ModelInfo[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Match regular class definition (but not interface, abstract, or companion)
      if (line.match(/^class\s+([A-Za-z0-9_]+)/) && 
          !line.includes('abstract') && 
          !line.includes('interface') && 
          !line.includes('companion')) {
        
        const classMatch = line.match(/class\s+([A-Za-z0-9_]+)/);
        if (!classMatch) continue;
        
        const className = classMatch[1];
        
        // Skip classes that look like controllers or services
        if (className.endsWith('Controller') || 
            className.endsWith('Service') || 
            className.endsWith('Repository') ||
            className.endsWith('Component')) {
          continue;
        }
        
        const properties: PropertyInfo[] = [];
        
        // Find class body
        let j = i + 1;
        let openBraces = line.split('{').length - 1;
        let closeBraces = line.split('}').length - 1;
        let braceCount = openBraces - closeBraces;
        
        if (braceCount <= 0) continue; // No class body found
        
        // Parse the class body to find properties
        while (j < lines.length && braceCount > 0) {
          const currentLine = lines[j].trim();
          
          // Count braces to find end of class body
          openBraces = currentLine.split('{').length - 1;
          closeBraces = currentLine.split('}').length - 1;
          braceCount += openBraces - closeBraces;
          
          // Look for property definitions
          if (currentLine.match(/(?:val|var)\s+[a-zA-Z0-9_]+\s*:/)) {
            const propMatch = currentLine.match(/(?:val|var)\s+([a-zA-Z0-9_]+)\s*:\s*([^=]+)(?:=.*)?/);
            if (propMatch) {
              const propName = propMatch[1];
              const propType = propMatch[2].trim();
              
              properties.push({
                name: propName,
                type: this.mapKotlinTypeToJsonType(propType),
                description: `${propName} property of ${className}`,
                required: !currentLine.includes('?') && !currentLine.includes('= null')
              });
            }
          }
          
          // Look for getters/setters that might indicate properties
          const getterMatch = currentLine.match(/fun\s+get([A-Z][a-zA-Z0-9_]*)\(\)/);
          if (getterMatch) {
            const propName = getterMatch[1].charAt(0).toLowerCase() + getterMatch[1].slice(1);
            
            // Check if property already exists
            if (!properties.some(p => p.name === propName)) {
              // Try to find return type
              let returnType = 'any';
              if (currentLine.includes('->')) {
                const typeMatch = currentLine.match(/->\s*([^{]+)/);
                if (typeMatch) {
                  returnType = this.mapKotlinTypeToJsonType(typeMatch[1].trim());
                }
              }
              
              properties.push({
                name: propName,
                type: returnType,
                description: `${propName} property of ${className}`,
                required: false
              });
            }
          }
          
          j++;
        }
        
        // Only add non-empty models to the list
        if (properties.length > 0) {
          models.push({
            name: className,
            description: `Data model for ${className}`,
            properties: properties
          });
        }
      }
    }
  }
  
  /**
   * Extract enum classes
   * 
   * @param lines File content lines
   * @param filePath Source file path for reference
   * @param models Array to add models to
   */
  private extractEnumClasses(lines: string[], filePath: string, models: ModelInfo[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Match enum class definition
      const enumMatch = line.match(/enum\s+class\s+([A-Za-z0-9_]+)/);
      if (enumMatch) {
        const enumName = enumMatch[1];
        const properties: PropertyInfo[] = [];
        
        // Add a single property to represent the enum values
        properties.push({
          name: 'value',
          type: 'string',
          description: `One of the enum values for ${enumName}`,
          required: true
        });
        
        // Find enum values
        let enumValues: string[] = [];
        let j = i;
        let openBraces = 0;
        let foundOpenBrace = false;
        
        // Find opening brace
        while (j < lines.length && !foundOpenBrace) {
          if (lines[j].includes('{')) {
            foundOpenBrace = true;
            openBraces = lines[j].split('{').length - lines[j].split('}').length;
          }
          j++;
        }
        
        if (!foundOpenBrace) continue;
        
        // Parse the enum body to find values
        let enumBody = '';
        while (j < lines.length && openBraces > 0) {
          const currentLine = lines[j].trim();
          enumBody += ' ' + currentLine;
          
          // Count braces to find end of enum
          openBraces += currentLine.split('{').length - currentLine.split('}').length;
          j++;
        }
        
        // Extract enum values
        const valuesMatch = enumBody.match(/{([^}]+)}/);
        if (valuesMatch) {
          const valuesText = valuesMatch[1].trim();
          enumValues = valuesText.split(',').map(v => v.trim()).filter(v => v && !v.includes('('));
          
          // Extract just the enum value names
          enumValues = enumValues.map(v => {
            // Remove everything after first non-alphanumeric char (except underscore)
            const nameMatch = v.match(/^([A-Za-z0-9_]+)/);
            return nameMatch ? nameMatch[1] : v;
          });
        }
        
        // Add model to the list
        models.push({
          name: enumName,
          description: `Enum class for ${enumName}`,
          properties: properties
        });
      }
    }
  }
  
  /**
   * Map Kotlin types to JSON schema types
   * 
   * @param kotlinType Kotlin type name
   * @returns JSON schema type
   */
  private mapKotlinTypeToJsonType(kotlinType: string): string {
    // Remove nullable marker and whitespace
    const cleanType = kotlinType.replace('?', '').trim();
    
    // Map common Kotlin types to JSON schema types
    if (cleanType.startsWith('Int') || cleanType.startsWith('Long') || cleanType.startsWith('Double') || 
        cleanType.startsWith('Float') || cleanType.startsWith('Short') || cleanType.startsWith('Byte') ||
        cleanType.startsWith('Number')) {
      return 'number';
    } else if (cleanType.startsWith('String') || cleanType.startsWith('Char')) {
      return 'string';
    } else if (cleanType.startsWith('Boolean')) {
      return 'boolean';
    } else if (cleanType.startsWith('List<') || cleanType.startsWith('Array<') || 
              cleanType.startsWith('Set<') || cleanType.startsWith('Collection<')) {
      return 'array';
    } else if (cleanType.startsWith('Map<') || cleanType.startsWith('HashMap<') ||
              cleanType.startsWith('MutableMap<')) {
      return 'object';
    } else if (cleanType.startsWith('Any')) {
      return 'any';
    } else if (cleanType.startsWith('Unit') || cleanType.startsWith('Nothing')) {
      return 'null';
    }
    
    // For custom types, use 'object'
    return 'object';
  }
} 
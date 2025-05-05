import fs from 'fs';
import path from 'path';
import * as glob from 'glob';
import { ApiStructure, EndpointInfo, ModelInfo, ParameterInfo, ResponseInfo } from '../types';

/**
 * Parser for RAML API specification files
 */
export class RamlParser {
  name = 'RAML Parser';

  /**
   * Parse the codebase and extract API info from RAML files
   * 
   * @param rootDir Root directory of the codebase
   * @returns Structured API information
   */
  async parse(rootDir: string): Promise<ApiStructure> {
    console.log('Parsing RAML files...');

    // Find all RAML files in the project
    const ramlFiles = this.findRamlFiles(rootDir);
    console.log(`Found ${ramlFiles.length} RAML files`);

    if (ramlFiles.length === 0) {
      throw new Error('No RAML files found in the project');
    }

    // Use the first RAML file found (assuming it's the main one)
    // In the future, we could add logic to find the entry point RAML file more intelligently
    const mainRamlFile = ramlFiles[0];
    console.log(`Using ${mainRamlFile} as the main RAML file`);

    // Parse the RAML file content
    const ramlContent = await this.parseRamlFile(mainRamlFile);

    // Convert RAML to ApiStructure
    const apiStructure = this.convertRamlToApiStructure(ramlContent, path.dirname(mainRamlFile));

    // Look for schema files referenced in the RAML
    const schemaFiles = this.findSchemaFiles(rootDir);
    if (schemaFiles.length > 0) {
      console.log(`Found ${schemaFiles.length} potential schema files`);
      
      // Extract models from schema files
      const models = await this.extractModelsFromSchemaFiles(schemaFiles);
      apiStructure.models = [...apiStructure.models, ...models];
    }

    return apiStructure;
  }

  /**
   * Find all RAML files in the codebase
   * 
   * @param rootDir Root directory of the codebase
   * @returns Array of paths to RAML files
   */
  private findRamlFiles(rootDir: string): string[] {
    const pattern = path.join(rootDir, '**', '*.raml');
    const options = { nocase: true, ignore: ['**/node_modules/**', '**/dist/**'] };
    return glob.sync(pattern, options);
  }

  /**
   * Find potential schema files in the codebase
   * 
   * @param rootDir Root directory of the codebase
   * @returns Array of paths to schema files
   */
  private findSchemaFiles(rootDir: string): string[] {
    // Look for JSON schema files, XSD files, or other schema-like files
    const schemaPatterns = [
      path.join(rootDir, '**', '*.json'),
      path.join(rootDir, '**', '*.schema.json'),
      path.join(rootDir, '**', '*.xsd'),
      path.join(rootDir, '**', 'schemas', '**', '*.*')
    ];
    
    const options = { nocase: true, ignore: ['**/node_modules/**', '**/dist/**', '**/package.json', '**/package-lock.json'] };
    
    // Combine results from all patterns
    let schemaFiles: string[] = [];
    schemaPatterns.forEach(pattern => {
      schemaFiles = [...schemaFiles, ...glob.sync(pattern, options)];
    });
    
    return schemaFiles;
  }

  /**
   * Parse RAML file content
   * 
   * @param filePath Path to RAML file
   * @returns Parsed RAML content as JavaScript object
   */
  private async parseRamlFile(filePath: string): Promise<any> {
    try {
      // Read the RAML file content
      const content = fs.readFileSync(filePath, 'utf-8');

      // Since RAML parsing is complex and requires external libraries,
      // we'll use a simplified approach for now.
      // In a production environment, use raml-1-parser or similar libraries

      // Basic parsing for RAML 0.8 format
      const lines = content.split('\n');
      const ramlObj: any = {
        paths: {},
        schemas: {},
        traits: {},
        resourceTypes: {},
        securitySchemes: {}
      };

      // Parse hierarchical structure using indentation
      this.parseRamlStructure(lines, ramlObj);

      return ramlObj;
    } catch (error) {
      console.error(`Error parsing RAML file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Parse RAML file structure using indentation to determine hierarchy
   * 
   * @param lines RAML file content as array of lines
   * @param ramlObj Object to populate with RAML data
   */
  private parseRamlStructure(lines: string[], ramlObj: any): void {
    let currentBlock: string[] = [];
    let currentPath = '';
    let currentMethod = '';
    let indentStack: { indent: number, key: string }[] = [];
    let lineIndex = 0;

    // First pass to extract basic metadata
    while (lineIndex < lines.length) {
      const line = lines[lineIndex];
      const trimmedLine = line.trim();
      
      // Skip comments and empty lines
      if (trimmedLine.startsWith('#') || trimmedLine === '') {
        lineIndex++;
        continue;
      }

      // Extract RAML version
      if (trimmedLine.startsWith('#%RAML')) {
        const parts = trimmedLine.split(' ');
        if (parts.length >= 2) {
          ramlObj.ramlVersion = parts[1];
        }
        lineIndex++;
        continue;
      }

      // Extract simple key-value pairs at root level
      if (trimmedLine.includes(':')) {
        const colonIndex = trimmedLine.indexOf(':');
        const key = trimmedLine.substring(0, colonIndex).trim();
        const valueStr = trimmedLine.substring(colonIndex + 1).trim();
        
        if (key && key !== '') {
          // Handle multi-line values
          if (valueStr === '|' || valueStr === '>') {
            // Capture multi-line description
            let multiLineValue = '';
            let nextLineIndex = lineIndex + 1;
            
            while (nextLineIndex < lines.length) {
              const nextLine = lines[nextLineIndex];
              // Check if the next line has more indentation
              if (nextLine.search(/\S/) > line.search(/\S/)) {
                multiLineValue += nextLine.trim() + '\n';
                nextLineIndex++;
              } else {
                break;
              }
            }
            
            // Only assign non-empty values
            if (multiLineValue.trim() !== '') {
              ramlObj[key] = multiLineValue.trim();
            }
            
            lineIndex = nextLineIndex;
            continue;
          } else if (valueStr !== '') {
            // Regular single line value
            ramlObj[key] = valueStr.replace(/^["']|["']$/g, ''); // Remove quotes if present
          }
        }
      }
      
      // Process resource (paths starting with /)
      if (trimmedLine.startsWith('/') && trimmedLine.includes(':')) {
        const colonIndex = trimmedLine.indexOf(':');
        const path = trimmedLine.substring(0, colonIndex).trim();
        
        // Initialize path in the RAML object
        if (!ramlObj.paths[path]) {
          ramlObj.paths[path] = {};
        }
        
        // Set current path for resource-level properties
        currentPath = path;
        
        // Skip to the next line
        lineIndex++;
        
        // Process resource-level properties and methods
        this.processResourceProperties(lines, lineIndex, ramlObj.paths[path]);
        
        // Skip processed lines
        while (lineIndex < lines.length && 
              (lines[lineIndex].trim() === '' || 
               lines[lineIndex].trim().startsWith('#') || 
               lines[lineIndex].search(/\S/) > trimmedLine.search(/\S/))) {
          lineIndex++;
        }
        
        continue;
      }
      
      lineIndex++;
    }
  }

  /**
   * Process resource-level properties and methods
   * 
   * @param lines RAML file content as array of lines
   * @param startIndex Starting index for processing
   * @param resourceObj Resource object to populate
   * @returns Next line index after processing
   */
  private processResourceProperties(lines: string[], startIndex: number, resourceObj: any): number {
    const validMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];
    let lineIndex = startIndex;
    let baseIndent = -1;
    
    while (lineIndex < lines.length) {
      const line = lines[lineIndex];
      const trimmedLine = line.trim();
      const indent = line.search(/\S/);
      
      // Skip comments and empty lines
      if (trimmedLine === '' || trimmedLine.startsWith('#')) {
        lineIndex++;
        continue;
      }
      
      // Set base indentation level if not set yet
      if (baseIndent === -1) {
        baseIndent = indent;
      }
      
      // Exit if indentation is less than base level
      if (indent < baseIndent) {
        return lineIndex;
      }
      
      // Process key-value pairs
      if (trimmedLine.includes(':')) {
        const colonIndex = trimmedLine.indexOf(':');
        const key = trimmedLine.substring(0, colonIndex).trim();
        const valueStr = trimmedLine.substring(colonIndex + 1).trim();
        
        // If it's a HTTP method
        if (validMethods.includes(key.toLowerCase())) {
          // Initialize method object if not exists
          if (!resourceObj[key.toLowerCase()]) {
            resourceObj[key.toLowerCase()] = {
              parameters: [],
              responses: {}
            };
          }
          
          // Skip to the next line
          lineIndex++;
          
          // Process method-level properties
          lineIndex = this.processMethodProperties(lines, lineIndex, resourceObj[key.toLowerCase()], indent);
          continue;
        } else {
          // Regular resource property
          if (valueStr !== '') {
            resourceObj[key] = valueStr.replace(/^["']|["']$/g, '');
          }
        }
      }
      
      lineIndex++;
    }
    
    return lineIndex;
  }

  /**
   * Process method-level properties
   * 
   * @param lines RAML file content as array of lines
   * @param startIndex Starting index for processing
   * @param methodObj Method object to populate
   * @param baseIndent Base indentation level
   * @returns Next line index after processing
   */
  private processMethodProperties(lines: string[], startIndex: number, methodObj: any, baseIndent: number): number {
    let lineIndex = startIndex;
    
    while (lineIndex < lines.length) {
      const line = lines[lineIndex];
      const trimmedLine = line.trim();
      const indent = line.search(/\S/);
      
      // Skip comments and empty lines
      if (trimmedLine === '' || trimmedLine.startsWith('#')) {
        lineIndex++;
        continue;
      }
      
      // Exit if indentation is less than or equal to base level
      if (indent <= baseIndent) {
        return lineIndex;
      }
      
      // Process key-value pairs
      if (trimmedLine.includes(':')) {
        const colonIndex = trimmedLine.indexOf(':');
        const key = trimmedLine.substring(0, colonIndex).trim();
        const valueStr = trimmedLine.substring(colonIndex + 1).trim();
        
        // Process responses (status codes)
        if (key.match(/^\d{3}$/)) {
          // Initialize response object if not exists
          if (!methodObj.responses[key]) {
            methodObj.responses[key] = {
              description: valueStr || `Response with status ${key}`
            };
          }
          
          // Skip to the next line
          lineIndex++;
          continue;
        } 
        // Process request headers
        else if (key === 'headers') {
          // Initialize headers array if not exists
          if (!methodObj.headers) {
            methodObj.headers = [];
          }
          
          // Skip to the next line
          lineIndex++;
          
          // Process header parameters
          lineIndex = this.processParameterObject(lines, lineIndex, methodObj.headers, indent);
          continue;
        }
        // Process query parameters
        else if (key === 'queryParameters') {
          // Initialize parameters array if not exists
          if (!methodObj.parameters) {
            methodObj.parameters = [];
          }
          
          // Skip to the next line
          lineIndex++;
          
          // Process query parameters
          lineIndex = this.processParameterObject(lines, lineIndex, methodObj.parameters, indent);
          continue;
        }
        // Process regular method property
        else if (valueStr !== '') {
          methodObj[key] = valueStr.replace(/^["']|["']$/g, '');
        }
      }
      
      lineIndex++;
    }
    
    return lineIndex;
  }

  /**
   * Process parameter object (headers, queryParameters, etc.)
   * 
   * @param lines RAML file content as array of lines
   * @param startIndex Starting index for processing
   * @param paramArray Array to populate with parameters
   * @param baseIndent Base indentation level
   * @returns Next line index after processing
   */
  private processParameterObject(lines: string[], startIndex: number, paramArray: any[], baseIndent: number): number {
    let lineIndex = startIndex;
    let currentParamName = '';
    let paramObj: any = {};
    
    while (lineIndex < lines.length) {
      const line = lines[lineIndex];
      const trimmedLine = line.trim();
      const indent = line.search(/\S/);
      
      // Skip comments and empty lines
      if (trimmedLine === '' || trimmedLine.startsWith('#')) {
        lineIndex++;
        continue;
      }
      
      // Exit if indentation is less than or equal to base level
      if (indent <= baseIndent) {
        // Add last parameter if exists
        if (currentParamName !== '') {
          paramArray.push({
            name: currentParamName,
            ...paramObj
          });
        }
        
        return lineIndex;
      }
      
      // Process key-value pairs
      if (trimmedLine.includes(':')) {
        const colonIndex = trimmedLine.indexOf(':');
        const key = trimmedLine.substring(0, colonIndex).trim();
        const valueStr = trimmedLine.substring(colonIndex + 1).trim();
        
        // Check if this is a new parameter name
        if (indent === baseIndent + 2) {
          // Add previous parameter if exists
          if (currentParamName !== '') {
            paramArray.push({
              name: currentParamName,
              ...paramObj
            });
          }
          
          // Start new parameter
          currentParamName = key;
          paramObj = {};
        }
        // Parameter property
        else if (indent > baseIndent + 2) {
          if (valueStr !== '') {
            paramObj[key] = valueStr.replace(/^["']|["']$/g, '');
          }
        }
      }
      
      lineIndex++;
    }
    
    // Add last parameter if exists
    if (currentParamName !== '') {
      paramArray.push({
        name: currentParamName,
        ...paramObj
      });
    }
    
    return lineIndex;
  }

  /**
   * Extract models from schema files
   * 
   * @param schemaFiles Array of paths to schema files
   * @returns Array of models
   */
  private async extractModelsFromSchemaFiles(schemaFiles: string[]): Promise<ModelInfo[]> {
    const models: ModelInfo[] = [];
    
    for (const file of schemaFiles) {
      try {
        // Skip non-JSON files for now
        if (!file.endsWith('.json')) {
          continue;
        }
        
        // Read schema file
        const content = fs.readFileSync(file, 'utf-8');
        
        try {
          // Parse JSON
          const schema = JSON.parse(content);
          
          // Extract models from schema
          const extractedModels = this.extractModelsFromSchema(schema, path.basename(file, '.json'));
          models.push(...extractedModels);
        } catch (parseError) {
          console.warn(`Error parsing schema file ${file}:`, parseError);
        }
      } catch (error) {
        console.warn(`Error reading schema file ${file}:`, error);
      }
    }
    
    return models;
  }

  /**
   * Extract models from JSON schema
   * 
   * @param schema JSON schema object
   * @param defaultName Default name for the model
   * @returns Array of models
   */
  private extractModelsFromSchema(schema: any, defaultName: string): ModelInfo[] {
    const models: ModelInfo[] = [];
    
    // Handle root schema with definitions/properties
    if (schema.definitions || schema.properties || schema.type === 'object') {
      // If it has definitions, process each one
      if (schema.definitions) {
        for (const [name, def] of Object.entries(schema.definitions)) {
          const model = this.createModelFromSchema(name, def as any);
          if (model) {
            models.push(model);
          }
        }
      }
      // If it has properties but no definitions, treat it as a single model
      else if (schema.properties) {
        const model = this.createModelFromSchema(defaultName, schema);
        if (model) {
          models.push(model);
        }
      }
    }
    
    return models;
  }

  /**
   * Create a model from a JSON schema
   * 
   * @param name Model name
   * @param schema JSON schema
   * @returns Model or null if invalid
   */
  private createModelFromSchema(name: string, schema: any): ModelInfo | null {
    // Skip if not an object type schema
    if (schema.type !== 'object' && !schema.properties) {
      return null;
    }
    
    const properties: any[] = [];
    
    // Extract properties
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const prop = this.createPropertyFromSchema(propName, propSchema as any, schema.required);
        properties.push(prop);
      }
    }
    
    // Skip if no properties
    if (properties.length === 0) {
      return null;
    }
    
    return {
      name,
      description: schema.description || `Model for ${name}`,
      properties
    };
  }

  /**
   * Create a property from a JSON schema property
   * 
   * @param name Property name
   * @param schema Property schema
   * @param requiredProps Array of required property names
   * @returns Property object
   */
  private createPropertyFromSchema(name: string, schema: any, requiredProps?: string[]): any {
    return {
      name,
      type: schema.type || 'string',
      description: schema.description || `Property ${name}`,
      format: schema.format,
      required: requiredProps ? requiredProps.includes(name) : false
    };
  }

  /**
   * Convert RAML structure to ApiStructure format
   * 
   * @param ramlObj Parsed RAML object
   * @param basePath Base path for resolving references
   * @returns API structure in Spectra format
   */
  private convertRamlToApiStructure(ramlObj: any, basePath: string): ApiStructure {
    const apiStructure: ApiStructure = {
      name: ramlObj.title || 'RAML API',
      description: ramlObj.description || 'API extracted from RAML specification',
      version: ramlObj.version || '1.0.0',
      basePath: ramlObj.baseUri || '',
      endpoints: [],
      models: []
    };
    
    // Convert endpoints
    for (const [path, pathObj] of Object.entries(ramlObj.paths)) {
      for (const methodName of ['get', 'post', 'put', 'delete', 'patch', 'options', 'head']) {
        const methodObj = (pathObj as any)[methodName];
        
        if (methodObj) {
          const endpoint: EndpointInfo = {
            path: path,
            method: methodName,
            summary: methodObj.summary || `${methodName.toUpperCase()} ${path}`,
            description: methodObj.description || `${methodName.toUpperCase()} operation for ${path}`,
            parameters: [],
            responses: []
          };
          
          // Add parameters
          if (methodObj.parameters && Array.isArray(methodObj.parameters)) {
            for (const param of methodObj.parameters) {
              const paramInfo: ParameterInfo = {
                name: param.name,
                location: 'query',
                description: param.description || `Parameter ${param.name}`,
                required: param.required === 'true' || param.required === true
              };
              
              endpoint.parameters!.push(paramInfo);
            }
          }
          
          // Add headers as parameters
          if (methodObj.headers && Array.isArray(methodObj.headers)) {
            for (const header of methodObj.headers) {
              const paramInfo: ParameterInfo = {
                name: header.name,
                location: 'header',
                description: header.description || `Header ${header.name}`,
                required: header.required === 'true' || header.required === true
              };
              
              endpoint.parameters!.push(paramInfo);
            }
          }
          
          // Add responses
          for (const [statusCode, responseObj] of Object.entries(methodObj.responses || {})) {
            const response: ResponseInfo = {
              statusCode: parseInt(statusCode, 10),
              description: (responseObj as any).description || `Response with status ${statusCode}`,
              contentType: 'application/json'
            };
            
            endpoint.responses!.push(response);
          }
          
          // Add default response if none provided
          if (!endpoint.responses || endpoint.responses.length === 0) {
            endpoint.responses = [{
              statusCode: 200,
              description: 'Successful operation',
              contentType: 'application/json'
            }];
          }
          
          apiStructure.endpoints.push(endpoint);
        }
      }
    }
    
    return apiStructure;
  }
} 
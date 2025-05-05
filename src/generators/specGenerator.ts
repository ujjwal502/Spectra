import fs from 'fs';
import path from 'path';
import { ApiSchema, ApiStructure, CodebaseAnalysisResult, PathItem } from '../types';
import { LanguageDetector } from '../parsers/languageDetector';
import { ExpressParser } from '../parsers/expressParser';
import { RamlParser } from '../parsers/ramlParser';
import { KotlinParser } from '../parsers/kotlinParser';
import { AIService } from '../services/aiService';

/**
 * SpecGenerator - Analyzes backend code and generates OpenAPI specifications
 */
export class SpecGenerator {
  private languageDetector: LanguageDetector;
  private parsers: Map<string, any>;
  private aiService: AIService;
  
  constructor() {
    this.languageDetector = new LanguageDetector();
    this.parsers = new Map();
    this.aiService = new AIService();
    
    // Register parsers
    this.registerParser('express', new ExpressParser());
    this.registerParser('raml', new RamlParser());
    this.registerParser('kotlin', new KotlinParser());
    this.registerParser('spring-boot', new KotlinParser()); // Use KotlinParser for Spring Boot as well
    this.registerParser('ktor', new KotlinParser());
    
    // More parsers will be registered here as they are implemented
    // this.registerParser('nestjs', new NestJsParser());
    // this.registerParser('django', new DjangoParser());
    // etc.
  }
  
  /**
   * Register a parser for a specific framework
   * 
   * @param framework Framework name
   * @param parser Parser instance
   */
  registerParser(framework: string, parser: any): void {
    this.parsers.set(framework, parser);
  }
  
  /**
   * Generate OpenAPI specification from backend code
   * 
   * @param rootDir Root directory of the backend code
   * @returns Generated OpenAPI specification
   */
  async generateFromCode(rootDir: string): Promise<ApiSchema> {
    console.log(`Analyzing codebase in ${rootDir}...`);
    
    // Get codebase analysis result
    const analysisResult = await this.analyzeCodebase(rootDir);
    
    // Use AI to generate/enhance the API specification
    let apiStructure: ApiStructure;
    
    // Check if we have an OPENAI_API_KEY to use AI
    if (process.env.OPENAI_API_KEY) {
      console.log('Using AI to enhance/generate API specification...');
      apiStructure = await this.aiService.generateFullApiSpec(analysisResult);
    } else {
      console.warn('⚠️ OPENAI_API_KEY not found in environment. Using parser-generated structure without AI enhancement.');
      apiStructure = analysisResult.apiStructure;
    }
    
    // Convert to OpenAPI spec
    const openApiSpec = this.convertToOpenAPI(apiStructure);
    
    return openApiSpec;
  }
  
  /**
   * Analyze codebase and extract API information
   * 
   * @param rootDir Root directory of the backend code
   * @returns Codebase analysis result
   */
  private async analyzeCodebase(rootDir: string): Promise<CodebaseAnalysisResult> {
    // Detect language and framework
    const { language, framework } = await this.languageDetector.detectLanguageAndFramework(rootDir);
    console.log(`\n📊 Codebase Analysis Result:\nLanguage: ${language}`);
    
    // Get appropriate parser
    const parser = this.getParserForFramework(framework);
    
    if (!parser) {
      throw new Error(`No parser available for ${framework} framework`);
    }
    
    // Parse the codebase
    const apiStructure = await parser.parse(rootDir);
    
    return {
      detectedLanguage: language,
      detectedFramework: framework,
      apiStructure,
      parserUsed: parser.name || framework
    };
  }
  
  /**
   * Get parser for a specific framework
   * 
   * @param framework Framework name
   * @returns Parser instance or undefined if not found
   */
  private getParserForFramework(framework: string): any {
    // Check if we have a specific parser for this framework
    if (this.parsers.has(framework)) {
      return this.parsers.get(framework);
    }
    
    // For OpenAPI/RAML frameworks, use corresponding parsers
    if (framework === 'openapi') {
      // OpenAPI files can be directly parsed by our schema tools
      // But we could also register a specific parser if needed
      return this.parsers.get('raml'); // Use RAML parser as a fallback for now
    }
    
    // Return undefined if no parser is found
    return undefined;
  }
  
  /**
   * Convert API structure to OpenAPI specification
   * 
   * @param apiStructure API structure
   * @returns OpenAPI specification
   */
  private convertToOpenAPI(apiStructure: ApiStructure): ApiSchema {
    console.log('Converting to OpenAPI specification...');
    
    // Create basic OpenAPI structure
    const openApiSpec: ApiSchema = {
      openapi: '3.0.0',
      info: {
        title: apiStructure.name,
        version: apiStructure.version || '1.0.0',
        description: apiStructure.description
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Local development server'
        }
      ],
      paths: {},
      components: {
        schemas: {}
      }
    };
    
    // Add components schemas from models
    for (const model of apiStructure.models) {
      openApiSpec.components!.schemas![model.name] = this.convertModelToSchema(model);
    }
    
    // Add paths from endpoints
    for (const endpoint of apiStructure.endpoints) {
      // Initialize path if it doesn't exist
      if (!openApiSpec.paths[endpoint.path]) {
        openApiSpec.paths[endpoint.path] = {};
      }
      
      // Convert endpoint to OpenAPI operation
      const method = endpoint.method as 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head';
      openApiSpec.paths[endpoint.path][method] = this.convertEndpointToOperation(endpoint);
    }
    
    return openApiSpec;
  }
  
  /**
   * Convert model to OpenAPI schema
   * 
   * @param model Model info
   * @returns OpenAPI schema
   */
  private convertModelToSchema(model: any): any {
    const schema: any = {
      type: 'object',
      properties: {},
      required: []
    };
    
    if (model.description) {
      schema.description = model.description;
    }
    
    // Add properties
    for (const prop of model.properties) {
      schema.properties[prop.name] = this.convertPropertyToSchema(prop);
      
      // Add to required list if needed
      if (prop.required) {
        schema.required.push(prop.name);
      }
    }
    
    // Remove required array if empty
    if (schema.required.length === 0) {
      delete schema.required;
    }
    
    return schema;
  }
  
  /**
   * Convert property to OpenAPI schema property
   * 
   * @param property Property info
   * @returns OpenAPI schema property
   */
  private convertPropertyToSchema(property: any): any {
    const schema: any = {
      type: property.type
    };
    
    if (property.description) {
      schema.description = property.description;
    }
    
    if (property.format) {
      schema.format = property.format;
    }
    
    if (property.enum) {
      schema.enum = property.enum;
    }
    
    // Handle array type
    if (property.type === 'array' && property.items) {
      schema.items = this.convertPropertyToSchema(property.items);
    }
    
    // Handle object type with nested properties
    if (property.type === 'object' && property.properties) {
      schema.properties = {};
      schema.required = [];
      
      for (const prop of property.properties) {
        schema.properties[prop.name] = this.convertPropertyToSchema(prop);
        
        if (prop.required) {
          schema.required.push(prop.name);
        }
      }
      
      if (schema.required.length === 0) {
        delete schema.required;
      }
    }
    
    return schema;
  }
  
  /**
   * Convert endpoint to OpenAPI operation
   * 
   * @param endpoint Endpoint info
   * @returns OpenAPI operation
   */
  private convertEndpointToOperation(endpoint: any): any {
    const operation: any = {
      summary: endpoint.summary,
      description: endpoint.description,
      parameters: [],
      responses: {}
    };
    
    // Add tags if available
    if (endpoint.tags && endpoint.tags.length > 0) {
      operation.tags = endpoint.tags;
    }
    
    // Add parameters
    if (endpoint.parameters && endpoint.parameters.length > 0) {
      for (const param of endpoint.parameters) {
        operation.parameters.push({
          name: param.name,
          in: param.location,
          description: param.description,
          required: param.required,
          schema: param.schema
        });
      }
    }
    
    // Add request body if available
    if (endpoint.requestBody) {
      operation.requestBody = {
        description: endpoint.requestBody.description,
        required: endpoint.requestBody.required,
        content: {
          [endpoint.requestBody.contentType || 'application/json']: {
            schema: endpoint.requestBody.schema
          }
        }
      };
    }
    
    // Add responses
    if (endpoint.responses && endpoint.responses.length > 0) {
      for (const response of endpoint.responses) {
        operation.responses[response.statusCode] = {
          description: response.description || 'Response',
          content: response.schema ? {
            [response.contentType || 'application/json']: {
              schema: response.schema
            }
          } : undefined
        };
      }
    } else {
      // Default response
      operation.responses = {
        '200': {
          description: 'Successful operation'
        }
      };
    }
    
    return operation;
  }
} 
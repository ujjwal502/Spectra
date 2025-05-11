import { ApiSchema, ApiStructure, CodebaseAnalysisResult, SpecGeneratorOptions } from '../types';
import { LanguageDetector } from '../parsers/languageDetector';
import { ExpressParser } from '../parsers/expressParser';
import { RamlParser } from '../parsers/ramlParser';
import { KotlinParser } from '../parsers/kotlinParser';
import { JavaParser } from '../parsers/javaParser';
import { AIService } from '../services/aiService';

/**
 * SpecGenerator - Analyzes backend code and generates OpenAPI specifications
 */
export class SpecGenerator {
  private languageDetector: LanguageDetector;
  private parsers: Map<string, any>;
  private aiService: AIService;
  private options: SpecGeneratorOptions;

  constructor(options?: Partial<SpecGeneratorOptions>) {
    this.options = {
      preserveApiPrefix: true,
      groupByResource: true,
      enhanceParameterNames: true,
      extractJSDocComments: true,
      baseUrl: 'http://localhost:3000',
      ...options,
    };

    this.languageDetector = new LanguageDetector();
    this.parsers = new Map();
    this.aiService = new AIService();

    // JavaScript/TypeScript parsers
    const expressParser = new ExpressParser();
    this.registerParser('express', expressParser);
    this.registerParser('javascript', expressParser);
    this.registerParser('javascript-express', expressParser);

    // RAML parser
    const ramlParser = new RamlParser();
    this.registerParser('raml', ramlParser);

    // Kotlin parsers
    const kotlinParser = new KotlinParser();
    this.registerParser('kotlin', kotlinParser);
    this.registerParser('ktor', kotlinParser);
    this.registerParser('kotlin-ktor', kotlinParser);
    this.registerParser('kotlin-spring-boot', kotlinParser);

    // Java parsers
    const javaParser = new JavaParser();
    this.registerParser('java', javaParser);
    this.registerParser('spring-boot', javaParser);
    this.registerParser('spring', javaParser);
    this.registerParser('quarkus', javaParser);
    this.registerParser('micronaut', javaParser);
    this.registerParser('jax-rs', javaParser);
    this.registerParser('java-spring-boot', javaParser);
    this.registerParser('java-spring', javaParser);
    this.registerParser('java-quarkus', javaParser);
    this.registerParser('java-micronaut', javaParser);
    this.registerParser('java-jax-rs', javaParser);

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

    const analysisResult = await this.analyzeCodebase(rootDir);

    let apiStructure: ApiStructure;

    console.log('Using AI to enhance/generate API specification...');

    apiStructure = await this.aiService.generateFullApiSpec(analysisResult);

    // Convert to OpenAPI spec
    const openApiSpec = this.convertToOpenAPI(apiStructure);

    // Post-process the generated schema to ensure completeness
    this.postProcessSchema(openApiSpec);

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
    console.log(`\n📊 Codebase Analysis Result:\nLanguage: ${language}\nFramework: ${framework}`);

    // Get appropriate parser
    const parser = this.getParserForFramework(framework, language);

    if (!parser) {
      throw new Error(`No parser available for ${language} language and ${framework} framework`);
    }

    // Parse the codebase
    const apiStructure = await parser.parse(rootDir);

    return {
      detectedLanguage: language,
      detectedFramework: framework,
      apiStructure,
      parserUsed: parser.name || framework,
    };
  }

  /**
   * Get parser for a specific framework
   *
   * @param framework Framework name
   * @returns Parser instance or undefined if not found
   */
  private getParserForFramework(framework: string, language?: string): any {
    // First priority: language + framework combination
    if (language) {
      const combinedKey = `${language}-${framework}`;
      if (this.parsers.has(combinedKey)) {
        return this.parsers.get(combinedKey);
      }

      // Second priority: language only
      if (this.parsers.has(language)) {
        return this.parsers.get(language);
      }
    }

    // Third priority: framework only
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
        description: apiStructure.description,
      },
      servers: [
        {
          url: this.options.baseUrl,
          description: 'Local development server',
        },
      ],
      paths: {},
      components: {
        schemas: {},
      },
    };

    // Add components schemas from models
    for (const model of apiStructure.models) {
      openApiSpec.components!.schemas![model.name] = this.convertModelToSchema(model);
    }

    // Fix for duplicate path detection: keep track of processed paths
    const processedPaths = new Set<string>();

    // Organize endpoints by resource tag if groupByResource is enabled
    if (this.options.groupByResource) {
      // Group endpoints by resource tag
      const resourceGroups: { [resource: string]: any[] } = {};

      // First, group endpoints by resource
      for (const endpoint of apiStructure.endpoints) {
        // Use the first tag as resource if available, otherwise use a default group
        const resource = endpoint.tags && endpoint.tags.length > 0 ? endpoint.tags[0] : 'general';

        if (!resourceGroups[resource]) {
          resourceGroups[resource] = [];
        }

        resourceGroups[resource].push(endpoint);
      }

      console.log(`Grouped endpoints into ${Object.keys(resourceGroups).length} resources`);

      // For each resource group, sort endpoints by path for consistency
      for (const resource in resourceGroups) {
        resourceGroups[resource].sort((a, b) => a.path.localeCompare(b.path));
      }

      // Now add all endpoints with their resource tags
      for (const resource in resourceGroups) {
        for (const endpoint of resourceGroups[resource]) {
          // Check for duplicate path patterns (e.g., /api/users/api/users)
          let endpointPath = endpoint.path;

          // Fix 1: Detect and fix duplicate path segments
          const pathSegments = endpointPath
            .split('/')
            .filter((segment: string) => segment.length > 0);

          // Check for duplicate segments that would create patterns like /api/users/api/users
          for (let i = 0; i < pathSegments.length; i++) {
            for (let j = i + 1; j < pathSegments.length; j++) {
              if (pathSegments[i] === pathSegments[j] && j === i + 2) {
                // Found duplicate pattern, remove the duplicate segments
                pathSegments.splice(j - 1, 2);
                j -= 2;
              }
            }
          }

          // Recreate path with fixed segments
          endpointPath = '/' + pathSegments.join('/');

          // Skip if this exact path+method combination has already been processed
          const pathMethodKey = `${endpointPath}|${endpoint.method}`;
          if (processedPaths.has(pathMethodKey)) {
            console.log(
              `Skipping duplicate endpoint: ${endpoint.method.toUpperCase()} ${endpointPath}`,
            );
            continue;
          }

          processedPaths.add(pathMethodKey);

          if (!openApiSpec.paths[endpointPath]) {
            openApiSpec.paths[endpointPath] = {};
          }

          const method = endpoint.method as
            | 'get'
            | 'post'
            | 'put'
            | 'delete'
            | 'patch'
            | 'options'
            | 'head';

          // Fix 2: Generate operation with correct status codes
          openApiSpec.paths[endpointPath][method] = this.convertEndpointToOperation(
            endpoint,
            method,
          );
        }
      }
    } else {
      // Traditional non-grouped approach - just add paths
      for (const endpoint of apiStructure.endpoints) {
        // Fix 1: Detect and fix duplicate path segments
        let endpointPath = endpoint.path;
        const pathSegments = endpointPath
          .split('/')
          .filter((segment: string) => segment.length > 0);

        // Check for duplicate segments
        for (let i = 0; i < pathSegments.length; i++) {
          for (let j = i + 1; j < pathSegments.length; j++) {
            if (pathSegments[i] === pathSegments[j] && j === i + 2) {
              // Found duplicate pattern, remove the duplicate segments
              pathSegments.splice(j - 1, 2);
              j -= 2;
            }
          }
        }

        // Recreate path with fixed segments
        endpointPath = '/' + pathSegments.join('/');

        // Skip if this exact path+method combination has already been processed
        const pathMethodKey = `${endpointPath}|${endpoint.method}`;
        if (processedPaths.has(pathMethodKey)) {
          console.log(
            `Skipping duplicate endpoint: ${endpoint.method.toUpperCase()} ${endpointPath}`,
          );
          continue;
        }

        processedPaths.add(pathMethodKey);

        // Initialize path if it doesn't exist
        if (!openApiSpec.paths[endpointPath]) {
          openApiSpec.paths[endpointPath] = {};
        }

        // Convert endpoint to OpenAPI operation
        const method = endpoint.method as
          | 'get'
          | 'post'
          | 'put'
          | 'delete'
          | 'patch'
          | 'options'
          | 'head';

        openApiSpec.paths[endpointPath][method] = this.convertEndpointToOperation(endpoint, method);
      }
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
      required: [],
    };

    if (model.description) {
      schema.description = model.description;
    }

    // More detailed logging for debugging
    console.log(`Converting model: ${model.name}`);
    if (Array.isArray(model.properties)) {
      console.log(`Model has array properties with ${model.properties.length} items`);
    } else if (typeof model.properties === 'object' && model.properties !== null) {
      console.log(
        `Model has object properties with keys: ${Object.keys(model.properties).join(', ')}`,
      );
    } else {
      console.log(`Model properties has unexpected type: ${typeof model.properties}`);
    }

    // Handle properties - may be an array or an object depending on source
    if (Array.isArray(model.properties)) {
      // Handle array format (from parsers)
      for (const prop of model.properties) {
        schema.properties[prop.name] = this.convertPropertyToSchema(prop);

        // Add to required list if needed
        if (prop.required) {
          schema.required.push(prop.name);
        }
      }
    } else if (typeof model.properties === 'object' && model.properties !== null) {
      // Handle object format (from AI service)
      for (const [propName, propDetails] of Object.entries(model.properties)) {
        schema.properties[propName] = this.convertPropertyToSchema({
          name: propName,
          ...(propDetails as Record<string, any>),
        });

        // Check if this property is required
        if ((propDetails as any).required) {
          schema.required.push(propName);
        }
      }
    } else {
      console.warn(`Warning: model ${model.name} has no valid properties`);
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
    // Handle case where property might not have a 'type' field
    if (!property.type) {
      console.log('Property missing type field:', property);
      // Try to infer type from other fields
      if (property.items) {
        property.type = 'array';
      } else if (property.properties) {
        property.type = 'object';
      } else if (property.format === 'date-time' || property.format === 'date') {
        property.type = 'string';
      } else if (property.enum) {
        property.type = typeof property.enum[0] || 'string';
      } else {
        // Default to string if we can't determine type
        property.type = 'string';
      }
    }

    const schema: any = {
      type: property.type,
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

      // Check if properties is an array (from parser) or an object (from AI)
      if (Array.isArray(property.properties)) {
        for (const prop of property.properties) {
          schema.properties[prop.name] = this.convertPropertyToSchema(prop);
          if (prop.required) {
            schema.required.push(prop.name);
          }
        }
      } else {
        // Handle object format properties
        for (const [propName, propDetails] of Object.entries(property.properties)) {
          schema.properties[propName] = this.convertPropertyToSchema({
            name: propName,
            ...(propDetails as Record<string, any>),
          });

          // Check if this property is required
          if ((propDetails as any).required) {
            schema.required.push(propName);
          }
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
   * @param method HTTP method (optional, will be derived from endpoint if not provided)
   * @returns OpenAPI operation
   */
  private convertEndpointToOperation(endpoint: any, method?: string): any {
    const httpMethod = method || endpoint.method;

    // Enhance summary and description if they're too generic
    let summary = endpoint.summary || `${httpMethod.toUpperCase()} ${endpoint.path}`;
    let description = endpoint.description || 'No description available';

    // If summary just repeats the method and path, try to generate a better one
    if (summary === `${httpMethod.toUpperCase()} ${endpoint.path}`) {
      const pathParts = endpoint.path.split('/').filter((part: string) => part);
      const lastPart = pathParts[pathParts.length - 1];

      // Improve summary based on HTTP method and path
      if (httpMethod === 'get') {
        if (endpoint.path.includes('/{id}') || endpoint.path.includes('/:id')) {
          summary = `Get a specific ${lastPart.replace('{id}', '').replace(':id', '')}`;
        } else {
          summary = `Get all ${lastPart}`;
        }
      } else if (httpMethod === 'post') {
        summary = `Create a new ${lastPart.endsWith('s') ? lastPart.slice(0, -1) : lastPart}`;
      } else if (httpMethod === 'put') {
        summary = `Update an existing ${lastPart.replace('{id}', '').replace(':id', '')}`;
      } else if (httpMethod === 'patch') {
        summary = `Partially update a ${lastPart.replace('{id}', '').replace(':id', '')}`;
      } else if (httpMethod === 'delete') {
        summary = `Delete a ${lastPart.replace('{id}', '').replace(':id', '')}`;
      }
    }

    // Create the operation object
    const operation: any = {
      summary,
      description,
      parameters: [],
      responses: {},
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
          description: param.description || `${param.name} parameter`,
          required: param.required,
          schema: param.schema || { type: 'string' },
        });
      }
    }

    // Add path parameters if they are in the URL but not explicitly defined
    const pathParams = (endpoint.path.match(/[{:][^}/:]+[}]?/g) || []).map((p: string) =>
      p.replace('{', '').replace('}', '').replace(':', ''),
    );

    // Only add path parameters that aren't already included
    const existingParamNames = new Set(
      (endpoint.parameters || []).filter((p: any) => p.location === 'path').map((p: any) => p.name),
    );

    for (const param of pathParams) {
      if (!existingParamNames.has(param)) {
        operation.parameters.push({
          name: param,
          in: 'path',
          description: `${param} parameter`,
          required: true,
          schema: { type: 'string' },
        });
      }
    }

    // Add request body if available
    if (endpoint.requestBody) {
      operation.requestBody = {
        description: endpoint.requestBody.description || 'Request body',
        required: endpoint.requestBody.required,
        content: {
          [endpoint.requestBody.contentType || 'application/json']: {
            schema: endpoint.requestBody.schema,
          },
        },
      };
    }
    // Add default request body for POST, PUT and PATCH operations if none specified
    else if (httpMethod === 'post' || httpMethod === 'put' || httpMethod === 'patch') {
      // Generate a basic request body schema for resource creation/update
      const defaultSchema = this.generateDefaultRequestBodySchema(endpoint);

      if (defaultSchema) {
        operation.requestBody = {
          description: `${httpMethod === 'post' ? 'Create' : 'Update'} request body`,
          required: true,
          content: {
            'application/json': {
              schema: defaultSchema,
            },
          },
        };
      }
    }

    // Add responses with appropriate status codes
    if (endpoint.responses && endpoint.responses.length > 0) {
      for (const response of endpoint.responses) {
        operation.responses[response.statusCode] = {
          description: response.description || `Status code ${response.statusCode}`,
          content: response.schema
            ? {
                [response.contentType || 'application/json']: {
                  schema: response.schema,
                },
              }
            : undefined,
        };
      }
    } else {
      // Generate response schemas based on method, path, and potential model references
      this.generateResponseSchemas(operation, endpoint, httpMethod);
    }

    return operation;
  }

  /**
   * Generate appropriate response schemas based on the endpoint context
   *
   * @param operation The OpenAPI operation object to modify
   * @param endpoint The endpoint information
   * @param httpMethod The HTTP method
   */
  private generateResponseSchemas(operation: any, endpoint: any, httpMethod: string): void {
    // Create endpoint context to help determine appropriate responses
    const pathParts = endpoint.path.split('/').filter((part: string) => part);
    const resourceName =
      pathParts[pathParts.length - 1]?.replace('{id}', '').replace(':id', '') || '';
    const singularName = resourceName.endsWith('s') ? resourceName.slice(0, -1) : resourceName;

    const endpointContext = {
      isCollection:
        !endpoint.path.includes('/{id}') && !endpoint.path.includes('/:id') && httpMethod === 'get',
      isDetail:
        (endpoint.path.includes('/{id}') || endpoint.path.includes('/:id')) && httpMethod === 'get',
      isCreate: httpMethod === 'post',
      isUpdate: httpMethod === 'put' || httpMethod === 'patch',
      isDelete: httpMethod === 'delete',
      resourceName: singularName || 'resource',
    };

    // Define default responses based on HTTP method and context
    if (httpMethod === 'post') {
      // POST - Creation
      operation.responses = {
        '201': {
          description: `${singularName || 'Resource'} created successfully`,
          content: {
            'application/json': {
              schema: this.generateResponseSchema(endpoint, '201', endpointContext),
            },
          },
        },
        '400': {
          description: 'Bad request - invalid input',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', description: 'Error message' },
                  details: {
                    type: 'array',
                    description: 'Validation error details',
                    items: {
                      type: 'object',
                      properties: {
                        field: { type: 'string' },
                        message: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized - authentication required',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' },
                },
              },
            },
          },
        },
      };

      // Add conflict response for user/auth endpoints
      if (
        endpoint.path.includes('user') ||
        endpoint.path.includes('auth') ||
        endpoint.path.includes('register') ||
        endpoint.path.includes('account')
      ) {
        operation.responses['409'] = {
          description: 'Conflict - resource already exists',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' },
                },
              },
            },
          },
        };
      }
    } else if (httpMethod === 'put' || httpMethod === 'patch') {
      // PUT/PATCH - Update
      operation.responses = {
        '200': {
          description: `${singularName || 'Resource'} updated successfully`,
          content: {
            'application/json': {
              schema: this.generateResponseSchema(endpoint, '200', endpointContext),
            },
          },
        },
        '400': {
          description: 'Bad request - invalid input',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' },
                  details: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        field: { type: 'string' },
                        message: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized - authentication required',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' },
                },
              },
            },
          },
        },
        '404': {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' },
                },
              },
            },
          },
        },
      };
    } else if (httpMethod === 'delete') {
      // DELETE
      operation.responses = {
        '204': {
          description: 'Deleted successfully - no content',
        },
        '401': {
          description: 'Unauthorized - authentication required',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' },
                },
              },
            },
          },
        },
        '404': {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' },
                },
              },
            },
          },
        },
      };
    } else {
      // GET and other operations
      if (endpointContext.isCollection) {
        // GET collection
        operation.responses = {
          '200': {
            description: `Array of ${resourceName}`,
            content: {
              'application/json': {
                schema: this.generateResponseSchema(endpoint, '200', endpointContext),
              },
            },
          },
          '401': {
            description: 'Unauthorized - authentication required',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
        };
      } else {
        // GET detail or other
        operation.responses = {
          '200': {
            description: `Successful operation`,
            content: {
              'application/json': {
                schema: this.generateResponseSchema(endpoint, '200', endpointContext),
              },
            },
          },
          '401': {
            description: 'Unauthorized - authentication required',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
        };
      }
    }

    // Add special responses for specific endpoints
    if (endpoint.path.includes('auth') || endpoint.path.includes('login')) {
      // Auth endpoints often return tokens
      operation.responses['200'] = {
        description: 'Authentication successful',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                token: { type: 'string', description: 'Authentication token' },
                refreshToken: { type: 'string', description: 'Refresh token (if applicable)' },
                expiresIn: { type: 'integer', description: 'Token expiration time in seconds' },
                user: {
                  type: 'object',
                  description: 'User information',
                  properties: {
                    id: { type: 'string' },
                    username: { type: 'string' },
                    email: { type: 'string' },
                    role: { type: 'string' },
                  },
                },
              },
              required: ['token'],
            },
          },
        },
      };
    } else if (
      endpoint.path.includes('process') ||
      endpoint.path.includes('message') ||
      endpoint.path.includes('transform')
    ) {
      // Processing endpoints
      operation.responses['200'] = {
        description: 'Processing successful',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', description: 'Success status' },
                result: {
                  type: 'object',
                  description: 'Processing result',
                  properties: {
                    processedData: { type: 'string', description: 'Processed data' },
                    metadata: {
                      type: 'object',
                      description: 'Processing metadata',
                      properties: {
                        processTime: {
                          type: 'number',
                          description: 'Processing time in milliseconds',
                        },
                        transactionId: {
                          type: 'string',
                          description: 'Unique transaction identifier',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };
    }
  }

  /**
   * Generate a response schema based on endpoint context
   *
   * @param endpoint The endpoint information
   * @param statusCode The HTTP status code
   * @param context Endpoint context information
   * @returns The generated response schema
   */
  private generateResponseSchema(endpoint: any, statusCode: string, context: any): any {
    // For collections (GET /resources)
    if (context.isCollection) {
      // Try to find a matching model schema based on the resource name
      const modelName =
        context.resourceName.charAt(0).toUpperCase() + context.resourceName.slice(1);

      // Base item schema - will be enhanced if we can find a matching model
      const itemSchema = this.getModelSchemaReference(modelName) || {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique identifier' },
          name: { type: 'string', description: 'Resource name' },
          createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
          updatedAt: { type: 'string', format: 'date-time', description: 'Last update timestamp' },
        },
      };

      // Return an array schema for collections
      return {
        type: 'array',
        items: itemSchema,
      };
    }

    // For create operations (POST /resources)
    if (context.isCreate && statusCode === '201') {
      const modelName =
        context.resourceName.charAt(0).toUpperCase() + context.resourceName.slice(1);
      return (
        this.getModelSchemaReference(modelName) || {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique identifier' },
            ...this.inferPropertiesFromRequestBody(endpoint),
            createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
          },
        }
      );
    }

    // For detail or update operations (GET /resources/{id}, PUT /resources/{id})
    if ((context.isDetail || context.isUpdate) && statusCode === '200') {
      const modelName =
        context.resourceName.charAt(0).toUpperCase() + context.resourceName.slice(1);
      return (
        this.getModelSchemaReference(modelName) || {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique identifier' },
            ...this.inferPropertiesFromRequestBody(endpoint),
            createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
            },
          },
        }
      );
    }

    // Default response schema
    return {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Operation result' },
        message: { type: 'string', description: 'Response message' },
      },
    };
  }

  /**
   * Try to get a schema reference to a model if it exists
   *
   * @param modelName The name of the model to look for
   * @returns A schema reference or null if not found
   */
  private getModelSchemaReference(modelName: string): any {
    // In a real implementation, you would check if the model exists in the components.schemas
    // For now we'll return null and use the fallback schemas defined in generateResponseSchema
    return null;

    // Example of how this would work with real model references:
    // return {
    //   $ref: `#/components/schemas/${modelName}`
    // };
  }

  /**
   * Infer response properties based on the request body
   *
   * @param endpoint The endpoint with request body information
   * @returns An object with inferred properties
   */
  private inferPropertiesFromRequestBody(endpoint: any): any {
    // If endpoint has a request body with schema, use those properties for the response
    if (endpoint.requestBody && endpoint.requestBody.schema) {
      const properties: any = {};

      // Copy properties from request schema but exclude sensitive fields
      const exclude = ['password', 'secret', 'token', 'authorization'];

      if (endpoint.requestBody.schema.properties) {
        Object.keys(endpoint.requestBody.schema.properties).forEach((propName) => {
          if (!exclude.includes(propName.toLowerCase())) {
            properties[propName] = endpoint.requestBody.schema.properties[propName];
          }
        });
      }

      return properties;
    }

    // For endpoints with default generated request body
    const schema = this.generateDefaultRequestBodySchema(endpoint);
    if (schema && schema.properties) {
      const properties: any = {};
      const exclude = ['password', 'secret', 'token', 'authorization'];

      Object.keys(schema.properties).forEach((propName) => {
        if (!exclude.includes(propName.toLowerCase())) {
          properties[propName] = schema.properties[propName];
        }
      });

      return properties;
    }

    return {};
  }

  /**
   * Generate a default request body schema based on the endpoint path and method
   * This is used when no explicit request body is specified
   *
   * @param endpoint The endpoint information
   * @returns A simple schema object or undefined if no schema can be generated
   */
  private generateDefaultRequestBodySchema(endpoint: any): any {
    // Extract the resource name from the path
    const pathParts = endpoint.path.split('/').filter((part: string) => part);

    // Get the last non-parameter segment of the path
    let resourceName = '';
    for (let i = pathParts.length - 1; i >= 0; i--) {
      if (!pathParts[i].includes('{') && !pathParts[i].includes(':')) {
        resourceName = pathParts[i];
        break;
      }
    }

    // If still no resource name, try the first segment
    if (!resourceName && pathParts.length > 0) {
      resourceName = pathParts[0];
    }

    // If no resource name could be determined, return undefined
    if (!resourceName) return undefined;

    // Remove trailing 's' if present (e.g., 'users' -> 'user')
    const singularName = resourceName.endsWith('s')
      ? resourceName.substring(0, resourceName.length - 1)
      : resourceName;

    // Create context-aware schema based on resource name and endpoint path
    const schema: any = {
      type: 'object',
      properties: {},
    };

    // Try to infer schema fields from endpoint path and method
    const endpointContext = {
      isCreate: endpoint.method === 'post',
      isUpdate: endpoint.method === 'put' || endpoint.method === 'patch',
      isPartialUpdate: endpoint.method === 'patch',
      hasIdInPath: endpoint.path.includes('/{id}') || endpoint.path.includes('/:id'),
      pathSegments: pathParts,
      path: endpoint.path,
    };

    // Check if this is a message processing endpoint
    if (
      singularName === 'message' ||
      singularName === 'process' ||
      endpoint.path.includes('/process') ||
      endpoint.path.includes('/message')
    ) {
      return this.generateMessageProcessorSchema(endpointContext);
    }

    // Check if this is a router endpoint
    if (
      singularName === 'path' ||
      singularName === 'route' ||
      singularName === 'router' ||
      endpoint.path.includes('/path') ||
      endpoint.path.includes('/route')
    ) {
      return this.generateRouterSchema(endpointContext);
    }

    // Check if this is a TAPI or HTTP base path endpoint
    if (endpoint.path.includes('http.base.path') || endpoint.path.includes('tapi')) {
      return this.generateTapiSchema(endpointContext);
    }

    // Customize schema based on resource name
    if (singularName === 'user' || singularName === 'customer' || singularName === 'client') {
      // User/customer schema
      schema.properties = {
        ...(!endpointContext.isPartialUpdate && {
          name: { type: 'string', description: 'User full name' },
        }),
        ...(!endpointContext.isPartialUpdate && {
          email: { type: 'string', format: 'email', description: 'User email address' },
        }),
        ...(endpointContext.isCreate && {
          password: { type: 'string', format: 'password', description: 'User password' },
        }),
        ...(endpointContext.isUpdate && {
          id: { type: 'string', description: 'User unique identifier' },
        }),
        ...(endpointContext.isCreate && {
          role: { type: 'string', enum: ['user', 'admin'], description: 'User role' },
        }),
      };
      schema.required = endpointContext.isPartialUpdate ? [] : ['name', 'email'];

      if (endpointContext.isCreate) {
        schema.required.push('password');
      }
    } else if (
      singularName === 'product' ||
      singularName === 'item' ||
      singularName === 'service'
    ) {
      // Product schema
      schema.properties = {
        ...(!endpointContext.isPartialUpdate && {
          name: { type: 'string', description: 'Product name' },
        }),
        ...(!endpointContext.isPartialUpdate && {
          description: { type: 'string', description: 'Product description' },
        }),
        ...(!endpointContext.isPartialUpdate && {
          price: { type: 'number', format: 'float', description: 'Product price' },
        }),
        ...(endpointContext.isUpdate && {
          id: { type: 'string', description: 'Product unique identifier' },
        }),
        ...(!endpointContext.isPartialUpdate && {
          category: { type: 'string', description: 'Product category' },
        }),
        ...(!endpointContext.isPartialUpdate && {
          inStock: { type: 'boolean', description: 'Product availability status' },
        }),
      };
      schema.required = endpointContext.isPartialUpdate ? [] : ['name', 'price'];
    } else if (singularName === 'order' || singularName === 'transaction') {
      // Order schema
      schema.properties = {
        ...(!endpointContext.isPartialUpdate && {
          customerId: { type: 'string', description: 'Customer unique identifier' },
        }),
        ...(!endpointContext.isPartialUpdate && {
          items: {
            type: 'array',
            description: 'Order items',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string', description: 'Product unique identifier' },
                quantity: { type: 'integer', minimum: 1, description: 'Item quantity' },
                price: { type: 'number', description: 'Item unit price' },
              },
              required: ['productId', 'quantity'],
            },
          },
        }),
        ...(endpointContext.isCreate && {
          paymentMethod: {
            type: 'string',
            enum: ['credit_card', 'paypal', 'wire_transfer'],
            description: 'Payment method',
          },
        }),
        ...(endpointContext.isUpdate && {
          status: {
            type: 'string',
            enum: ['pending', 'processing', 'shipped', 'delivered', 'canceled'],
            description: 'Order status',
          },
        }),
      };
      schema.required = endpointContext.isPartialUpdate ? [] : ['customerId', 'items'];
    } else if (singularName === 'auth' || singularName === 'token' || singularName === 'login') {
      // Authentication endpoints
      schema.properties = {
        username: { type: 'string', description: 'Username or email' },
        password: { type: 'string', format: 'password', description: 'User password' },
      };
      schema.required = ['username', 'password'];
    } else {
      // Generic schema for any resource, with more descriptive property names
      schema.properties = {
        ...(endpointContext.isUpdate && {
          id: { type: 'string', description: `Unique identifier for the ${singularName}` },
        }),
        name: { type: 'string', description: `Name of the ${singularName}` },
        description: { type: 'string', description: `Description of the ${singularName}` },
        ...(endpoint.tags &&
          endpoint.tags.length > 0 && {
            category: { type: 'string', description: `Category or type of the ${singularName}` },
          }),
      };

      // Don't require ID for POST operations (creation)
      schema.required = endpointContext.isPartialUpdate
        ? []
        : endpointContext.isCreate
          ? ['name']
          : ['id', 'name'];
    }

    return schema;
  }

  /**
   * Generate a schema for message processing endpoints
   *
   * @param endpointContext Context information about the endpoint
   * @returns Schema for message processing
   */
  private generateMessageProcessorSchema(endpointContext: any): any {
    return {
      type: 'object',
      properties: {
        payload: {
          type: 'string',
          description: 'Message payload (may be encoded/encrypted)',
        },
        encoding: {
          type: 'string',
          enum: ['base64', 'plain', 'json', 'xml'],
          description: 'Format of the payload data',
        },
        metadata: {
          type: 'object',
          description: 'Message metadata',
          properties: {
            messageId: {
              type: 'string',
              description: 'Unique identifier for the message',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Time the message was created',
            },
            source: {
              type: 'string',
              description: 'System or application that generated the message',
            },
            correlationId: {
              type: 'string',
              description: 'ID for tracking related messages',
            },
          },
        },
        processingOptions: {
          type: 'object',
          description: 'Options controlling how the message is processed',
          properties: {
            priority: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description: 'Processing priority of the message',
            },
            retryCount: {
              type: 'integer',
              description: 'Number of processing attempts to make if processing fails',
            },
            async: {
              type: 'boolean',
              description: 'Whether to process the message asynchronously',
            },
          },
        },
      },
      required: ['payload'],
    };
  }

  /**
   * Generate a schema for router endpoints
   *
   * @param endpointContext Context information about the endpoint
   * @returns Schema for router endpoints
   */
  private generateRouterSchema(endpointContext: any): any {
    return {
      type: 'object',
      properties: {
        destination: {
          type: 'string',
          description: 'Target service or endpoint to route the request to',
        },
        payload: {
          type: 'object',
          description: 'The data to be routed to the destination',
        },
        headers: {
          type: 'object',
          description: 'Headers to include with the routed request',
          additionalProperties: {
            type: 'string',
          },
        },
        routingOptions: {
          type: 'object',
          description: 'Options controlling the routing behavior',
          properties: {
            timeout: {
              type: 'integer',
              description: 'Maximum time in milliseconds to wait for a response',
            },
            retryOnFailure: {
              type: 'boolean',
              description: 'Whether to retry the request if the destination is unavailable',
            },
            fallbackDestination: {
              type: 'string',
              description: 'Alternative destination if primary fails',
            },
            transformResponse: {
              type: 'boolean',
              description: 'Whether to transform the response before returning',
            },
          },
        },
      },
      required: ['destination', 'payload'],
    };
  }

  /**
   * Generate a schema for TAPI or HTTP base path endpoints
   *
   * @param endpointContext Context information about the endpoint
   * @returns Schema for TAPI endpoints
   */
  private generateTapiSchema(endpointContext: any): any {
    return {
      type: 'object',
      properties: {
        message: {
          type: 'object',
          description: 'Message to be processed by the TAPI service',
          properties: {
            content: {
              type: 'string',
              description: 'Message content to be processed',
            },
            format: {
              type: 'string',
              enum: ['json', 'xml', 'text', 'binary'],
              description: 'Format of the message content',
            },
          },
          required: ['content'],
        },
        transactionInfo: {
          type: 'object',
          description: 'Information about the transaction',
          properties: {
            transactionId: {
              type: 'string',
              description: 'Unique identifier for this transaction',
            },
            clientId: {
              type: 'string',
              description: 'Identifier of the client making the request',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Time of the transaction',
            },
          },
          required: ['transactionId'],
        },
        processingInstructions: {
          type: 'object',
          description: 'Instructions for how to process the message',
          properties: {
            transformations: {
              type: 'array',
              description: 'List of transformations to apply to the message',
              items: {
                type: 'string',
                enum: ['decode', 'encrypt', 'anonymize', 'normalize'],
              },
            },
            validateSchema: {
              type: 'boolean',
              description: 'Whether to validate the message against a schema',
            },
            targetSystem: {
              type: 'string',
              description: 'Target system or application that will receive the processed message',
            },
          },
        },
      },
      required: ['message'],
    };
  }

  /**
   * Post-process the generated schema to ensure it's complete and consistent
   * @param schema The generated OpenAPI schema
   */
  private postProcessSchema(schema: ApiSchema): void {
    console.log('Post-processing schema to ensure completeness...');

    // Ensure all paths have meaningful descriptions
    Object.entries(schema.paths).forEach(([path, pathItem]) => {
      Object.entries(pathItem).forEach(([method, operation]) => {
        if (method !== 'parameters' && method !== 'summary' && method !== 'description') {
          // Skip non-operation properties
          this.enhanceOperationDescription(operation, path, method);
          this.ensureOperationResponses(operation, path, method);
        }
      });
    });

    // Check all model references in components.schemas
    if (schema.components && schema.components.schemas) {
      Object.entries(schema.components.schemas).forEach(([name, modelSchema]) => {
        this.enhanceModelSchema(name, modelSchema);
      });
    }
  }

  /**
   * Ensure an operation has a meaningful description
   * @param operation The operation object
   * @param path The path of the operation
   * @param method The HTTP method
   */
  private enhanceOperationDescription(operation: any, path: string, method: string): void {
    // If description is missing or generic, create a better one
    if (
      !operation.description ||
      operation.description === 'Description not available' ||
      operation.description === 'No description available'
    ) {
      const pathSegments = path.split('/').filter((segment) => segment.length > 0);
      const resourceName = pathSegments[pathSegments.length - 1] || '';
      const isDetailEndpoint = path.includes('/{id}') || path.includes('/:id');

      let enhancedDescription = '';

      if (method === 'get') {
        if (isDetailEndpoint) {
          enhancedDescription = `Retrieves detailed information about a specific ${resourceName.replace(/{id}|:id/, '')} resource by its unique identifier.`;
        } else {
          enhancedDescription = `Retrieves a list of ${resourceName} resources, potentially filtered by query parameters.`;
        }
      } else if (method === 'post') {
        if (path.includes('process')) {
          enhancedDescription = `Processes the provided message payload, applying any transformations or business logic required, and returns the processing result.`;
        } else if (path.includes('path') || path.includes('route')) {
          enhancedDescription = `Routes the provided payload to the specified destination and returns the routing result or the destination's response.`;
        } else {
          enhancedDescription = `Creates a new ${resourceName.endsWith('s') ? resourceName.slice(0, -1) : resourceName} resource with the provided information.`;
        }
      } else if (method === 'put') {
        enhancedDescription = `Replaces all properties of an existing ${resourceName.replace(/{id}|:id/, '')} resource with the provided information.`;
      } else if (method === 'patch') {
        enhancedDescription = `Updates specific properties of an existing ${resourceName.replace(/{id}|:id/, '')} resource without modifying unspecified properties.`;
      } else if (method === 'delete') {
        enhancedDescription = `Deletes a specific ${resourceName.replace(/{id}|:id/, '')} resource by its unique identifier.`;
      }

      // Set the enhanced description
      if (enhancedDescription) {
        operation.description = enhancedDescription;
      }
    }
  }

  /**
   * Ensure an operation has meaningful response schemas
   * @param operation The operation object
   * @param path The path of the operation
   * @param method The HTTP method
   */
  private ensureOperationResponses(operation: any, path: string, method: string): void {
    if (!operation.responses) {
      operation.responses = {};
    }

    // Get path resource name for better context
    const pathSegments = path.split('/').filter((segment) => segment.length > 0);
    const resourceName = pathSegments[pathSegments.length - 1] || '';
    const singularName = resourceName.endsWith('s') ? resourceName.slice(0, -1) : resourceName;

    // Ensure success responses have schemas
    Object.entries(operation.responses).forEach(([statusCode, response]: [string, any]) => {
      // Only process success responses (2xx)
      if (!statusCode.startsWith('2')) return;

      // Ensure the response has a description
      if (!response.description || response.description === 'Successful operation') {
        if (statusCode === '200') {
          response.description = `Operation completed successfully`;
        } else if (statusCode === '201') {
          response.description = `Resource created successfully`;
        } else if (statusCode === '204') {
          response.description = `Operation completed without content`;
        }
      }

      // Skip 204 No Content responses
      if (statusCode === '204') return;

      // Ensure the response has content with a schema for 200/201
      if (!response.content) {
        response.content = {
          'application/json': {
            schema: {},
          },
        };
      }

      // Get the schema or create one
      const contentType = Object.keys(response.content)[0] || 'application/json';
      if (!response.content[contentType]) {
        response.content[contentType] = { schema: {} };
      }
      if (!response.content[contentType].schema) {
        response.content[contentType].schema = {};
      }

      const schema = response.content[contentType].schema;

      // If schema is empty, generate a meaningful one based on context
      if (Object.keys(schema).length === 0) {
        if (method === 'get') {
          // Collection endpoint
          if (!path.includes('/{id}') && !path.includes('/:id')) {
            response.content[contentType].schema = {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Unique identifier' },
                  ...this.generatePlaceholderProperties(singularName),
                },
              },
            };
          }
          // Detail endpoint
          else {
            response.content[contentType].schema = {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Unique identifier' },
                ...this.generatePlaceholderProperties(singularName),
              },
            };
          }
        } else if (method === 'post') {
          // For message processors and routers
          if (path.includes('process') || path.includes('message')) {
            response.content[contentType].schema = {
              type: 'object',
              properties: {
                success: { type: 'boolean', description: 'Whether processing was successful' },
                processedAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Time of processing',
                },
                result: { type: 'object', description: 'Processing result data' },
                messageId: { type: 'string', description: 'ID of the processed message' },
              },
            };
          } else if (path.includes('path') || path.includes('route')) {
            response.content[contentType].schema = {
              type: 'object',
              properties: {
                success: { type: 'boolean', description: 'Whether routing was successful' },
                destination: { type: 'string', description: 'Final destination of the request' },
                response: { type: 'object', description: 'Response from the destination service' },
              },
            };
          }
          // For resource creation
          else {
            response.content[contentType].schema = {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Unique identifier of the created resource' },
                ...this.generatePlaceholderProperties(singularName),
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Creation timestamp',
                },
              },
            };
          }
        } else if (method === 'put' || method === 'patch') {
          response.content[contentType].schema = {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Unique identifier' },
              ...this.generatePlaceholderProperties(singularName),
              updatedAt: {
                type: 'string',
                format: 'date-time',
                description: 'Last update timestamp',
              },
            },
          };
        }
      }
    });

    // Ensure there's at least one error response
    if (
      !Object.keys(operation.responses).some(
        (statusCode) => statusCode.startsWith('4') || statusCode.startsWith('5'),
      )
    ) {
      operation.responses['400'] = {
        description: 'Bad request - invalid input',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string', description: 'Error message' },
                details: { type: 'array', description: 'Error details', items: { type: 'string' } },
              },
            },
          },
        },
      };
    }
  }

  /**
   * Generate placeholder properties based on resource name
   * @param resourceName The name of the resource
   * @returns Object with placeholder properties
   */
  private generatePlaceholderProperties(resourceName: string): any {
    // Common property patterns based on resource name
    if (resourceName === 'user' || resourceName === 'customer' || resourceName === 'client') {
      return {
        name: { type: 'string', description: 'User name' },
        email: { type: 'string', format: 'email', description: 'User email address' },
        role: { type: 'string', description: 'User role' },
        createdAt: { type: 'string', format: 'date-time', description: 'Account creation date' },
      };
    } else if (resourceName === 'product' || resourceName === 'item') {
      return {
        name: { type: 'string', description: 'Product name' },
        description: { type: 'string', description: 'Product description' },
        price: { type: 'number', description: 'Product price' },
        category: { type: 'string', description: 'Product category' },
      };
    } else if (resourceName === 'order' || resourceName === 'transaction') {
      return {
        customerId: { type: 'string', description: 'Customer ID' },
        total: { type: 'number', description: 'Order total amount' },
        status: { type: 'string', description: 'Order status' },
        items: { type: 'array', description: 'Order items', items: { type: 'object' } },
      };
    } else if (resourceName === 'message' || resourceName === 'process') {
      return {
        content: { type: 'string', description: 'Message content' },
        timestamp: { type: 'string', format: 'date-time', description: 'Message timestamp' },
        status: { type: 'string', description: 'Processing status' },
      };
    }

    // Generic properties for unknown resources
    return {
      name: { type: 'string', description: `${resourceName} name` },
      description: { type: 'string', description: `${resourceName} description` },
      createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
      updatedAt: { type: 'string', format: 'date-time', description: 'Last update timestamp' },
    };
  }

  /**
   * Enhance a model schema with better descriptions and property metadata
   * @param modelName The name of the model
   * @param modelSchema The model schema object
   */
  private enhanceModelSchema(modelName: string, modelSchema: any): void {
    // Ensure the model has a description
    if (!modelSchema.description) {
      modelSchema.description = `Represents a ${modelName} entity within the system`;
    }

    // If it's an object type with properties, enhance each property
    if (modelSchema.type === 'object' && modelSchema.properties) {
      Object.entries(modelSchema.properties).forEach(([propName, property]: [string, any]) => {
        // Ensure property has a description
        if (!property.description) {
          property.description = `${propName} of the ${modelName}`;
        }

        // Add formats for common property patterns
        if (propName.includes('email') && !property.format) {
          property.format = 'email';
        } else if (propName.includes('date') && !property.format) {
          property.format = 'date-time';
        } else if (propName.includes('uri') || propName.includes('url')) {
          property.format = 'uri';
        } else if (propName === 'id' || propName.endsWith('Id')) {
          if (!property.description) {
            property.description = `Unique identifier${propName === 'id' ? '' : ` for ${propName.replace('Id', '')}`}`;
          }
        }
      });
    }
  }
}

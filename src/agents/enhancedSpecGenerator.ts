import { SpecGeneratorOptions } from '../types';
import { AIService } from '../services/aiService';
import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, START, END, Annotation, MemorySaver } from '@langchain/langgraph';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

/**
 * Enhanced Agent State for spec generation workflow
 */
interface SpecGenerationAgentState {
  // Input
  rootDir: string;
  options: SpecGeneratorOptions;

  // Repomix Analysis
  codebaseContext: string;
  repoStructure: any;
  packingMetadata: any;

  // AI Analysis Results
  detectedLanguages: string[];
  detectedFrameworks: string[];
  businessDomain: string;

  // API Discovery
  discoveredEndpoints: any[];
  apiPatterns: any[];
  authenticationMethods: string[];

  // Schema Generation
  generatedSchema: any;
  validationResults: any;
  confidence: number;

  // Error Handling
  errors: string[];
  warnings: string[];

  // Processing Status
  currentStep: string;
  stepProgress: number;
  totalSteps: number;
}

/**
 * Enhanced Spec Generator using LangGraph concepts + Repomix
 * This implementation uses a sequential workflow approach inspired by LangGraph
 * but avoids complex typing issues by using a simpler orchestration pattern
 */
export class EnhancedSpecGenerator {
  private aiService: AIService;
  private llm: ChatOpenAI;
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

    this.aiService = new AIService();
    this.llm = new ChatOpenAI({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      temperature: 1, // Use default temperature for compatibility
    });
  }

  /**
   * Execute the complete enhanced spec generation workflow
   * This orchestrates multiple AI agents in sequence, similar to LangGraph
   */
  private async executeWorkflow(
    initialState: SpecGenerationAgentState,
  ): Promise<SpecGenerationAgentState> {
    console.log('🚀 Executing Enhanced Spec Generation Workflow...');

    let currentState = initialState;

    // Step 1: Pack repository with Repomix
    currentState = await this.packRepositoryWithRepomix(currentState);
    if (currentState.errors?.length > 0) return currentState;

    // Step 2: Analyze codebase structure
    currentState = await this.analyzeCodebaseStructure(currentState);
    if (currentState.errors?.length > 0) return currentState;

    // Step 3: Discover API endpoints
    currentState = await this.discoverApiEndpoints(currentState);
    if (currentState.errors?.length > 0) return currentState;

    // Step 4: Generate OpenAPI schema
    currentState = await this.generateOpenApiSchema(currentState);
    if (currentState.errors?.length > 0) return currentState;

    // Step 5: Validate generated schema
    currentState = await this.validateGeneratedSchema(currentState);

    // Step 6: Enhance schema if needed (conditional logic)
    if (currentState.confidence < 0.7 || (currentState.errors?.length || 0) > 0) {
      console.log(
        `⚠️ Low confidence (${currentState.confidence}) or errors detected, enhancing schema...`,
      );
      currentState = await this.enhanceSchemaWithAI(currentState);
    } else {
      console.log(`✅ High confidence (${currentState.confidence}), schema generation complete`);
    }

    return currentState;
  }

  /**
   * Build a LangGraph state graph mirroring the sequential workflow
   * Adds conditional branching to enhancement step and checkpointing support
   */
  private buildLangGraph() {
    try {
      // Define state schema for LangGraph
      const SpecState = Annotation.Root({
        rootDir: Annotation<string>(),
        options: Annotation<any>(),
        codebaseContext: Annotation<string>(),
        repoStructure: Annotation<any>(),
        packingMetadata: Annotation<any>(),
        detectedLanguages: Annotation<string[]>(),
        detectedFrameworks: Annotation<string[]>(),
        businessDomain: Annotation<string>(),
        discoveredEndpoints: Annotation<any[]>(),
        apiPatterns: Annotation<any[]>(),
        authenticationMethods: Annotation<string[]>(),
        generatedSchema: Annotation<any>(),
        validationResults: Annotation<any>(),
        confidence: Annotation<number>(),
        errors: Annotation<string[]>(),
        warnings: Annotation<string[]>(),
        currentStep: Annotation<string>(),
        stepProgress: Annotation<number>(),
        totalSteps: Annotation<number>(),
      });

      const graph = new StateGraph(SpecState)
        .addNode('packRepo', async (s: SpecGenerationAgentState) => {
          return await this.packRepositoryWithRepomix(s);
        })
        .addNode('analyze', async (s: SpecGenerationAgentState) => {
          return await this.analyzeCodebaseStructure(s);
        })
        .addNode('discover', async (s: SpecGenerationAgentState) => {
          return await this.discoverApiEndpoints(s);
        })
        .addNode('generate', async (s: SpecGenerationAgentState) => {
          return await this.generateOpenApiSchema(s);
        })
        .addNode('validate', async (s: SpecGenerationAgentState) => {
          return await this.validateGeneratedSchema(s);
        })
        .addNode('enhance', async (s: SpecGenerationAgentState) => {
          return await this.enhanceSchemaWithAI(s);
        })
        .addEdge(START, 'packRepo')
        .addEdge('packRepo', 'analyze')
        .addEdge('analyze', 'discover')
        .addEdge('discover', 'generate')
        .addEdge('generate', 'validate')
        .addConditionalEdges(
          'validate',
          (s: SpecGenerationAgentState) => (s.confidence && s.confidence >= 0.7 && (!s.errors || s.errors.length === 0) ? END : 'enhance'),
          { enhance: 'enhance', [END]: END },
        )
        .addEdge('enhance', END)
        .compile({ checkpointer: new MemorySaver() });

      return graph;
    } catch (e) {
      console.log('⚠️ Failed to initialize LangGraph workflow, will fallback to sequential:', e);
      return null;
    }
  }

  /**
   * Step 1: Pack repository with Repomix for complete context
   */
  private async packRepositoryWithRepomix(
    state: SpecGenerationAgentState,
  ): Promise<SpecGenerationAgentState> {
    console.log('📦 Repository Packing Agent: Analyzing complete codebase with Repomix...');

    try {
      let content = '';
      let totalFiles = 0;
      let structure = null;

      // Use Repomix via CLI - much more reliable than module import
      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        const timestamp = Date.now();
        const outputFile = `spectra-repo-analysis-${timestamp}.txt`;

        // Build repomix command
        const repomixCmd = [
          'npx repomix',
          `"${state.rootDir}"`,
          '--output',
          `"${outputFile}"`,
          '--style',
          'xml',
          '--include',
          '"**/*.{js,ts,java,kt,py,go,rb,php,cs,json,yaml,yml,md,xml}"',
          '--ignore',
          '"**/node_modules/**,**/dist/**,**/build/**,**/target/**,**/.git/**,**/coverage/**"',
        ].join(' ');

        console.log(`🔄 Running: ${repomixCmd}`);

        // Execute repomix
        const { stdout, stderr } = await execAsync(repomixCmd, {
          cwd: process.cwd(),
          maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large codebases
        });

        if (stderr && !stderr.includes('warn')) {
          console.log('⚠️ Repomix warnings:', stderr);
        }

        // Read the generated file
        if (fs.existsSync(outputFile)) {
          content = fs.readFileSync(outputFile, 'utf-8');

          // Count files from content - try multiple patterns
          const fileMatches =
            content.match(/=== File: /g) ||
            content.match(/<file>/g) ||
            content.match(/File path:/g) ||
            content.match(/##\s+/g);
          totalFiles = fileMatches ? fileMatches.length : 1;

          // Clean up the output file
          fs.unlinkSync(outputFile);

          console.log(`📦 Repomix packed ${totalFiles} files successfully`);
        } else {
          throw new Error('Repomix output file not created');
        }
      } catch (repomixError) {
        console.log('⚠️ Repomix failed, using manual file collection...');
        console.log('Error:', repomixError);
      }

      // Fallback: Manual file collection if Repomix fails
      if (!content) {
        console.log('📁 Collecting files manually...');
        content = await this.collectFilesManually(state.rootDir);
        totalFiles = content.split('\n').filter((line) => line.includes('File:')).length;
      }

      if (!content) {
        throw new Error('Failed to collect codebase content');
      }

      console.log(`✅ Successfully packed repository: ${totalFiles} files`);
      console.log(`📊 Total characters: ${content.length}`);

      return {
        ...state,
        codebaseContext: content,
        repoStructure: structure,
        packingMetadata: {
          totalFiles: totalFiles,
          totalSize: content.length,
          timestamp: new Date().toISOString(),
        },
        currentStep: 'Repository packed with Repomix',
        stepProgress: 1,
        totalSteps: 6,
      };
    } catch (error: any) {
      console.error('❌ Repository packing failed:', error);
      return {
        ...state,
        errors: [...(state.errors || []), `Repository packing failed: ${error.message}`],
        currentStep: 'Repository packing failed',
      };
    }
  }

  /**
   * Step 2: Analyze codebase structure with AI
   */
  private async analyzeCodebaseStructure(
    state: SpecGenerationAgentState,
  ): Promise<SpecGenerationAgentState> {
    console.log('🔍 Codebase Analysis Agent: Understanding project structure and patterns...');

    try {
      const analysisPrompt = `
      Analyze this complete codebase and provide insights:

      CODEBASE CONTENT:
      ${state.codebaseContext}

      Please analyze and provide:
      1. Primary programming languages used (rank by usage)
      2. Web frameworks and libraries detected
      3. API architectural patterns (REST, GraphQL, gRPC, etc.)
      4. Authentication mechanisms implemented
      5. Database technologies and ORM patterns
      6. Business domain and application purpose
      7. Code quality and organization assessment
      8. Security patterns and implementations

      Respond in JSON format:
      {
        "languages": ["primary", "secondary"],
        "frameworks": ["framework1", "framework2"],
        "apiPatterns": ["REST", "GraphQL"],
        "authMethods": ["JWT", "OAuth"],
        "databases": ["MongoDB", "PostgreSQL"],
        "businessDomain": "description of what this application does",
        "codeQuality": "assessment",
        "securityPatterns": ["pattern1", "pattern2"],
        "confidence": 0.95
      }
      `;

      const analysis = await this.llm.invoke([
        { role: 'system', content: 'You are an expert software architect and code analyzer.' },
        { role: 'user', content: analysisPrompt },
      ]);

      let analysisResult;
      try {
        analysisResult = JSON.parse(analysis.content as string);
      } catch {
        // Fallback to extract JSON from response
        const jsonMatch = (analysis.content as string).match(/\{[\s\S]*\}/);
        analysisResult = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      }

      console.log(`🎯 Detected languages: ${analysisResult.languages?.join(', ')}`);
      console.log(`🔧 Detected frameworks: ${analysisResult.frameworks?.join(', ')}`);
      console.log(`🏢 Business domain: ${analysisResult.businessDomain}`);

      return {
        ...state,
        detectedLanguages: analysisResult.languages || [],
        detectedFrameworks: analysisResult.frameworks || [],
        businessDomain: analysisResult.businessDomain || 'Unknown',
        apiPatterns: analysisResult.apiPatterns || [],
        authenticationMethods: analysisResult.authMethods || [],
        currentStep: 'Codebase structure analyzed',
        stepProgress: 2,
        confidence: analysisResult.confidence || 0.8,
      };
    } catch (error: any) {
      console.error('❌ Codebase analysis failed:', error);
      return {
        ...state,
        errors: [...(state.errors || []), `Codebase analysis failed: ${error.message}`],
        currentStep: 'Codebase analysis failed',
      };
    }
  }

  /**
   * Step 3: Discover API endpoints with deep understanding
   */
  private async discoverApiEndpoints(
    state: SpecGenerationAgentState,
  ): Promise<SpecGenerationAgentState> {
    console.log('🎯 API Discovery Agent: Identifying endpoints with business context...');

    try {
      const discoveryPrompt = `
      Based on this complete codebase analysis, discover and extract ALL API endpoints:

      CODEBASE: ${state.codebaseContext}
      
      DETECTED FRAMEWORKS: ${state.detectedFrameworks.join(', ')}
      BUSINESS DOMAIN: ${state.businessDomain}

      For each endpoint found, provide:
      1. HTTP method and complete path
      2. Request parameters and body schema
      3. Response schema and status codes
      4. Authentication requirements
      5. Business purpose and description
      6. Error scenarios and handling
      7. Dependencies and integrations

      Respond in JSON format with array of endpoints:
      {
        "endpoints": [
          {
            "method": "GET",
            "path": "/api/users",
            "summary": "Get all users",
            "description": "Retrieves paginated list of users with filtering",
            "parameters": [
              {"name": "page", "in": "query", "type": "integer", "description": "Page number"}
            ],
            "requestBody": null,
            "responses": {
              "200": {"description": "Success", "schema": {...}},
              "400": {"description": "Bad request"}
            },
            "authentication": "Bearer token required",
            "businessContext": "User management for admin dashboard"
          }
        ],
        "confidence": 0.9
      }
      `;

      const discovery = await this.llm.invoke([
        {
          role: 'system',
          content:
            'You are an expert API architect specialized in endpoint discovery and documentation.',
        },
        { role: 'user', content: discoveryPrompt },
      ]);

      let discoveryResult;
      try {
        discoveryResult = JSON.parse(discovery.content as string);
      } catch {
        const jsonMatch = (discovery.content as string).match(/\{[\s\S]*\}/);
        discoveryResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { endpoints: [] };
      }

      const endpoints = discoveryResult.endpoints || [];
      console.log(`🔍 Discovered ${endpoints.length} API endpoints`);

      endpoints.slice(0, 3).forEach((endpoint: any) => {
        console.log(`  📌 ${endpoint.method} ${endpoint.path} - ${endpoint.summary}`);
      });

      return {
        ...state,
        discoveredEndpoints: endpoints,
        currentStep: `Discovered ${endpoints.length} API endpoints`,
        stepProgress: 3,
        confidence: Math.min(state.confidence, discoveryResult.confidence || 0.8),
      };
    } catch (error: any) {
      console.error('❌ API discovery failed:', error);
      return {
        ...state,
        errors: [...(state.errors || []), `API discovery failed: ${error.message}`],
        currentStep: 'API discovery failed',
      };
    }
  }

  /**
   * Step 4: Generate OpenAPI schema from discovered endpoints
   */
  private async generateOpenApiSchema(
    state: SpecGenerationAgentState,
  ): Promise<SpecGenerationAgentState> {
    console.log('📝 Schema Generation Agent: Creating OpenAPI specification...');

    try {
      const schemaPrompt = `
      Generate a complete OpenAPI 3.0 specification based on:

      BUSINESS DOMAIN: ${state.businessDomain}
      DETECTED FRAMEWORKS: ${state.detectedFrameworks.join(', ')}
      BASE URL: ${state.options.baseUrl}
      
      DISCOVERED ENDPOINTS:
      ${JSON.stringify(state.discoveredEndpoints, null, 2)}

      Create a complete OpenAPI 3.0 spec with:
      1. Proper info section with title, version, description
      2. Servers configuration
      3. All paths with detailed operations
      4. Components with reusable schemas
      5. Security schemes if authentication detected
      6. Proper examples and descriptions

      Respond with ONLY the OpenAPI JSON specification:
      `;

      const schemaGeneration = await this.llm.invoke([
        {
          role: 'system',
          content:
            'You are an expert in OpenAPI specification generation. Generate valid, complete OpenAPI 3.0 specifications.',
        },
        { role: 'user', content: schemaPrompt },
      ]);

      let generatedSchema;
      try {
        generatedSchema = JSON.parse(schemaGeneration.content as string);
      } catch {
        // Try to extract JSON from the response
        const jsonMatch = (schemaGeneration.content as string).match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          generatedSchema = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not parse generated OpenAPI schema');
        }
      }

      // Basic validation
      if (!generatedSchema.openapi || !generatedSchema.info || !generatedSchema.paths) {
        throw new Error('Generated schema is missing required OpenAPI fields');
      }

      console.log(`✅ Generated OpenAPI schema for "${generatedSchema.info.title}"`);
      console.log(`📊 Paths: ${Object.keys(generatedSchema.paths).length}`);
      console.log(
        `🔧 Components: ${Object.keys(generatedSchema.components?.schemas || {}).length} schemas`,
      );

      return {
        ...state,
        generatedSchema,
        currentStep: 'OpenAPI schema generated',
        stepProgress: 4,
      };
    } catch (error: any) {
      console.error('❌ Schema generation failed:', error);
      return {
        ...state,
        errors: [...(state.errors || []), `Schema generation failed: ${error.message}`],
        currentStep: 'Schema generation failed',
      };
    }
  }

  /**
   * Step 5: Validate generated schema
   */
  private async validateGeneratedSchema(
    state: SpecGenerationAgentState,
  ): Promise<SpecGenerationAgentState> {
    console.log('✅ Schema Validation Agent: Validating OpenAPI specification...');

    try {
      const validationResults = {
        isValid: true,
        errors: [] as string[],
        warnings: [] as string[],
        completeness: 0,
        confidence: 0,
      };

      // Basic structural validation
      const schema = state.generatedSchema;

      if (!schema.openapi) validationResults.errors.push('Missing OpenAPI version');
      if (!schema.info?.title) validationResults.errors.push('Missing API title');
      if (!schema.info?.version) validationResults.errors.push('Missing API version');
      if (!schema.paths || Object.keys(schema.paths).length === 0) {
        validationResults.errors.push('No API paths defined');
      }

      // Calculate completeness score
      let completenessScore = 0;
      const totalChecks = 10;

      if (schema.openapi) completenessScore++;
      if (schema.info?.title) completenessScore++;
      if (schema.info?.description) completenessScore++;
      if (schema.servers?.length > 0) completenessScore++;
      if (Object.keys(schema.paths || {}).length > 0) completenessScore++;
      if (schema.components?.schemas && Object.keys(schema.components.schemas).length > 0)
        completenessScore++;
      if (schema.components?.securitySchemes) completenessScore++;
      if (schema.security) completenessScore++;

      // Check if paths have proper operations
      const pathsWithOperations = Object.values(schema.paths || {}).filter((path: any) =>
        Object.keys(path).some((key) => ['get', 'post', 'put', 'delete', 'patch'].includes(key)),
      );
      if (pathsWithOperations.length > 0) completenessScore++;

      // Check for response schemas
      const hasResponseSchemas = Object.values(schema.paths || {}).some((path: any) =>
        Object.values(path).some(
          (operation: any) => operation.responses && Object.keys(operation.responses).length > 0,
        ),
      );
      if (hasResponseSchemas) completenessScore++;

      validationResults.completeness = completenessScore / totalChecks;
      validationResults.confidence = validationResults.completeness;
      validationResults.isValid = validationResults.errors.length === 0;

      if (!validationResults.isValid) {
        console.log(`❌ Schema validation failed with ${validationResults.errors.length} errors`);
        validationResults.errors.forEach((error) => console.log(`  - ${error}`));
      } else {
        console.log(
          `✅ Schema validation passed (${Math.round(validationResults.completeness * 100)}% complete)`,
        );
      }

      return {
        ...state,
        validationResults,
        confidence: validationResults.confidence,
        currentStep: validationResults.isValid
          ? 'Schema validated successfully'
          : 'Schema validation failed',
        stepProgress: 5,
        errors: validationResults.isValid
          ? state.errors
          : [...(state.errors || []), ...validationResults.errors],
      };
    } catch (error: any) {
      console.error('❌ Schema validation error:', error);
      return {
        ...state,
        errors: [...(state.errors || []), `Schema validation error: ${error.message}`],
        currentStep: 'Schema validation error',
        confidence: 0.3,
      };
    }
  }

  /**
   * Step 6: Enhance schema with AI if needed
   */
  private async enhanceSchemaWithAI(
    state: SpecGenerationAgentState,
  ): Promise<SpecGenerationAgentState> {
    console.log('🔧 Schema Enhancement Agent: Improving OpenAPI specification...');

    try {
      const enhancementPrompt = `
      Enhance this OpenAPI specification based on the validation results:

      CURRENT SCHEMA:
      ${JSON.stringify(state.generatedSchema, null, 2)}

      VALIDATION ERRORS:
      ${state.errors?.join('\n')}

      VALIDATION RESULTS:
      ${JSON.stringify(state.validationResults, null, 2)}

      ORIGINAL CODEBASE CONTEXT:
      ${state.codebaseContext.substring(0, 10000)}...

      Please fix all validation errors and enhance the schema with:
      1. Missing required fields
      2. Better descriptions and examples
      3. Proper security definitions
      4. Complete response schemas
      5. Input validation rules
      6. Error response definitions

      Return the complete enhanced OpenAPI specification as JSON:
      `;

      const enhancement = await this.llm.invoke([
        {
          role: 'system',
          content:
            'You are an expert in OpenAPI specification enhancement and validation. Fix all issues and create production-ready API documentation.',
        },
        { role: 'user', content: enhancementPrompt },
      ]);

      let enhancedSchema;
      try {
        enhancedSchema = JSON.parse(enhancement.content as string);
      } catch {
        const jsonMatch = (enhancement.content as string).match(/\{[\s\S]*\}/);
        enhancedSchema = jsonMatch ? JSON.parse(jsonMatch[0]) : state.generatedSchema;
      }

      console.log('✅ Schema enhanced successfully');
      console.log(`📊 Enhanced paths: ${Object.keys(enhancedSchema.paths || {}).length}`);

      return {
        ...state,
        generatedSchema: enhancedSchema,
        currentStep: 'Schema enhanced and ready',
        stepProgress: 6,
        confidence: 0.9,
        errors: [], // Clear errors after enhancement
      };
    } catch (error: any) {
      console.error('❌ Schema enhancement failed:', error);
      return {
        ...state,
        warnings: [...(state.warnings || []), `Schema enhancement failed: ${error.message}`],
        currentStep: 'Schema enhancement failed, using original',
      };
    }
  }

  /**
   * Manual file collection fallback when Repomix is not available
   */
  private async collectFilesManually(rootDir: string): Promise<string> {
    const extensions = [
      'js',
      'ts',
      'java',
      'kt',
      'py',
      'go',
      'rb',
      'php',
      'cs',
      'json',
      'yaml',
      'yml',
      'md',
    ];
    const ignorePatterns = ['node_modules', 'dist', 'build', 'target', '.git', 'coverage'];

    let content = `Repository Analysis: ${rootDir}\n`;
    content += `Timestamp: ${new Date().toISOString()}\n`;
    content += `Generated by: Spectra Enhanced (Manual Collection)\n\n`;

    const walkDir = (dir: string, fileList: string[] = []): string[] => {
      const files = fs.readdirSync(dir);

      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          // Skip ignored directories
          if (!ignorePatterns.some((pattern) => file.includes(pattern))) {
            walkDir(filePath, fileList);
          }
        } else {
          // Check if file has relevant extension
          const ext = path.extname(file).slice(1).toLowerCase();
          if (extensions.includes(ext)) {
            fileList.push(filePath);
          }
        }
      }

      return fileList;
    };

    try {
      const files = walkDir(rootDir).slice(0, 100); // Limit to 100 files total

      console.log(`📁 Found ${files.length} relevant files for manual collection`);

      for (const file of files) {
        try {
          const relativePath = path.relative(rootDir, file);
          const fileContent = fs.readFileSync(file, 'utf-8');

          // Skip very large files
          if (fileContent.length > 100000) {
            content += `\n=== File: ${relativePath} (truncated - too large) ===\n`;
            content += fileContent.substring(0, 10000) + '\n... [truncated] ...\n';
            content += `\n=== End of ${relativePath} ===\n`;
          } else {
            content += `\n=== File: ${relativePath} ===\n`;
            content += fileContent;
            content += `\n=== End of ${relativePath} ===\n`;
          }
        } catch (fileError) {
          console.log(`⚠️ Could not read file: ${file}`);
        }
      }
    } catch (error) {
      console.log(`⚠️ Error during manual file collection: ${error}`);
      content += '\n[Manual file collection failed]\n';
    }

    return content;
  }

  /**
   * Public method to generate OpenAPI spec from codebase
   */
  async generateFromCode(rootDir: string): Promise<any> {
    console.log('🚀 Starting Enhanced Spec Generation (LangGraph workflow) + Repomix...');

    const initialState: SpecGenerationAgentState = {
      rootDir,
      options: this.options,
      codebaseContext: '',
      repoStructure: null,
      packingMetadata: null,
      detectedLanguages: [],
      detectedFrameworks: [],
      businessDomain: '',
      discoveredEndpoints: [],
      apiPatterns: [],
      authenticationMethods: [],
      generatedSchema: null,
      validationResults: null,
      confidence: 0,
      errors: [],
      warnings: [],
      currentStep: 'Initializing',
      stepProgress: 0,
      totalSteps: 6,
    };

    // Try LangGraph first
    const graph = this.buildLangGraph();
    if (graph) {
      try {
        const runId = uuidv4();
        const finalState = (await graph.invoke(initialState, {
          configurable: { thread_id: runId },
        })) as SpecGenerationAgentState;

        console.log('\n🎯 Enhanced Spec Generation Complete (LangGraph)!');
        console.log(`📊 Final confidence: ${Math.round((finalState.confidence || 0) * 100)}%`);
        console.log(`🔍 Discovered endpoints: ${finalState.discoveredEndpoints?.length || 0}`);
        console.log(`⚠️ Warnings: ${finalState.warnings?.length || 0}`);
        console.log(`❌ Errors: ${finalState.errors?.length || 0}`);

        if (finalState.errors?.length > 0) {
          console.log('\nErrors encountered:');
          finalState.errors.forEach((error) => console.log(`  - ${error}`));
        }

        console.log("returning here with langgraph");

        return finalState.generatedSchema || {};
      } catch (err) {
        console.log('⚠️ LangGraph run failed, falling back to sequential workflow:', err);
      }
    }

    // Fallback to existing sequential flow
    console.log('↩️ Falling back to sequential workflow...');
    const finalState = await this.executeWorkflow(initialState);

    console.log('\n🎯 Enhanced Spec Generation Complete!');
    console.log(`📊 Final confidence: ${Math.round((finalState.confidence || 0) * 100)}%`);
    console.log(`🔍 Discovered endpoints: ${finalState.discoveredEndpoints?.length || 0}`);
    console.log(`⚠️ Warnings: ${finalState.warnings?.length || 0}`);
    console.log(`❌ Errors: ${finalState.errors?.length || 0}`);

    if (finalState.errors?.length > 0) {
      console.log('\nErrors encountered:');
      finalState.errors.forEach((error) => console.log(`  - ${error}`));
    }

    return finalState.generatedSchema || {};
  }
}

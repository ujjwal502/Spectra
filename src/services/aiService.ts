import OpenAI from 'openai';
import dotenv from 'dotenv';
import {
  Operation,
  EndpointInfo,
  ModelInfo,
  ApiStructure,
  CodebaseAnalysisResult,
  ResponseInfo,
  PropertyInfo,
  ParameterInfo,
} from '../types';

dotenv.config();

export class AIService {
  private openai: OpenAI;
  private defaultModel: string;
  private largeContextModel: string;
  private defaultTimeout: number;
  private isO4Model: boolean;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Use more cost-efficient models by default
    // GPT-4 models have better reasoning but are more expensive
    // GPT-3.5 models are more cost-efficient but may have lower quality
    this.defaultModel = process.env.OPENAI_MODEL || 'gpt-3.5-turbo'; // More cost-effective
    this.largeContextModel = process.env.OPENAI_LARGE_MODEL || 'gpt-3.5-turbo-16k'; // For large contexts
    this.defaultTimeout = parseInt(process.env.OPENAI_TIMEOUT || '30000', 10); // 30 seconds default

    // Check if using an o4 model that requires special handling
    this.isO4Model = this.defaultModel.includes('o4-') || this.largeContextModel.includes('o4-');

    if (this.isO4Model) {
      console.log('Using o4 model - adjusting parameters for compatibility');
    }
  }

  /**
   * Generate a complete API specification using AI based on codebase analysis
   * @param analysisResult Result of codebase analysis with detected language, framework, etc.
   * @returns AI-enhanced full API structure
   * @throws Error if specification generation fails
   */
  async generateFullApiSpec(analysisResult: CodebaseAnalysisResult): Promise<ApiStructure> {
    try {
      console.log('Using AI to generate complete API specification...');
      console.log('Enhanced AI mode enabled for improved schema generation');

      // Extract basic info from analysis result
      const { detectedLanguage, detectedFramework, apiStructure } = analysisResult;

      // Check if the apiStructure already has sufficient detail
      const hasDetailedEndpoints =
        apiStructure.endpoints.length > 0 &&
        apiStructure.endpoints.some((e) => e.description && e.description.length > 30);

      if (hasDetailedEndpoints) {
        console.log(
          'API structure already has detailed endpoints. Enhancing existing structure...',
        );
      } else {
        console.log('Generating complete API structure from detected routes...');
      }

      // Build the prompt with core code information - let OpenAI determine the domain
      const prompt = this.buildFullApiSpecPrompt(analysisResult);

      // Log the prompt length for debugging
      console.log(`Using prompt with ${prompt.length} characters`);

      // Call the OpenAI API
      const apiResponse = await this.openai.chat.completions.create({
        model: this.largeContextModel,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert API developer specializing in OpenAPI specifications. Your task is to analyze code and generate detailed, accurate, and complete API specifications that follow domain-specific best practices.\n\n' +
              'CRITICAL OUTPUT INSTRUCTIONS:\n' +
              '1. You MUST return ONLY a raw JSON object.\n' +
              '2. DO NOT include any explanation text before or after the JSON.\n' +
              '3. DO NOT use markdown formatting like ```json or ``` backticks around your response.\n' +
              '4. Your entire response must be a valid, parseable JSON object only.\n' +
              '5. Make sure the JSON is complete and not truncated.\n' +
              '6. Check that all JSON objects and arrays are properly closed.\n' +
              '7. Do not include comments in the JSON.\n' +
              '8. All property names must be in double quotes.\n' +
              '9. Start your response with "{" and end with "}" with NO OTHER TEXT.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_completion_tokens: 4000,
        ...(this.isO4Model ? {} : { temperature: 0.2 }),
      });

      // Extract the full API structure from the response
      const response = apiResponse.choices[0]?.message?.content;
      if (!response) {
        throw new Error('Empty response from OpenAI API');
      }

      try {
        // Try to parse the JSON response
        const result = this.extractAndParseJSON(response);

        // Validate that it has the expected structure
        if (!result || typeof result !== 'object') {
          throw new Error('Invalid API structure: response is not a valid object');
        }

        // Validate that it has an endpoints array
        if (!result.endpoints || !Array.isArray(result.endpoints)) {
          throw new Error('Invalid API structure: missing endpoints array');
        }

        console.log(`Generated API spec with ${result.endpoints.length} endpoints`);
        return result;
      } catch (error: any) {
        console.error('Failed to parse OpenAI response:', error.message);
        console.log('Using fallback recovery to create a minimal valid API structure');

        // Create a minimal valid structure using the existing information
        return this.createFallbackApiStructure(apiStructure, response);
      }
    } catch (error) {
      // Log detailed error information
      console.error('API specification generation failed:', error);

      if (error instanceof Error) {
        console.error('Error details:', error.message);
        if (error.stack) {
          console.error('Stack trace:', error.stack);
        }
      }

      // Propagate the error instead of returning a fallback
      throw new Error(
        `Failed to generate API specification: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Create a fallback API structure when parsing fails
   * @param existingStructure The existing API structure from analysis
   * @param openaiResponse The raw response from OpenAI that failed to parse
   * @returns A valid API structure using information from both sources
   */
  private createFallbackApiStructure(
    existingStructure: ApiStructure,
    openaiResponse: string,
  ): ApiStructure {
    console.log('Creating fallback API structure from existing data and partial OpenAI response');

    try {
      // Start with the existing structure
      const fallbackStructure: ApiStructure = {
        name: existingStructure.name || 'API',
        description: existingStructure.description || 'Generated API specification',
        version: '1.0.0',
        basePath: existingStructure.basePath || '/api',
        endpoints: [],
        models: [],
      };

      // Try to extract the API name from the OpenAI response
      const nameMatch = openaiResponse.match(/"name"\s*:\s*"([^"]+)"/);
      if (nameMatch && nameMatch[1]) {
        fallbackStructure.name = nameMatch[1];
      }

      // Try to extract the API description from the OpenAI response
      const descMatch = openaiResponse.match(/"description"\s*:\s*"([^"]+)"/);
      if (descMatch && descMatch[1]) {
        fallbackStructure.description = descMatch[1];
      }

      // Try to extract the API version from the OpenAI response
      const versionMatch = openaiResponse.match(/"version"\s*:\s*"([^"]+)"/);
      if (versionMatch && versionMatch[1]) {
        fallbackStructure.version = versionMatch[1];
      }

      // Try to extract the basePath from the OpenAI response
      const basePathMatch = openaiResponse.match(/"basePath"\s*:\s*"([^"]+)"/);
      if (basePathMatch && basePathMatch[1]) {
        fallbackStructure.basePath = basePathMatch[1];
      }

      // IMPORTANT: Use the existing models from the code analysis
      // This is critical as the models are analyzed directly from the code
      if (existingStructure.models && existingStructure.models.length > 0) {
        console.log(`Using ${existingStructure.models.length} models from code analysis`);

        // Process each model to ensure the properties are in the correct format
        fallbackStructure.models = existingStructure.models.map((model) => {
          // Check if the model properties are properly structured
          if (model.properties && Array.isArray(model.properties)) {
            return model;
          } else if (model.properties && typeof model.properties === 'object') {
            // Convert object properties to array format expected by the spec generator
            const propertyArray = Object.entries(model.properties).map(([name, details]) => {
              return {
                name,
                ...(details as any),
              };
            });

            return {
              ...model,
              properties: propertyArray,
            };
          }

          // Return the model as is if properties are missing
          return model;
        });
      }

      // Try to extract endpoints from the OpenAI response
      // This is more challenging, but we can attempt to extract them from the JSON
      try {
        // Extract endpoints array - look for the patterns in the AI response
        const endpointSection = openaiResponse.match(/"endpoints"\s*:\s*\[([\s\S]*?)\]\s*(?:,|$)/);
        if (endpointSection && endpointSection[1]) {
          // Process endpoint data to extract valid endpoints
          const endpointItems = this.extractEndpointsFromText(endpointSection[1]);
          if (endpointItems.length > 0) {
            console.log(`Extracted ${endpointItems.length} endpoints from the OpenAI response`);
            fallbackStructure.endpoints = endpointItems;
          }
        }
      } catch (endpointError) {
        console.warn('Failed to extract endpoints from OpenAI response:', endpointError);
      }

      // If we still don't have any endpoints, use the ones from the code analysis
      if (
        fallbackStructure.endpoints.length === 0 &&
        existingStructure.endpoints &&
        existingStructure.endpoints.length > 0
      ) {
        console.log(`Using ${existingStructure.endpoints.length} endpoints from code analysis`);
        fallbackStructure.endpoints = existingStructure.endpoints;
      }

      return fallbackStructure;
    } catch (error) {
      console.error('Error creating fallback API structure:', error);

      // As a last resort, just return the existing structure from code analysis
      return {
        ...existingStructure,
        name: existingStructure.name || 'API',
        description:
          existingStructure.description || 'Generated API specification from code analysis',
        version: '1.0.0',
        basePath: existingStructure.basePath || '/api',
      };
    }
  }

  /**
   * Extract endpoints from text/JSON that may be malformed
   * @param text Text containing endpoint information
   * @returns Array of endpoints extracted from the text
   */
  private extractEndpointsFromText(text: string): EndpointInfo[] {
    const endpoints: EndpointInfo[] = [];

    try {
      // Split by endpoint object boundaries
      const endpointBlocks = text.split(/}\s*,\s*{/);

      for (let i = 0; i < endpointBlocks.length; i++) {
        let block = endpointBlocks[i];

        // Add braces if needed
        if (i > 0) block = '{' + block;
        if (i < endpointBlocks.length - 1) block = block + '}';

        try {
          // Try to parse each block as JSON
          const endpoint = JSON.parse(block);

          // Validate required fields
          if (endpoint.path && endpoint.method) {
            endpoints.push({
              path: endpoint.path,
              method: endpoint.method,
              description:
                endpoint.description || `${endpoint.method.toUpperCase()} ${endpoint.path}`,
              parameters: endpoint.parameters || [],
              responses: endpoint.responses || [],
              requestBody: endpoint.requestBody || undefined,
              tags: endpoint.tags || [],
            });
          }
        } catch (blockError) {
          // Extract essential fields using regex if JSON parsing fails
          const pathMatch = block.match(/"path"\s*:\s*"([^"]+)"/);
          const methodMatch = block.match(/"method"\s*:\s*"([^"]+)"/);

          if (pathMatch && methodMatch) {
            const descMatch = block.match(/"description"\s*:\s*"([^"]+)"/);

            endpoints.push({
              path: pathMatch[1],
              method: methodMatch[1],
              description: descMatch
                ? descMatch[1]
                : `${methodMatch[1].toUpperCase()} ${pathMatch[1]}`,
              parameters: [],
              responses: [],
              tags: [],
            });
          }
        }
      }
    } catch (error) {
      console.error('Error processing endpoint blocks:', error);
    }

    return endpoints;
  }

  /**
   * Build prompt for generating a full API specification with enhanced detail
   * @param analysisResult Result of codebase analysis
   * @returns Enhanced prompt for OpenAI
   */
  private buildFullApiSpecPrompt(analysisResult: CodebaseAnalysisResult): string {
    const { detectedLanguage, detectedFramework, apiStructure, parserUsed } = analysisResult;

    let prompt = `Generate a complete and detailed OpenAPI specification for the following codebase:\n\n`;
    prompt += `Language: ${detectedLanguage}\n`;
    prompt += `Framework: ${detectedFramework}\n`;
    prompt += `Parser Used: ${parserUsed}\n\n`;

    if (apiStructure.name) {
      prompt += `API Name: ${apiStructure.name}\n`;
    }

    if (apiStructure.description) {
      prompt += `API Description: ${apiStructure.description}\n`;
    }

    if (apiStructure.basePath) {
      prompt += `Base Path: ${apiStructure.basePath}\n`;
    }

    // Include detected endpoints as a starting point
    if (apiStructure.endpoints && apiStructure.endpoints.length > 0) {
      prompt += `\nDetected Endpoints (${apiStructure.endpoints.length}):\n`;
      for (const endpoint of apiStructure.endpoints) {
        prompt += `- ${endpoint.method.toUpperCase()} ${endpoint.path}`;
        if (endpoint.summary) prompt += `: ${endpoint.summary}`;
        prompt += '\n';

        // Include any parameters that were detected
        if (endpoint.parameters && endpoint.parameters.length > 0) {
          prompt += `  Parameters:\n`;
          for (const param of endpoint.parameters) {
            prompt += `    - ${param.name} (${param.location || 'unknown'}, ${param.required ? 'required' : 'optional'})\n`;
          }
        }
      }
    } else {
      prompt += `\nNo endpoints detected. Please infer likely endpoints based on the language and framework.\n`;
    }

    // Include detected models as a starting point
    if (apiStructure.models && apiStructure.models.length > 0) {
      prompt += `\nDetected Models (${apiStructure.models.length}):\n`;
      for (const model of apiStructure.models) {
        prompt += `- ${model.name}: ${model.description || 'No description'}\n`;

        // Include model properties for better context
        if (model.properties && model.properties.length > 0) {
          prompt += `  Properties:\n`;
          for (const prop of model.properties) {
            prompt += `    - ${prop.name}: ${prop.type}${prop.required ? ' (required)' : ''}\n`;
          }
        }
      }
    }

    prompt += `\nYour task is to create a comprehensive and production-quality API specification. Follow these guidelines:

1. First, analyze the code to identify the domain (e.g., banking, e-commerce, healthcare, messaging, etc.) and adapt the specification to that domain's best practices.

2. DETAILED ENDPOINT DESCRIPTIONS:
   - Provide clear and comprehensive descriptions for each endpoint
   - Explain what the endpoint does, its use cases, and expected behavior
   - Include business context and purpose where possible
   - The description should be useful to developers implementing clients

3. ACCURATE REQUEST BODIES:
   - Create detailed request body schemas for POST, PUT, and PATCH methods
   - Include all necessary fields with appropriate data types
   - Mark required fields correctly
   - Add clear descriptions for each field
   - Include format specifiers where appropriate (e.g., date-time, email, etc.)
   - ENSURE ALL REQUEST BODIES ARE CONTEXT-APPROPRIATE AND DETAILED
   - Use domain-specific field patterns appropriate for the API's purpose

4. COMPLETE RESPONSES:
   - Define all possible response status codes for each endpoint
   - For status code 200/201, provide a detailed response schema
   - Include error responses (400, 401, 403, 404, 500) with appropriate error schemas
   - Each response should have a meaningful description
   - ALL SUCCESS RESPONSES MUST INCLUDE A SCHEMA THAT REFLECTS THE ACTUAL RETURNED DATA
   - Use domain-specific response patterns appropriate for the API's purpose

5. PARAMETERS:
   - Define all path, query, and header parameters
   - Include descriptions that explain the purpose and format of each parameter
   - Mark required parameters appropriately
   - Add format and data type information

6. MODEL DEFINITIONS:
   - Create or refine all data models used in requests and responses
   - Provide clear descriptions for models and their properties
   - Include validation rules (minLength, maxLength, pattern, etc.) when applicable
   - Use enums for fields with a fixed set of possible values
   - Organize properties in a logical order

IMPORTANT NOTES:
- For ${detectedLanguage} with ${detectedFramework}, typical patterns include:
  * Authentication endpoints for user login/registration
  * Resource-specific CRUD operations
  * Versioned API paths with appropriate prefixes
  * Consistent error handling and response formats
${
  detectedFramework === 'Spring Boot' || detectedFramework.includes('Spring')
    ? `
- For Spring Boot applications:
  * Consider standard controller annotations (@RestController, @GetMapping, etc.)
  * Base paths are often defined in application.properties or application.yml
  * Look for service methods to understand business logic`
    : ''
}
${
  detectedFramework === 'Ktor'
    ? `
- For Ktor applications:
  * Look for routing blocks and route definitions
  * Check for authentication/authorization plugins
  * Consider content negotiation settings`
    : ''
}

- DOMAIN-SPECIFIC GUIDANCE:
  * For message processing systems: Include request schemas with payload and metadata fields, response schemas with processing results
  * For routing systems: Include destination, payload, and routing options fields
  * For financial systems: Include proper transaction fields, account references, and secure patterns
  * For e-commerce: Include product details, pricing, inventory, and order management patterns
  * For healthcare: Include patient data with privacy considerations and appointment scheduling patterns
  * For content management: Include content publishing workflow, versioning, and metadata fields

Return the specification in the following JSON format:
{
  "name": "API name",
  "description": "Comprehensive API description",
  "version": "1.0.0",
  "basePath": "/api",
  "endpoints": [
    {
      "path": "/endpoint-path",
      "method": "get|post|put|delete|patch",
      "summary": "Brief summary of the endpoint (1 line)",
      "description": "Detailed description explaining the purpose, behavior and usage",
      "parameters": [
        {
          "name": "paramName",
          "location": "path|query|header|cookie",
          "description": "Detailed parameter description",
          "required": true|false,
          "schema": { 
            "type": "string|number|boolean|object|array",
            "format": "date-time|email|uri|etc",
            "enum": ["value1", "value2"],
            "minimum": 0,
            "maximum": 100
          }
        }
      ],
      "requestBody": {
        "description": "Description of the request body",
        "required": true|false,
        "contentType": "application/json",
        "schema": {
          "type": "object",
          "properties": {
            "propertyName": {
              "type": "string|number|boolean|object|array",
              "description": "Property description",
              "format": "date-time|email|uri|etc"
            }
          },
          "required": ["propertyName1", "propertyName2"]
        }
      },
      "responses": [
        {
          "statusCode": 200,
          "description": "Detailed success response description",
          "contentType": "application/json",
          "schema": {
            "type": "object",
            "properties": {
              "propertyName": {
                "type": "string|number|boolean|object|array",
                "description": "Property description"
              }
            }
          }
        },
        {
          "statusCode": 400,
          "description": "Bad request - detailed error description",
          "contentType": "application/json",
          "schema": {
            "type": "object",
            "properties": {
              "error": { "type": "string", "description": "Error message" },
              "details": { "type": "array", "description": "Error details", "items": { "type": "string" } }
            }
          }
        }
      ],
      "tags": ["resource-name", "feature-area"]
    }
  ],
  "models": [
    {
      "name": "ModelName",
      "description": "Detailed model description",
      "properties": [
        {
          "name": "propertyName",
          "type": "string|number|boolean|object|array",
          "description": "Detailed property description",
          "format": "date-time|email|uri|etc",
          "required": true|false,
          "enum": ["value1", "value2"],
          "pattern": "regex-pattern",
          "minimum": 0,
          "maximum": 100
        }
      ]
    }
  ]
}

=== CRITICAL OUTPUT INSTRUCTIONS ===
1. Return ONLY the JSON object with no additional text
2. DO NOT include any explanation, introduction, or conclusion text
3. DO NOT use markdown code blocks (no \`\`\`json or \`\`\` tags)
4. DO NOT include any text outside the JSON object
5. Return ONLY raw, valid, parseable JSON directly
6. The ENTIRE response must be a valid JSON object that can be parsed with JSON.parse()

Your response should start with "{" and end with "}" with no other text before or after.\n`;

    return prompt;
  }

  /**
   * Generate test scenarios for an API endpoint
   * @param path API endpoint path
   * @param method HTTP method
   * @param operation API operation details
   * @returns Generated test scenarios as string
   */
  async generateTestScenarios(path: string, method: string, operation: Operation): Promise<string> {
    try {
      const prompt = this.buildScenariosPrompt(path, method, operation);

      const response = await Promise.race([
        this.openai.chat.completions.create({
          model: this.defaultModel,
          messages: [
            {
              role: 'system',
              content:
                'You are an API testing expert who writes high-quality Gherkin scenarios. Return only the Gherkin format test scenarios without any explanations, introductions, or additional markdown formatting.',
            },
            { role: 'user', content: prompt },
          ],
          max_completion_tokens: 4000,
          ...(this.isO4Model ? {} : { temperature: 0.7 }),
        }),
        // Add timeout
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(new Error(`OpenAI API timeout after ${this.defaultTimeout / 1000} seconds`)),
            this.defaultTimeout,
          ),
        ),
      ]);

      return response.choices[0]?.message.content || '';
    } catch (error) {
      console.error('Error generating test scenarios with AI:', error);
      return '';
    }
  }

  /**
   * Generate mock data based on schema
   * @param schema JSON schema
   * @param context Additional context about the data
   * @returns Generated mock data
   */
  async generateMockData(schema: any, context: string): Promise<any> {
    try {
      const prompt = this.buildMockDataPrompt(schema, context);

      const response = await Promise.race([
        this.openai.chat.completions.create({
          model: this.defaultModel,
          messages: [
            {
              role: 'system',
              content:
                'You are a data generation expert who creates realistic mock data for testing. IMPORTANT: Return ONLY a valid JSON object with no explanations or markdown formatting. Your entire response must be a parseable JSON object.',
            },
            { role: 'user', content: prompt },
          ],
          max_completion_tokens: 4000,
          ...(this.isO4Model ? {} : { temperature: 0.7 }),
        }),
        // Add timeout
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(new Error(`OpenAI API timeout after ${this.defaultTimeout / 1000} seconds`)),
            this.defaultTimeout,
          ),
        ),
      ]);

      const resultText = response.choices[0]?.message.content || '';

      // Extract JSON from the response text (handle cases where the model adds explanations)
      return this.extractAndParseJSON(resultText);
    } catch (error) {
      console.error('Error generating mock data with AI:', error);
      return null;
    }
  }

  /**
   * Build prompt for generating test scenarios
   * @param path API endpoint path
   * @param method HTTP method
   * @param operation API operation details
   * @returns Prompt for OpenAI
   */
  private buildScenariosPrompt(path: string, method: string, operation: Operation): string {
    let prompt = `Generate Gherkin format test scenarios for the following API endpoint:\n\n`;
    prompt += `Path: ${path}\n`;
    prompt += `Method: ${method.toUpperCase()}\n`;

    if (operation.summary) {
      prompt += `Summary: ${operation.summary}\n`;
    }

    if (operation.description) {
      prompt += `Description: ${operation.description}\n`;
    }

    if (operation.parameters && operation.parameters.length > 0) {
      prompt += `\nParameters:\n`;
      for (const param of operation.parameters) {
        prompt += `- ${param.name} (${param.in})${param.required ? ' (required)' : ''}: ${param.description || ''}\n`;
      }
    }

    if (operation.requestBody) {
      prompt += `\nRequest Body: ${operation.requestBody.description || 'Required'}\n`;
    }

    if (operation.responses) {
      prompt += `\nResponse Codes:\n`;
      for (const [code, response] of Object.entries(operation.responses)) {
        prompt += `- ${code}: ${response.description}\n`;
      }
    }

    prompt += `\nPlease generate 2-3 comprehensive test scenarios in Gherkin format that include:
1. Happy path scenarios (successful requests)
2. Error scenarios (validation errors, auth errors, etc.)
3. Edge cases specific to this endpoint

Use this format for each scenario:
Scenario: [Title]
  Given [precondition]
  When [action]
  Then [verification]
  And [additional verification steps]

=== CRITICAL OUTPUT INSTRUCTIONS ===
1. Return ONLY the Gherkin scenarios with no additional text
2. DO NOT include any explanation, introduction, or conclusion text
3. DO NOT add any comments or notes outside the Gherkin format
4. Start your response directly with "Scenario:" for the first scenario
5. Do not include any markdown formatting
6. Do not number your scenarios
7. Do not wrap your response in code blocks\n`;

    return prompt;
  }

  /**
   * Build prompt for generating mock data
   * @param schema JSON schema
   * @param context Additional context about the data
   * @returns Prompt for OpenAI
   */
  private buildMockDataPrompt(schema: any, context: string): string {
    let prompt = `Generate realistic mock data for the following JSON schema:\n\n`;
    prompt += `Schema: ${JSON.stringify(schema, null, 2)}\n\n`;
    prompt += `Context: ${context}\n\n`;

    prompt += `Please generate a valid JSON object that conforms to this schema.
Make the data realistic and contextually appropriate.

=== CRITICAL OUTPUT INSTRUCTIONS ===
1. Return ONLY the JSON object with no additional text
2. DO NOT include any explanation, introduction, or conclusion text
3. DO NOT use markdown code blocks (no \`\`\`json or \`\`\` tags)
4. DO NOT include any text outside the JSON object
5. Return ONLY raw, valid, parseable JSON directly
6. The ENTIRE response must be a valid JSON object that can be parsed with JSON.parse()

Your response should start with "{" and end with "}" with no other text before or after.\n`;

    return prompt;
  }

  /**
   * Extract and parse JSON from text
   * @param text Text potentially containing JSON
   * @returns Parsed JSON object
   * @throws Error if parsing fails
   */
  private extractAndParseJSON(text: string): any {
    if (!text || typeof text !== 'string') {
      console.error('Invalid text input for JSON parsing:', typeof text);
      throw new Error('Invalid response from OpenAI API: empty or non-string response');
    }

    // Log size for debugging
    console.log(`Processing OpenAI response with ${text.length} characters`);

    try {
      // Try to parse the entire text as JSON first
      return JSON.parse(text);
    } catch (e: any) {
      console.log('Initial JSON parsing failed, trying to cleanup response');
      console.log('First parse error:', e.message);

      // Process text to clean up common issues
      let processedText = text.trim();

      // Check if response is in markdown code block format (common with newer models)
      const codeBlockMatch = processedText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        console.log('Found JSON in markdown code block, extracting content');
        processedText = codeBlockMatch[1].trim();

        try {
          return JSON.parse(processedText);
        } catch (codeBlockError: any) {
          console.log('Code block content parsing failed:', codeBlockError.message);
          // Continue with other cleanup methods
        }
      }

      // Remove any markdown code block markers which are common in AI responses
      processedText = processedText.replace(/```(?:json)?\s*/g, '').replace(/\s*```\s*$/g, '');

      // Try to remove any comments which are invalid in JSON
      processedText = processedText.replace(/\/\/.*$/gm, ''); // Remove single-line comments
      processedText = processedText.replace(/\/\*[\s\S]*?\*\//g, '');

      try {
        console.log('Trying to parse after removing comments and code blocks');
        return JSON.parse(processedText);
      } catch (cleanError: any) {
        console.log('JSON parsing failed after basic cleanup:', cleanError.message);
        console.log('First 100 chars:', processedText.substring(0, 100));
        console.log('Last 100 chars:', processedText.substring(processedText.length - 100));

        // Enhanced JSON repair approach
        try {
          // First try to find valid JSON between braces
          const jsonRegex = /{[\s\S]*}/m;
          const match = processedText.match(jsonRegex);

          if (match && match[0]) {
            console.log(`Found JSON-like content (${match[0].length} chars)`);
            try {
              return JSON.parse(match[0]);
            } catch (extractError: any) {
              console.log('Extracted content parsing failed:', extractError.message);

              // More aggressive JSON repair
              const originalJson = match[0];
              let repairedJson = originalJson;

              // Fix unclosed quotes in property names and string values
              repairedJson = this.fixUnclosedStrings(repairedJson);

              // Fix unbalanced braces and brackets
              repairedJson = this.fixUnbalancedBraces(repairedJson);

              // Fix trailing commas
              repairedJson = repairedJson.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

              try {
                console.log('Attempting to parse repaired JSON');
                return JSON.parse(repairedJson);
              } catch (repairError: any) {
                console.log('Repaired JSON parsing failed:', repairError.message);

                // Last resort: try to extract key parts of the JSON structure
                return this.attemptJSONRecovery(processedText);
              }
            }
          } else {
            // No valid JSON found, try the recovery approach
            return this.attemptJSONRecovery(processedText);
          }
        } catch (error) {
          console.error('All JSON extraction attempts failed');
          return this.attemptJSONRecovery(processedText);
        }
      }
    }
  }

  /**
   * Fix unclosed strings in JSON
   * @param json JSON string that may have unclosed strings
   * @returns Fixed JSON string
   */
  private fixUnclosedStrings(json: string): string {
    // Keep track of string state
    let inString = false;
    let stringStart = -1;
    let quoteChar = '';
    let result = '';

    for (let i = 0; i < json.length; i++) {
      const char = json[i];
      const prevChar = i > 0 ? json[i - 1] : '';

      // Handle quotes (start/end of strings)
      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (inString) {
          // If we're in a string and the quote type matches, we're ending a string
          if (char === quoteChar) {
            inString = false;
            quoteChar = '';
          }
        } else {
          // Starting a new string
          inString = true;
          quoteChar = char;
          stringStart = i;
        }
      }

      result += char;
    }

    // If we're still in a string at the end, close it
    if (inString) {
      result += quoteChar;
      console.log(`Fixed unclosed string that started at position ${stringStart}`);
    }

    return result;
  }

  /**
   * Fix unbalanced braces and brackets in JSON
   * @param json JSON string that may have unbalanced braces
   * @returns Fixed JSON string
   */
  private fixUnbalancedBraces(json: string): string {
    let openBraces = 0;
    let openBrackets = 0;

    // Count opening and closing braces/brackets
    for (let i = 0; i < json.length; i++) {
      const char = json[i];

      if (char === '{') openBraces++;
      else if (char === '}') openBraces--;
      else if (char === '[') openBrackets++;
      else if (char === ']') openBrackets--;
    }

    let result = json;

    // Add missing closing braces
    if (openBraces > 0) {
      console.log(`Adding ${openBraces} missing closing braces`);
      result += '}'.repeat(openBraces);
    }

    // Add missing closing brackets
    if (openBrackets > 0) {
      console.log(`Adding ${openBrackets} missing closing brackets`);
      result += ']'.repeat(openBrackets);
    }

    // Handle negative cases (more closing than opening)
    if (openBraces < 0) {
      console.log(`JSON has ${Math.abs(openBraces)} extra closing braces - removing from the end`);
      let count = Math.abs(openBraces);
      let i = result.length - 1;

      while (count > 0 && i >= 0) {
        if (result[i] === '}') {
          result = result.substring(0, i) + result.substring(i + 1);
          count--;
        }
        i--;
      }
    }

    if (openBrackets < 0) {
      console.log(
        `JSON has ${Math.abs(openBrackets)} extra closing brackets - removing from the end`,
      );
      let count = Math.abs(openBrackets);
      let i = result.length - 1;

      while (count > 0 && i >= 0) {
        if (result[i] === ']') {
          result = result.substring(0, i) + result.substring(i + 1);
          count--;
        }
        i--;
      }
    }

    return result;
  }

  /**
   * Attempt to recover JSON by manually processing the content
   * @param text JSON-like text to recover
   * @returns Parsed JSON object or null if recovery failed
   */
  private attemptJSONRecovery(text: string): any | null {
    console.log('Attempting manual JSON recovery');

    try {
      // Normalize whitespace
      let processed = text.replace(/\s+/g, ' ').trim();

      // Look for valid JSON structure
      if (
        processed.startsWith('{') &&
        (processed.includes('"endpoints"') || processed.includes('"models"'))
      ) {
        console.log('Found API structure with endpoints and models');

        // Extract key parts we need
        const nameMatch = processed.match(/"name"\s*:\s*"([^"]+)"/);
        const descMatch = processed.match(/"description"\s*:\s*"([^"]+)"/);
        const versionMatch = processed.match(/"version"\s*:\s*"([^"]+)"/);
        const basePathMatch = processed.match(/"basePath"\s*:\s*"([^"]+)"/);

        // Create base structure with proper typing
        const recovered: ApiStructure = {
          name: nameMatch ? nameMatch[1] : 'Recovered API',
          description: descMatch ? descMatch[1] : 'Recovered from parsing error',
          version: versionMatch ? versionMatch[1] : '1.0.0',
          basePath: basePathMatch ? basePathMatch[1] : '/api',
          endpoints: [],
          models: [],
        };

        // Extract endpoints using the more robust endpoint extraction method
        const endpointMatch = processed.match(/"endpoints"\s*:\s*\[([\s\S]*?)\]\s*(?:,|$)/);
        if (endpointMatch && endpointMatch[1]) {
          const endpoints = this.extractEndpointsFromText(endpointMatch[1]);
          if (endpoints.length > 0) {
            console.log(`Successfully extracted ${endpoints.length} endpoints from malformed JSON`);
            recovered.endpoints = endpoints;
          }
        }

        // Extract models array using similar approach
        const modelsMatch = processed.match(/"models"\s*:\s*\[([\s\S]*?)\]\s*(?:,|$)/);
        if (modelsMatch && modelsMatch[1]) {
          console.log('Found models section, parsing individually');

          // Extract and process models
          const models = this.extractModelsFromText(modelsMatch[1]);
          if (models.length > 0) {
            console.log(`Successfully extracted ${models.length} models from malformed JSON`);
            recovered.models = models;
          }
        }

        console.log(
          `Created recovered API structure with ${recovered.endpoints.length} endpoints and ${recovered.models.length} models`,
        );
        return recovered;
      }

      return null;
    } catch (error) {
      console.log('JSON recovery failed:', error);
      return null;
    }
  }

  /**
   * Extract model definitions from text that may contain malformed JSON
   * @param text Text containing model definitions
   * @returns Array of models extracted from the text
   */
  private extractModelsFromText(text: string): ModelInfo[] {
    const models: ModelInfo[] = [];

    try {
      // Split by model object boundaries
      const modelBlocks = text.split(/}\s*,\s*{/);

      for (let i = 0; i < modelBlocks.length; i++) {
        let block = modelBlocks[i];

        // Add braces if needed
        if (i > 0) block = '{' + block;
        if (i < modelBlocks.length - 1) block = block + '}';

        try {
          // Try to parse the block as JSON
          const model = JSON.parse(block);

          // Validate required fields
          if (model.name) {
            // Convert properties to correct format
            let properties: PropertyInfo[] = [];

            if (model.properties) {
              if (Array.isArray(model.properties)) {
                // Properties already in array format
                properties = model.properties;
              } else if (typeof model.properties === 'object') {
                // Properties in object format, convert to array
                properties = Object.entries(model.properties).map(([name, details]) => {
                  return {
                    name,
                    type: (details as any).type || 'string', // Ensure type is included
                    ...(details as Record<string, any>),
                  };
                });
              }
            }

            models.push({
              name: model.name,
              description: model.description || `Model for ${model.name}`,
              properties: properties,
            });
          }
        } catch (blockError) {
          // Extract essential fields using regex if JSON parsing fails
          const nameMatch = block.match(/"name"\s*:\s*"([^"]+)"/);
          const descMatch = block.match(/"description"\s*:\s*"([^"]+)"/);

          if (nameMatch) {
            // Try to extract properties section
            const propertiesMatch = block.match(/"properties"\s*:\s*(\{[\s\S]*?\}|\[[\s\S]*?\])/);
            let properties: PropertyInfo[] = [];

            if (propertiesMatch) {
              // Attempt to extract property names and types from the properties section
              const propSection = propertiesMatch[1];
              const propertyNameMatches = propSection.match(/"([^"]+)"\s*:/g);

              if (propertyNameMatches) {
                properties = propertyNameMatches.map((match) => {
                  // Safely extract property name with null check
                  const propNameMatch = match.match(/"([^"]+)"/);
                  const propName = propNameMatch ? propNameMatch[1] : 'unknown';

                  // Try to determine property type
                  let propType = 'string'; // Default type

                  if (propName !== 'unknown') {
                    // Using a safer regex approach to avoid potential null issues
                    const typeRegex = new RegExp(
                      `"${propName}"\\s*:\\s*\\{[^}]*"type"\\s*:\\s*"([^"]+)"`,
                      'i',
                    );
                    const typeMatch = propSection.match(typeRegex);
                    if (typeMatch && typeMatch[1]) {
                      propType = typeMatch[1];
                    }
                  }

                  return {
                    name: propName,
                    type: propType,
                    description: `Property ${propName} of ${nameMatch[1]}`,
                  };
                });
              }
            }

            models.push({
              name: nameMatch[1],
              description: descMatch ? descMatch[1] : `Model for ${nameMatch[1]}`,
              properties: properties,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error processing model blocks:', error);
    }

    return models;
  }
}

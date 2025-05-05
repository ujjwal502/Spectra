import OpenAI from 'openai';
import dotenv from 'dotenv';
import { Operation, EndpointInfo, ModelInfo, ApiStructure, CodebaseAnalysisResult } from '../types';

dotenv.config();

export class AIService {
  private openai: OpenAI;
  private defaultModel: string;
  private largeContextModel: string;
  private defaultTimeout: number;

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
  }

  /**
   * Generate a complete API specification using AI based on codebase analysis
   * @param analysisResult Result of codebase analysis with detected language, framework, etc.
   * @returns AI-enhanced full API structure
   */
  async generateFullApiSpec(analysisResult: CodebaseAnalysisResult): Promise<ApiStructure> {
    try {
      console.log('Using AI to generate complete API specification...');
      
      // Extract basic info from analysis result
      const { detectedLanguage, detectedFramework, apiStructure } = analysisResult;
      
      // Check if the apiStructure already has sufficient detail
      const hasDetailedEndpoints = apiStructure.endpoints.length > 0 && 
        apiStructure.endpoints.some(e => e.description && e.description.length > 30);
      
      if (hasDetailedEndpoints) {
        console.log('API structure already has detailed endpoints. Enhancing existing endpoints...');
        return this.enhanceExistingApiStructure(apiStructure, detectedLanguage, detectedFramework);
      }
      
      // If not, use AI to generate a more complete spec
      console.log('Generating complete API specification from scratch...');
      const prompt = this.buildFullApiSpecPrompt(analysisResult);
      
      // Use large context model for full spec generation
      const response = await Promise.race([
        this.openai.chat.completions.create({
          model: this.largeContextModel,
          messages: [
            {
              role: 'system',
              content: 'You are an API specification expert who can analyze codebases and generate detailed OpenAPI specifications.',
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: 4000,
          temperature: 0.2,
        }),
        // Add timeout
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`OpenAI API timeout after ${this.defaultTimeout/1000} seconds`)), this.defaultTimeout)
        )
      ]);

      const resultText = response.choices[0]?.message.content || '';
      
      try {
        // Extract and parse the AI-generated API structure
        const generatedApiStructure = this.extractAndParseJSON(resultText);
        
        // Merge with original structure to ensure we keep critical information
        const mergedStructure: ApiStructure = {
          name: generatedApiStructure.name || apiStructure.name,
          description: generatedApiStructure.description || apiStructure.description,
          version: generatedApiStructure.version || apiStructure.version || '1.0.0',
          basePath: generatedApiStructure.basePath || apiStructure.basePath,
          endpoints: generatedApiStructure.endpoints || apiStructure.endpoints,
          models: generatedApiStructure.models || apiStructure.models,
        };
        
        console.log(`AI successfully generated API spec with ${mergedStructure.endpoints.length} endpoints`);
        return mergedStructure;
      } catch (parseError) {
        console.error('Failed to parse AI-generated API structure:', parseError);
        
        // Fallback to enhancing the existing structure
        console.log('Falling back to enhancing existing endpoints...');
        return this.enhanceExistingApiStructure(apiStructure, detectedLanguage, detectedFramework);
      }
    } catch (error) {
      console.error('Error generating full API spec with AI:', 
        error instanceof Error ? error.message : error);
      // Return the original structure if AI enhancement fails
      console.log('Returning original API structure due to AI error');
      return analysisResult.apiStructure;
    }
  }

  /**
   * Enhance an existing API structure with better descriptions and details
   * @param apiStructure Original API structure
   * @param language Programming language 
   * @param framework Framework name
   * @returns Enhanced API structure
   */
  private async enhanceExistingApiStructure(
    apiStructure: ApiStructure,
    language: string,
    framework: string
  ): Promise<ApiStructure> {
    // Clone the structure to avoid modifying the original
    const enhancedStructure = JSON.parse(JSON.stringify(apiStructure)) as ApiStructure;
    
    console.log(`Enhancing ${enhancedStructure.endpoints.length} endpoints with AI...`);
    
    // Process endpoints in parallel batches to speed up
    const batchSize = 3; // Process 3 endpoints at a time
    const totalEndpoints = enhancedStructure.endpoints.length;
    
    for (let i = 0; i < totalEndpoints; i += batchSize) {
      const batch = enhancedStructure.endpoints.slice(i, i + batchSize);
      const batchPromises = batch.map(endpoint => 
        this.enhanceEndpoint(endpoint, language, framework)
          .catch(error => {
            console.error(`Error enhancing endpoint ${endpoint.path}:`, error);
            return endpoint; // Return original on error
          })
      );
      
      // Wait for all endpoints in the batch to be processed
      const enhancedBatch = await Promise.all(batchPromises);
      
      // Update the endpoints in the structure
      for (let j = 0; j < enhancedBatch.length; j++) {
        enhancedStructure.endpoints[i + j] = enhancedBatch[j];
      }
      
      console.log(`Enhanced ${Math.min(i + batchSize, totalEndpoints)}/${totalEndpoints} endpoints`);
    }
    
    // Similarly enhance models in parallel batches
    console.log(`Enhancing ${enhancedStructure.models.length} models with AI...`);
    
    const totalModels = enhancedStructure.models.length;
    
    for (let i = 0; i < totalModels; i += batchSize) {
      const batch = enhancedStructure.models.slice(i, i + batchSize);
      const batchPromises = batch.map(model => 
        this.enhanceModel(model, language, framework)
          .catch(error => {
            console.error(`Error enhancing model ${model.name}:`, error);
            return model; // Return original on error
          })
      );
      
      // Wait for all models in the batch to be processed
      const enhancedBatch = await Promise.all(batchPromises);
      
      // Update the models in the structure
      for (let j = 0; j < enhancedBatch.length; j++) {
        enhancedStructure.models[i + j] = enhancedBatch[j];
      }
      
      console.log(`Enhanced ${Math.min(i + batchSize, totalModels)}/${totalModels} models`);
    }
    
    return enhancedStructure;
  }

  /**
   * Build prompt for generating a full API specification
   * @param analysisResult Result of codebase analysis
   * @returns Prompt for OpenAI
   */
  private buildFullApiSpecPrompt(analysisResult: CodebaseAnalysisResult): string {
    const { detectedLanguage, detectedFramework, apiStructure, parserUsed } = analysisResult;
    
    let prompt = `Generate a complete API specification for the following codebase:\n\n`;
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
      }
    } else {
      prompt += `\nNo endpoints detected. Please infer likely endpoints based on the language and framework.\n`;
    }
    
    // Include detected models as a starting point
    if (apiStructure.models && apiStructure.models.length > 0) {
      prompt += `\nDetected Models (${apiStructure.models.length}):\n`;
      for (const model of apiStructure.models) {
        prompt += `- ${model.name}\n`;
      }
    }
    
    prompt += `\nPlease generate a comprehensive API specification with detailed endpoint information. For each endpoint, provide:
1. A clear, concise summary
2. A detailed description of what the endpoint does, its use cases, and any important notes
3. Complete parameter information (path, query, header parameters)
4. Request body information if applicable
5. Detailed response information including status codes and schemas

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
      "summary": "Brief summary",
      "description": "Detailed description",
      "parameters": [
        {
          "name": "paramName",
          "location": "path|query|header|cookie",
          "description": "Parameter description",
          "required": true|false,
          "schema": { "type": "string|number|boolean|object|array" }
        }
      ],
      "responses": [
        {
          "statusCode": 200,
          "description": "Success response description",
          "contentType": "application/json"
        },
        {
          "statusCode": 400,
          "description": "Error response description"
        }
      ]
    }
  ],
  "models": [
    {
      "name": "ModelName",
      "description": "Model description",
      "properties": [
        {
          "name": "propertyName",
          "type": "string|number|boolean|object|array",
          "description": "Property description",
          "required": true|false
        }
      ]
    }
  ]
}

Return ONLY the JSON object with no additional text.\n`;

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
              content: 'You are an API testing expert who writes high-quality Gherkin scenarios.',
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: 1000,
          temperature: 0.7,
        }),
        // Add timeout
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`OpenAI API timeout after ${this.defaultTimeout/1000} seconds`)), this.defaultTimeout)
        )
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
                'You are a data generation expert who creates realistic mock data for testing.',
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: 1000,
          temperature: 0.7,
        }),
        // Add timeout
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`OpenAI API timeout after ${this.defaultTimeout/1000} seconds`)), this.defaultTimeout)
        )
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
   * Enhance endpoint information using AI
   * @param endpoint Endpoint to enhance
   * @param language Programming language 
   * @param framework Framework name
   * @returns Enhanced endpoint information
   */
  async enhanceEndpoint(
    endpoint: EndpointInfo,
    language: string, 
    framework: string
  ): Promise<EndpointInfo> {
    try {
      console.log(`Enhancing endpoint ${endpoint.method.toUpperCase()} ${endpoint.path}...`);
      const prompt = this.buildEndpointEnhancementPrompt(endpoint, language, framework);

      const response = await Promise.race([
        this.openai.chat.completions.create({
          model: this.defaultModel,
          messages: [
            {
              role: 'system',
              content: 'You are an expert API documentation writer. You create detailed, accurate API specifications in JSON format. Your JSON is always valid, with correct syntax, no trailing commas, and proper quotes. Your responses are ONLY the JSON object with no explanations.',
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: 1000,
          temperature: 0.3,
        }),
        // Add timeout
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`OpenAI API timeout after ${this.defaultTimeout/1000} seconds`)), this.defaultTimeout)
        )
      ]);

      const resultText = response.choices[0]?.message.content || '';
      
      // Try to extract and parse the JSON
      let parsedResult;
      try {
        parsedResult = this.extractAndParseJSON(resultText);
        console.log(`Successfully enhanced endpoint ${endpoint.method.toUpperCase()} ${endpoint.path}`);
      } catch (parseError) {
        console.error(`Error parsing AI response for endpoint ${endpoint.path}:`, parseError);
        // Create a basic structure with any extractable information
        parsedResult = this.createPlaceholderFromText(resultText);
      }

      // Return enhanced endpoint
      return {
        ...endpoint,
        ...parsedResult
      };
    } catch (error) {
      console.error(`Error enhancing endpoint ${endpoint.method} ${endpoint.path}:`, 
        error instanceof Error ? error.message : error);
      // Return original endpoint if enhancement fails
      return endpoint; 
    }
  }

  /**
   * Enhance model information using AI
   * @param model Model to enhance
   * @param language Programming language
   * @param framework Framework name
   * @returns Enhanced model information
   */
  async enhanceModel(
    model: ModelInfo,
    language: string,
    framework: string
  ): Promise<ModelInfo> {
    try {
      console.log(`Enhancing model ${model.name}...`);
      const prompt = this.buildModelEnhancementPrompt(model, language, framework);

      const response = await Promise.race([
        this.openai.chat.completions.create({
          model: this.defaultModel,
          messages: [
            {
              role: 'system',
              content: 'You are a data modeling expert who can provide detailed information about data models.',
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: 1000,
          temperature: 0.3,
        }),
        // Add timeout
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`OpenAI API timeout after ${this.defaultTimeout/1000} seconds`)), this.defaultTimeout)
        )
      ]);

      const resultText = response.choices[0]?.message.content || '';
      console.log(`Successfully enhanced model ${model.name}`);

      // Extract enhanced model information as JSON
      return {
        ...model,
        ...this.extractAndParseJSON(resultText)
      };
    } catch (error) {
      console.error(`Error enhancing model ${model.name}:`, 
        error instanceof Error ? error.message : error);
      return model; // Return original model if enhancement fails
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

Be specific about required parameters, request body structure, and expected response.
DO NOT include any explanation text, only the Gherkin scenarios.\n`;

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
Return ONLY the JSON object with NO additional text or explanations.\n`;

    return prompt;
  }

  /**
   * Build prompt for enhancing endpoint information
   * @param endpoint Endpoint to enhance
   * @param language Programming language
   * @param framework Framework name
   * @returns Prompt for OpenAI
   */
  private buildEndpointEnhancementPrompt(
    endpoint: EndpointInfo,
    language: string,
    framework: string
  ): string {
    let prompt = `Enhance the following API endpoint information with better descriptions, parameter details, and response information:\n\n`;
    prompt += `Endpoint: ${endpoint.method.toUpperCase()} ${endpoint.path}\n`;
    prompt += `Programming Language: ${language}\n`;
    prompt += `Framework: ${framework}\n\n`;
    
    if (endpoint.summary) {
      prompt += `Current Summary: ${endpoint.summary}\n`;
    }
    
    if (endpoint.description) {
      prompt += `Current Description: ${endpoint.description}\n`;
    }
    
    if (endpoint.parameters && endpoint.parameters.length > 0) {
      prompt += `\nCurrent Parameters:\n`;
      for (const param of endpoint.parameters) {
        prompt += `- ${param.name} (${param.location})${param.required ? ' (required)' : ''}: ${param.description || '[No description]'}\n`;
      }
    }
    
    if (endpoint.responses && endpoint.responses.length > 0) {
      prompt += `\nCurrent Responses:\n`;
      for (const response of endpoint.responses) {
        prompt += `- ${response.statusCode}: ${response.description || '[No description]'}\n`;
      }
    }
    
    prompt += `\nPlease provide an improved version of this endpoint information using this exact JSON format without any deviations:

{
  "summary": "Brief summary of what this endpoint does",
  "description": "Detailed description of the endpoint functionality, use cases, and any important notes",
  "parameters": [
    {
      "name": "parameterName",
      "location": "path",
      "description": "Detailed description of the parameter",
      "required": true
    }
  ],
  "responses": [
    {
      "statusCode": 200,
      "description": "Detailed description of the success response",
      "contentType": "application/json"
    }
  ]
}

EXTREMELY IMPORTANT: Your response must be valid JSON that matches the exact structure shown above.
- Do not include any text before or after the JSON
- Ensure all quotation marks around keys and string values use double quotes (")
- Ensure all properties and array elements have proper commas between them
- Ensure the response can be directly parsed using JSON.parse()
- Don't include any explanation, just return the JSON object

For parameters: If there are no parameters, return an empty array [].
For responses: Always include at least one response (e.g., 200 OK).`;

    return prompt;
  }

  /**
   * Build prompt for enhancing model information
   * @param model Model to enhance
   * @param language Programming language
   * @param framework Framework name
   * @returns Prompt for OpenAI
   */
  private buildModelEnhancementPrompt(
    model: ModelInfo,
    language: string,
    framework: string
  ): string {
    let prompt = `Enhance the following data model information with better descriptions and property details:\n\n`;
    prompt += `Model Name: ${model.name}\n`;
    prompt += `Programming Language: ${language}\n`;
    prompt += `Framework: ${framework}\n\n`;
    
    if (model.description) {
      prompt += `Current Description: ${model.description}\n`;
    }
    
    if (model.properties && model.properties.length > 0) {
      prompt += `\nCurrent Properties:\n`;
      for (const prop of model.properties) {
        prompt += `- ${prop.name} (${prop.type})${prop.required ? ' (required)' : ''}: ${prop.description || '[No description]'}\n`;
      }
    }
    
    prompt += `\nPlease provide an improved version of this model information using this exact JSON format without any deviations:

{
  "description": "Detailed description of what this model represents, its purpose and usage",
  "properties": [
    {
      "name": "propertyName",
      "type": "string",
      "description": "Detailed description of the property",
      "required": true
    }
  ]
}

EXTREMELY IMPORTANT: Your response must be valid JSON that matches the exact structure shown above.
- Do not include any text before or after the JSON
- Ensure all quotation marks around keys and string values use double quotes (")
- Ensure all properties and array elements have proper commas between them
- Ensure the response can be directly parsed using JSON.parse()
- Don't include any explanation, just return the JSON object

For properties: If there are no properties, return an empty array [].`;

    return prompt;
  }

  /**
   * Extract and parse JSON from text
   * @param text Text potentially containing JSON
   * @returns Parsed JSON object or null
   */
  private extractAndParseJSON(text: string): any {
    try {
      // Try to parse the entire text as JSON first
      return JSON.parse(text);
    } catch (e) {
      // If that fails, try more extensive cleaning and extraction methods
      try {
        // Pre-process the text to make JSON extraction more reliable
        let processedText = text.trim();
        
        // Remove any markdown code block markers
        processedText = processedText.replace(/```(?:json)?\s*/g, '').replace(/\s*```\s*$/g, '');
        
        // Try direct JSON parsing again after basic cleanup
        try {
          return JSON.parse(processedText);
        } catch (cleanError) {
          // Continue with more advanced extraction
        }
        
        // More robust JSON extraction - find content between outermost braces
        const jsonRegex = /{[\s\S]*}/m;
        const match = processedText.match(jsonRegex);

        if (match && match[0]) {
          const potentialJson = match[0];
          try {
            return JSON.parse(potentialJson);
          } catch (innerError) {
            // Try to clean the JSON by removing common issues
            const cleanedJson = this.cleanJsonString(potentialJson);
            try {
              return JSON.parse(cleanedJson);
            } catch (cleanError) {
              // Try even more aggressive cleaning
              const aggressiveCleanedJson = this.aggressiveJsonCleaning(cleanedJson);
              try {
                return JSON.parse(aggressiveCleanedJson);
              } catch (aggressiveError) {
                // Try extreme JSON reconstruction as a last resort
                const reconstructedJson = this.reconstructJson(potentialJson);
                return JSON.parse(reconstructedJson);
              }
            }
          }
        }
      } catch (e2) {
        // Suppressing detailed error logging here as it's expected with gpt-3.5-turbo
        console.error('Failed to parse AI-generated data');
      }

      // If all attempts fail, create a simplified structure based on the original text
      return this.createPlaceholderFromText(text);
    }
  }

  /**
   * Extreme JSON reconstruction - completely rebuilds the JSON object from scratch
   * This is a last resort when all other parsing attempts fail
   * @param text The text to reconstruct as JSON
   * @returns Reconstructed JSON string
   */
  private reconstructJson(text: string): string {
    // Extract key info using regex patterns
    const summaryMatch = text.match(/"summary"\s*:\s*"([^"]*)"/);
    const descriptionMatch = text.match(/"description"\s*:\s*"([^"]*)"/);
    
    // Extract parameters by looking for patterns
    const parameters: any[] = [];
    const paramRegex = /"name"\s*:\s*"([^"]*)"/g;
    const paramMatches = text.matchAll(paramRegex);
    
    for (const match of paramMatches) {
      if (match[1]) {
        parameters.push({
          name: match[1],
          location: "path", // Default
          description: `Parameter ${match[1]}`,
          required: false
        });
      }
    }
    
    // Build a simple valid response
    const result = {
      summary: summaryMatch ? summaryMatch[1] : "API endpoint",
      description: descriptionMatch ? descriptionMatch[1] : "API endpoint description",
      parameters: parameters,
      responses: [
        {
          statusCode: 200,
          description: "Successful operation",
          contentType: "application/json"
        }
      ]
    };
    
    return JSON.stringify(result);
  }

  /**
   * Creates a simple placeholder object based on text content
   * This is a last resort when JSON parsing fails completely
   * @param text Text to extract information from
   */
  private createPlaceholderFromText(text: string): any {
    const result: any = {};
    
    // Try to extract summary if present
    const summaryMatch = text.match(/summary["\s:]+([^"]+)/i);
    if (summaryMatch && summaryMatch[1]) {
      result.summary = summaryMatch[1].trim();
    } else {
      result.summary = "API Endpoint";
    }
    
    // Try to extract description if present
    const descMatch = text.match(/description["\s:]+([^"]+)/i);
    if (descMatch && descMatch[1]) {
      result.description = descMatch[1].trim();
    } else if (text.length > 10) {
      // Take first 100 chars as description
      result.description = text.substring(0, Math.min(100, text.length)) + '...';
    } else {
      result.description = "Description not available";
    }
    
    // Create minimal valid structure for parameters and responses
    result.parameters = [];
    result.responses = [
      {
        statusCode: 200,
        description: "Successful operation",
        contentType: "application/json"
      }
    ];
    
    return result;
  }

  /**
   * More aggressive JSON cleaning for problematic AI outputs
   * @param jsonString Partially cleaned JSON string
   * @returns More aggressively cleaned JSON string
   */
  private aggressiveJsonCleaning(jsonString: string): string {
    // Start with regular cleaning
    let cleaned = this.cleanJsonString(jsonString);
    
    // Remove all newlines and extra spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Fix common issues with quotation marks
    cleaned = cleaned.replace(/(['"])([a-zA-Z0-9_]+)(['"])(\s*:)/g, '"$2"$4'); // Normalize property names
    cleaned = cleaned.replace(/:\s*(['"])([^'"]*?)(['"])([\s,}])/g, ': "$2"$4'); // Normalize string values
    
    // Fix missing quotes around property names
    cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');
    
    // Fix common trailing comma issues
    cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
    
    // Add missing commas between properties
    cleaned = cleaned.replace(/"\s*}\s*"/g, '", "');
    cleaned = cleaned.replace(/"\s*{\s*"/g, '", {"');
    cleaned = cleaned.replace(/true\s*"/g, 'true, "');
    cleaned = cleaned.replace(/false\s*"/g, 'false, "');
    cleaned = cleaned.replace(/"\s*{/g, '", {');
    cleaned = cleaned.replace(/}\s*"/g, '}, "');
    cleaned = cleaned.replace(/]\s*"/g, '], "');
    cleaned = cleaned.replace(/"\s*\[/g, '", [');
    
    // Fix unclosed objects and arrays
    const openBraces = (cleaned.match(/{/g) || []).length;
    const closeBraces = (cleaned.match(/}/g) || []).length;
    if (openBraces > closeBraces) {
      cleaned = cleaned + '}'.repeat(openBraces - closeBraces);
    }
    
    const openBrackets = (cleaned.match(/\[/g) || []).length;
    const closeBrackets = (cleaned.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) {
      cleaned = cleaned + ']'.repeat(openBrackets - closeBrackets);
    }
    
    // Remove any trailing characters after the last closing brace/bracket
    cleaned = cleaned.replace(/}[^}]*$/, '}');
    cleaned = cleaned.replace(/\][^\]]*$/, ']');
    
    // Fix missing commas in arrays of objects
    cleaned = cleaned.replace(/}(\s*){/g, '}, {');
    
    // Fix trailing commas in array/object
    cleaned = cleaned.replace(/,(\s*)(}|\])/g, '$1$2');
    
    return cleaned;
  }

  /**
   * Clean JSON string to fix common issues in AI-generated JSON
   * @param jsonString The potentially malformed JSON string
   * @returns Cleaned JSON string
   */
  private cleanJsonString(jsonString: string): string {
    // Remove trailing commas before closing brackets
    let cleaned = jsonString.replace(/,\s*([\]}])/g, '$1');
    
    // Fix unclosed quotes
    const openQuotes = (cleaned.match(/"/g) || []).length;
    if (openQuotes % 2 !== 0) {
      // Add closing quote to the last property if needed
      cleaned = cleaned.replace(/([^"])}\s*$/, '$1"}');
    }

    // Fix missing colons
    cleaned = cleaned.replace(/"([^"]+)"\s+"/g, '"$1": "');
    
    // Fix property values without quotes when they should have them
    cleaned = cleaned.replace(/"([^"]+)":\s*([^",\d\{\}\[\]true|false|null][^",\{\}\[\]\s]*)\s*([,}])/g, '"$1": "$2"$3');
    
    // Fix extra commas
    cleaned = cleaned.replace(/,\s*,/g, ',');
    
    // Remove control characters that can break JSON
    cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    
    // Add missing commas between different data types
    cleaned = cleaned.replace(/"\s*{/g, '", {');
    cleaned = cleaned.replace(/}\s*"/g, '}, "');
    cleaned = cleaned.replace(/"\s*\[/g, '", [');
    cleaned = cleaned.replace(/]\s*"/g, '], "');
    
    return cleaned;
  }
}

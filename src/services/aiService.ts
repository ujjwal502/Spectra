import OpenAI from 'openai';
import dotenv from 'dotenv';
import { Operation } from '../types';

dotenv.config();

export class AIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
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

      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an API testing expert who writes high-quality Gherkin scenarios.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

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

      console.log('model used', process.env.OPENAI_MODEL);

      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4',
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
      });

      const resultText = response.choices[0]?.message.content || '';

      // Extract JSON from the response text (handle cases where the model adds explanations)
      return this.extractAndParseJSON(resultText);
    } catch (error) {
      console.error('Error generating mock data with AI:', error);
      return null;
    }
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
      // If that fails, try to extract JSON using regex
      try {
        const jsonRegex = /{[\s\S]*}|^\[[\s\S]*\]$/m;
        const match = text.match(jsonRegex);

        if (match && match[0]) {
          return JSON.parse(match[0]);
        }
      } catch (e2) {
        console.error('Failed to parse AI-generated mock data:', e2);
      }

      // If all attempts fail, return a simple placeholder
      console.error('Failed to extract JSON from AI response, returning placeholder');
      return {};
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
}

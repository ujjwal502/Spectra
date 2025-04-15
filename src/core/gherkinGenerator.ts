import { GherkinFeature, GherkinScenario, GherkinStep, Operation } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { AIService } from '../services/aiService';

export class GherkinGenerator {
  private aiService: AIService | null = null;

  constructor(useAI: boolean = false) {
    if (useAI) {
      this.aiService = new AIService();
    }
  }

  /**
   * Generate a Gherkin feature from an API operation
   * @param path API endpoint path
   * @param method HTTP method
   * @param operation API operation details
   * @returns Generated Gherkin feature
   */
  async generateFeature(
    path: string,
    method: string,
    operation: Operation,
  ): Promise<GherkinFeature> {
    const title = operation.summary || `${method.toUpperCase()} ${path}`;
    const description = operation.description || '';

    // Try to generate scenarios with AI if enabled
    if (this.aiService) {
      try {
        const aiGeneratedScenarios = await this.generateScenariosWithAI(path, method, operation);
        if (aiGeneratedScenarios.length > 0) {
          return {
            title,
            description,
            scenarios: aiGeneratedScenarios,
          };
        }
      } catch (error) {
        console.warn(
          'Failed to generate scenarios with AI, falling back to standard generation:',
          error,
        );
      }
    }

    // Fallback to standard scenario generation
    const scenarios: GherkinScenario[] = [
      this.generateHappyPathScenario(path, method, operation),
      ...this.generateErrorScenarios(path, method, operation),
    ];

    return {
      title,
      description,
      scenarios,
    };
  }

  /**
   * Generate test scenarios using AI
   * @param path API endpoint path
   * @param method HTTP method
   * @param operation API operation details
   * @returns Array of generated scenarios
   */
  private async generateScenariosWithAI(
    path: string,
    method: string,
    operation: Operation,
  ): Promise<GherkinScenario[]> {
    if (!this.aiService) {
      return [];
    }

    // Generate scenarios text with AI
    const scenariosText = await this.aiService.generateTestScenarios(path, method, operation);
    if (!scenariosText) {
      return [];
    }

    try {
      // Parse the AI-generated scenarios using basic text parsing
      return this.parseGherkinScenarios(scenariosText);
    } catch (error) {
      console.error('Failed to parse AI-generated scenarios:', error);
      return [];
    }
  }

  /**
   * Parse Gherkin scenarios from text
   * @param scenariosText Gherkin scenarios text
   * @returns Array of scenarios
   */
  private parseGherkinScenarios(scenariosText: string): GherkinScenario[] {
    const scenarios: GherkinScenario[] = [];
    const lines = scenariosText.split('\n').map((line) => line.trim());

    let currentScenario: GherkinScenario | null = null;
    let currentTags: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip empty lines
      if (!line) continue;

      // Handle tags
      if (line.startsWith('@')) {
        currentTags = line.split(' ').map((tag) => tag.substring(1));
        continue;
      }

      // Handle scenario
      if (line.startsWith('Scenario:')) {
        // Save previous scenario if exists
        if (currentScenario) {
          scenarios.push(currentScenario);
        }

        // Create new scenario
        currentScenario = {
          title: line.substring('Scenario:'.length).trim(),
          steps: [],
          tags: [...currentTags],
        };

        // Reset tags
        currentTags = [];
        continue;
      }

      // Handle steps
      if (
        currentScenario &&
        (line.startsWith('Given ') ||
          line.startsWith('When ') ||
          line.startsWith('Then ') ||
          line.startsWith('And ') ||
          line.startsWith('But '))
      ) {
        const keywordMatch = /^(Given|When|Then|And|But)\s+(.+)$/.exec(line);
        if (keywordMatch) {
          const keyword = keywordMatch[1] as 'Given' | 'When' | 'Then' | 'And' | 'But';
          const text = keywordMatch[2];

          currentScenario.steps.push({
            keyword,
            text,
          });
        }
      }
    }

    // Add the last scenario if exists
    if (currentScenario) {
      scenarios.push(currentScenario);
    }

    return scenarios;
  }

  /**
   * Generate a happy path scenario for an API operation
   * @param path API endpoint path
   * @param method HTTP method
   * @param operation API operation details
   * @returns Generated Gherkin scenario
   */
  private generateHappyPathScenario(
    path: string,
    method: string,
    operation: Operation,
  ): GherkinScenario {
    const steps: GherkinStep[] = [];
    const scenarioTitle = `Successful ${method.toUpperCase()} request to ${path}`;

    // Add Given step for request setup
    steps.push({
      keyword: 'Given',
      text: `the API endpoint ${path}`,
    });

    // Handle parameters if present
    if (operation.parameters && operation.parameters.length > 0) {
      const pathParams = operation.parameters.filter((param) => param.in === 'path');
      const queryParams = operation.parameters.filter((param) => param.in === 'query');
      const headerParams = operation.parameters.filter((param) => param.in === 'header');

      if (pathParams.length > 0) {
        steps.push({
          keyword: 'And',
          text: `path parameters: ${pathParams.map((p) => p.name).join(', ')}`,
        });
      }

      if (queryParams.length > 0) {
        steps.push({
          keyword: 'And',
          text: `query parameters: ${queryParams.map((p) => p.name).join(', ')}`,
        });
      }

      if (headerParams.length > 0) {
        steps.push({
          keyword: 'And',
          text: `request headers: ${headerParams.map((p) => p.name).join(', ')}`,
        });
      }
    }

    // Handle request body if present
    if (operation.requestBody) {
      steps.push({
        keyword: 'And',
        text: 'a valid request body',
      });
    }

    // Add When step for making the request
    steps.push({
      keyword: 'When',
      text: `I send a ${method.toUpperCase()} request`,
    });

    // Add Then steps for validating the response
    steps.push({
      keyword: 'Then',
      text: 'the response status code should be 200',
    });

    // Add additional validation steps based on response schema
    if (operation.responses && operation.responses['200']) {
      steps.push({
        keyword: 'And',
        text: 'the response body should match the schema',
      });
    }

    return {
      title: scenarioTitle,
      steps,
      tags: ['positive', 'happy-path'],
    };
  }

  /**
   * Generate error scenarios for an API operation
   * @param path API endpoint path
   * @param method HTTP method
   * @param operation API operation details
   * @returns Array of generated Gherkin scenarios for error cases
   */
  private generateErrorScenarios(
    path: string,
    method: string,
    operation: Operation,
  ): GherkinScenario[] {
    const scenarios: GherkinScenario[] = [];

    // Generate error scenarios for each parameter
    if (operation.parameters) {
      for (const param of operation.parameters) {
        if (param.required) {
          const steps: GherkinStep[] = [];
          const scenarioTitle = `Error when missing required ${param.in} parameter: ${param.name}`;

          steps.push({
            keyword: 'Given',
            text: `the API endpoint ${path}`,
          });

          steps.push({
            keyword: 'And',
            text: `missing required ${param.in} parameter: ${param.name}`,
          });

          steps.push({
            keyword: 'When',
            text: `I send a ${method.toUpperCase()} request`,
          });

          steps.push({
            keyword: 'Then',
            text: 'the response status code should be 400',
          });

          scenarios.push({
            title: scenarioTitle,
            steps,
            tags: ['negative', 'validation'],
          });
        }
      }
    }

    // Generate error scenario for invalid request body
    if (operation.requestBody && operation.requestBody.required) {
      const steps: GherkinStep[] = [];
      const scenarioTitle = `Error when request body is invalid`;

      steps.push({
        keyword: 'Given',
        text: `the API endpoint ${path}`,
      });

      steps.push({
        keyword: 'And',
        text: 'an invalid request body',
      });

      steps.push({
        keyword: 'When',
        text: `I send a ${method.toUpperCase()} request`,
      });

      steps.push({
        keyword: 'Then',
        text: 'the response status code should be 400',
      });

      scenarios.push({
        title: scenarioTitle,
        steps,
        tags: ['negative', 'validation'],
      });
    }

    // Add unauthorized scenario if the API likely requires authentication
    if (
      operation.parameters?.some(
        (p) => p.name.toLowerCase().includes('auth') || p.name === 'Authorization',
      )
    ) {
      const steps: GherkinStep[] = [];
      const scenarioTitle = `Unauthorized access to ${path}`;

      steps.push({
        keyword: 'Given',
        text: `the API endpoint ${path}`,
      });

      steps.push({
        keyword: 'And',
        text: 'invalid or missing authentication',
      });

      steps.push({
        keyword: 'When',
        text: `I send a ${method.toUpperCase()} request`,
      });

      steps.push({
        keyword: 'Then',
        text: 'the response status code should be 401',
      });

      scenarios.push({
        title: scenarioTitle,
        steps,
        tags: ['negative', 'security'],
      });
    }

    return scenarios;
  }

  /**
   * Convert a Gherkin feature to a feature file string
   * @param feature Gherkin feature
   * @returns Feature file content as a string
   */
  featureToString(feature: GherkinFeature): string {
    let content = `Feature: ${feature.title}\n`;

    if (feature.description) {
      content += `  ${feature.description.replace(/\n/g, '\n  ')}\n`;
    }

    content += '\n';

    for (const scenario of feature.scenarios) {
      if (scenario.tags && scenario.tags.length > 0) {
        content += `  @${scenario.tags.join(' @')}\n`;
      }

      content += `  Scenario: ${scenario.title}\n`;

      for (const step of scenario.steps) {
        content += `    ${step.keyword} ${step.text}\n`;
      }

      content += '\n';
    }

    return content;
  }

  /**
   * Generate a unique ID for a test case
   * @returns Unique test case ID
   */
  generateTestId(): string {
    return uuidv4();
  }
}

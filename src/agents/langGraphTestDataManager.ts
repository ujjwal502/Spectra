import { EndpointInfo, SystemMap, TestScenario } from '../types/langGraphTypes';
import { ValidationContext } from '../utils/codeContext';
import { faker } from '@faker-js/faker';

/**
 * Test Data Manager for LangGraph Testing Agent
 * Handles intelligent test data generation and seeding strategies
 */
export class LangGraphTestDataManager {
  private testUsers: any[] = [];
  // Back-end agnostic: avoid domain-specific constants like departments

  constructor() {
    faker.seed(12345);
    this.initializeTestData();
  }

  /**
   * Initialize consistent test data for reliable testing
   * Using Faker with a fixed seed for reproducible data
   */
  private initializeTestData(): void {
    // Keep a small deterministic set of IDs to prefer existing references when helpful
    this.testUsers = [
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ];
  }

  /**
   * Generate intelligent test data based on scenario type and endpoint context
   */
  generateTestData(
    endpoint: EndpointInfo,
    dataType:
      | 'valid'
      | 'invalid'
      | 'unauthorized'
      | 'forbidden'
      | 'not_found'
      | 'invalid_format'
      | 'max_length'
      | 'min_length'
      | 'numeric_boundary'
      | 'missing_required'
      | 'duplicate_email'
      | 'invalid_department',
    systemMap: SystemMap,
    validation?: ValidationContext,
  ): any {
    const testData: any = {};

    for (const param of endpoint.parameters) {
      if (endpoint.path.includes(`{${param.name}}`)) {
        testData[param.name] = this.generateParameterValue(param, dataType);
      }
    }

    if (endpoint.requestBody && endpoint.method !== 'GET') {
      const bodyData = this.generateRequestBodyData(endpoint.requestBody, dataType, validation);
      Object.assign(testData, bodyData);
    }

    return testData;
  }

  /**
   * Generate parameter values with proper context awareness
   */
  private generateParameterValue(param: any, dataType: string): any {
    switch (dataType) {
      case 'valid':
        // Prefer seeded existing ids for path params named id
        if (param.name === 'id') {
          return (this.fakerArrayElement(this.testUsers) as any).id;
        }
        if (param.validValues && param.validValues.length > 0) {
          return param.validValues[0];
        }
        return this.getDefaultValidValue(param);

      case 'not_found':
        // Use out-of-range numeric or sentinel string to encourage 404s where applicable
        if (param.type === 'integer' || param.type === 'number' || param.name === 'id') {
          return 999999;
        }
        if (param.validValues && param.validValues.length > 0) {
          // pick a value outside enum if possible
          return '__nonexistent__';
        }
        return '__nonexistent__';

      case 'invalid_format':
        if (param.name === 'id') {
          return 'invalid_id_format';
        }
        return 'invalid@format!';

      case 'numeric_boundary':
        if (param.type === 'integer') {
          return this.fakerBoolean() ? 1 : 1000;
        }
        return this.getDefaultValidValue(param);

      default:
        // Prefer existing IDs if requested
        if (param.name === 'id') {
          return (this.fakerArrayElement(this.testUsers) as any).id;
        }
        return this.getDefaultValidValue(param);
    }
  }

  // Helpers to proxy through faker for deterministic randomness
  private fakerArrayElement<T>(arr: T[]): T {
    return (faker.helpers.arrayElement as any)(arr);
  }

  private fakerBoolean(): boolean {
    return (faker.datatype.boolean as any)();
  }

  /**
   * Generate request body data with proper validation compliance
   */
  private generateRequestBodyData(requestBody: any, dataType: string, validation?: ValidationContext): any {
    // requestBody here is a simplified SchemaInfo shape: { type, properties, required, examples }
    const schema = requestBody;
    const generated = this.generateFromSchema(schema, dataType);
    return this.applyValidationHints(generated, validation);
  }

  private applyValidationHints(base: any, validation?: ValidationContext): any {
    if (!validation || !validation.rules || validation.rules.length === 0) return base;
    const adjusted = { ...base };
    for (const rule of validation.rules) {
      if (rule.required) {
        Object.keys(adjusted).forEach((k) => {
          if (adjusted[k] === undefined || adjusted[k] === null || adjusted[k] === '') {
            adjusted[k] = 'value';
          }
        });
      }
      if (rule.minLength && typeof adjusted['name'] === 'string') {
        while ((adjusted['name'] as string).length < rule.minLength) {
          adjusted['name'] += 'x';
        }
      }
      if (rule.format === 'email') {
        adjusted['email'] = adjusted['email'] || faker.internet.email().toLowerCase();
        if (typeof adjusted['email'] === 'string' && !adjusted['email'].includes('@')) {
          adjusted['email'] = faker.internet.email().toLowerCase();
        }
      }
    }
    return adjusted;
  }

  /**
   * Generate valid user data for successful test scenarios using Faker
   */
  private generateFromSchema(schema: any, dataType: string): any {
    if (!schema) return {};

    // Prefer example if present and valid for 'valid'
    if (dataType === 'valid' && Array.isArray(schema.examples) && schema.examples.length > 0) {
      return JSON.parse(JSON.stringify(schema.examples[0]));
    }

    if (schema.type === 'object' || schema.properties) {
      const obj: any = {};
      const requiredSet = new Set<string>((schema.required || []) as string[]);

      for (const [key, propSchema] of Object.entries(schema.properties || {})) {
        // For missing_required, skip required fields opportunistically
        if (dataType === 'missing_required' && requiredSet.has(key)) {
          continue;
        }
        obj[key] = this.generateValueForSchema(propSchema, dataType);
      }

      return obj;
    }

    // Fallback for non-object bodies
    return this.generateValueForSchema(schema, dataType);
  }

  private generateValueForSchema(propSchema: any, dataType: string): any {
    if (!propSchema || typeof propSchema !== 'object') return faker.lorem.word();

    const type = propSchema.type || (propSchema.enum ? 'string' : 'string');
    const format = propSchema.format;

    switch (dataType) {
      case 'invalid_format':
        if (format === 'email') return 'invalid@format!';
        if (type === 'integer' || type === 'number') return 'NaN';
        break;
      case 'max_length':
        if (type === 'string') {
          const len = (propSchema.maxLength || 256) + 10;
          return faker.string.alpha(len);
        }
        break;
      case 'min_length':
        if (type === 'string') {
          const min = propSchema.minLength || 2;
          return faker.string.alpha(Math.max(1, min - 1));
        }
        break;
      case 'numeric_boundary':
        if (type === 'integer' || type === 'number') {
          if (typeof propSchema.minimum === 'number') return propSchema.minimum - 1;
          if (typeof propSchema.maximum === 'number') return (propSchema.maximum as number) + 1;
          return this.fakerBoolean() ? -1 : 999999;
        }
        break;
      case 'invalid':
        // Produce type-violating values
        if (type === 'integer' || type === 'number') return 'invalid_number';
        if (type === 'string' && format === 'email') return 'not-an-email';
        if (type === 'boolean') return 'not-a-boolean';
        break;
      case 'duplicate_email':
        // Generic fallback: just return a stable, valid-looking value
        if (format === 'email') return 'existing@example.com';
        break;
      case 'invalid_department':
        // Treat as invalid enum if present
        if (Array.isArray(propSchema.enum) && propSchema.enum.length > 0) return '__INVALID_ENUM__';
        break;
    }

    // VALID or default generation
    if (Array.isArray(propSchema.enum) && propSchema.enum.length > 0) {
      return propSchema.enum[0];
    }

    if (type === 'string') {
      if (format === 'email') return faker.internet.email().toLowerCase();
      if (format === 'uuid') return faker.string.uuid();
      if (format === 'date-time') return new Date().toISOString();
      const min = propSchema.minLength || 3;
      const max = propSchema.maxLength || Math.max(8, min + 4);
      const len = Math.max(min, Math.min(max, 10));
      return faker.string.alpha(len);
    }

    if (type === 'integer') {
      const min = typeof propSchema.minimum === 'number' ? propSchema.minimum : 1;
      const max = typeof propSchema.maximum === 'number' ? propSchema.maximum : Math.max(min + 10, 100);
      return faker.number.int({ min, max });
    }

    if (type === 'number') {
      const min = typeof propSchema.minimum === 'number' ? propSchema.minimum : 1;
      const max = typeof propSchema.maximum === 'number' ? propSchema.maximum : Math.max(min + 10, 100);
      return faker.number.float({ min, max });
    }

    if (type === 'boolean') {
      return faker.datatype.boolean();
    }

    if (type === 'array') {
      const items = propSchema.items || { type: 'string' };
      const count = 1;
      return Array.from({ length: count }, () => this.generateValueForSchema(items, dataType));
    }

    if (type === 'object' || propSchema.properties) {
      return this.generateFromSchema(propSchema, dataType);
    }

    return faker.lorem.word();
  }

  /**
   * Get default valid value for parameter types using Faker
   */
  private getDefaultValidValue(param: any): any {
    switch (param.type) {
      case 'string':
        if (param.format === 'email') return faker.internet.email().toLowerCase();
        return faker.string.alpha(8);
      case 'integer':
      case 'number':
        if (param.name === 'id') return faker.number.int({ min: 1, max: 1000 });
        return faker.number.int({ min: 1, max: 100 });
      case 'boolean':
        return faker.datatype.boolean();
      default:
        return faker.string.alpha(8);
    }
  }

  /**
   * Get existing test user data for reference
   */
  getTestUsers(): any[] {
    return [...this.testUsers];
  }

  /**
   * Get valid departments
   */
  getValidDepartments(): string[] {
    // Deprecated: domain-specific concept removed; return empty list for compatibility
    return [];
  }

  /**
   * Generate test data seeding instructions for documentation
   */
  generateTestDataSeedingInstructions(): string {
    return (
      '# Test Data Seeding Instructions\n\n' +
      'Spectra uses Faker with a fixed seed (12345) to generate deterministic, backend-agnostic sample data based on your OpenAPI schemas. No domain-specific fixtures (like departments or emails) are assumed unless explicitly defined in your spec.\n\n' +
      '## Determinism\n' +
      '- Fixed Seed: Ensures reproducible test data across runs\n' +
      '- Spec-Driven: Values are generated from types, formats, enums, and examples in your OpenAPI schema\n\n' +
      '## Guidance\n' +
      '- Provide meaningful example/examples and enum values in your schema to steer realistic data\n' +
      '- Include constraints like minLength, maxLength, minimum, maximum, and format for better test coverage\n\n' +
      '## API Server Setup\n' +
      '1. Ensure your API server is running and accessible\n' +
      '2. If your endpoints require existing resource IDs, seed minimal records accordingly\n' +
      '3. Authentication headers should be configured per your environment\n' +
      '4. Test data will be consistent across runs due to seeded Faker generation\n'
    );
  }
}

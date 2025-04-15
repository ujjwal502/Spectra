import { faker } from '@faker-js/faker';
import { AIService } from '../services/aiService';

export class MockDataGenerator {
  private aiService: AIService | null = null;

  constructor(useAI: boolean = false) {
    if (useAI) {
      this.aiService = new AIService();
    }
  }

  /**
   * Generate mock data based on a JSON schema
   * @param schema JSON schema
   * @param context Optional context to guide AI data generation
   * @returns Generated data
   */
  async generateFromSchema(schema: any, context: string = ''): Promise<any> {
    // Try to generate with AI first if enabled
    if (this.aiService && schema) {
      try {
        const aiData = await this.aiService.generateMockData(schema, context);
        if (aiData) {
          return aiData;
        }
      } catch (error) {
        console.warn(
          'Failed to generate data with AI, falling back to standard generation:',
          error,
        );
      }
    }

    // Fallback to standard generation
    return this.generateStandardData(schema);
  }

  /**
   * Generate standard mock data without AI
   * @param schema JSON schema
   * @returns Generated data
   */
  private generateStandardData(schema: any): any {
    if (!schema || !schema.type) {
      return null;
    }

    switch (schema.type) {
      case 'object':
        return this.generateObject(schema);
      case 'array':
        return this.generateArray(schema);
      case 'string':
        return this.generateString(schema);
      case 'number':
      case 'integer':
        return this.generateNumber(schema);
      case 'boolean':
        return this.generateBoolean();
      case 'null':
        return null;
      default:
        return null;
    }
  }

  /**
   * Generate a mock object
   * @param schema Object schema
   * @returns Generated object
   */
  private generateObject(schema: any): Record<string, any> {
    const result: Record<string, any> = {};

    if (!schema.properties) {
      return {};
    }

    // Process each property
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      result[propName] = this.generateFromSchema(propSchema as any);
    }

    return result;
  }

  /**
   * Generate a mock array
   * @param schema Array schema
   * @returns Generated array
   */
  private generateArray(schema: any): any[] {
    const result: any[] = [];

    if (!schema.items) {
      return [];
    }

    // Determine number of items to generate
    const minItems = schema.minItems || 1;
    const maxItems = schema.maxItems || 5;
    const count = Math.min(Math.floor(Math.random() * (maxItems - minItems + 1)) + minItems, 10);

    // Generate items
    for (let i = 0; i < count; i++) {
      result.push(this.generateFromSchema(schema.items));
    }

    return result;
  }

  /**
   * Generate a mock string
   * @param schema String schema
   * @returns Generated string
   */
  private generateString(schema: any): string {
    // Handle format if specified
    if (schema.format) {
      switch (schema.format) {
        case 'email':
          return faker.internet.email();
        case 'uri':
        case 'url':
          return faker.internet.url();
        case 'date':
          return faker.date.past().toISOString().split('T')[0];
        case 'date-time':
          return faker.date.past().toISOString();
        case 'uuid':
          return faker.string.uuid();
        case 'hostname':
          return faker.internet.domainName();
        case 'ipv4':
          return faker.internet.ip();
        case 'ipv6':
          return faker.internet.ipv6();
        case 'phone':
          return faker.phone.number();
      }
    }

    // Handle enum if specified
    if (schema.enum && schema.enum.length > 0) {
      const index = Math.floor(Math.random() * schema.enum.length);
      return schema.enum[index];
    }

    // Handle pattern if specified
    if (schema.pattern) {
      // Simple handling for some common patterns
      if (schema.pattern.includes('\\d')) {
        return faker.string.alphanumeric(10);
      } else {
        return faker.lorem.words(3);
      }
    }

    // Handle minLength and maxLength
    const minLength = schema.minLength || 5;
    const maxLength = schema.maxLength || 20;
    const length = Math.min(
      Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength,
      100,
    );

    return faker.string.alphanumeric(length);
  }

  /**
   * Generate a mock number
   * @param schema Number schema
   * @returns Generated number
   */
  private generateNumber(schema: any): number {
    // Handle enum if specified
    if (schema.enum && schema.enum.length > 0) {
      const index = Math.floor(Math.random() * schema.enum.length);
      return schema.enum[index];
    }

    const isInteger = schema.type === 'integer';
    const min = schema.minimum !== undefined ? schema.minimum : isInteger ? 1 : 0.1;
    const max = schema.maximum !== undefined ? schema.maximum : isInteger ? 1000 : 1000.0;

    if (isInteger) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    } else {
      return Math.random() * (max - min) + min;
    }
  }

  /**
   * Generate a mock boolean
   * @returns Generated boolean
   */
  private generateBoolean(): boolean {
    return Math.random() > 0.5;
  }

  /**
   * Generate a person object with common properties
   * @returns Person object
   */
  generatePerson(): Record<string, any> {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    return {
      id: faker.string.uuid(),
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      email: faker.internet.email({ firstName, lastName }),
      age: faker.number.int({ min: 18, max: 80 }),
      address: {
        street: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        zipCode: faker.location.zipCode(),
        country: faker.location.country(),
      },
      phone: faker.phone.number(),
      username: faker.internet.userName({ firstName, lastName }),
      avatar: faker.image.avatar(),
      createdAt: faker.date.past().toISOString(),
    };
  }

  /**
   * Generate a product object with common properties
   * @returns Product object
   */
  generateProduct(): Record<string, any> {
    return {
      id: faker.string.uuid(),
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      price: parseFloat(faker.commerce.price()),
      department: faker.commerce.department(),
      adjective: faker.commerce.productAdjective(),
      material: faker.commerce.productMaterial(),
      image: faker.image.url(),
      inStock: faker.datatype.boolean(),
      inventory: faker.number.int({ min: 0, max: 100 }),
      createdAt: faker.date.past().toISOString(),
    };
  }
}

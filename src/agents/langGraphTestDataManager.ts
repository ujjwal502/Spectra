import { EndpointInfo, SystemMap, TestScenario } from '../types/langGraphTypes';
import { faker } from '@faker-js/faker';

/**
 * Test Data Manager for LangGraph Testing Agent
 * Handles intelligent test data generation and seeding strategies
 */
export class LangGraphTestDataManager {
  private testUsers: any[] = [];
  private validDepartments: string[] = ['Engineering', 'Marketing', 'Sales', 'HR'];

  constructor() {
    faker.seed(12345);
    this.initializeTestData();
  }

  /**
   * Initialize consistent test data for reliable testing
   * Using Faker with a fixed seed for reproducible data
   */
  private initializeTestData(): void {
    this.testUsers = [
      {
        id: 1,
        name: faker.person.fullName(),
        email: faker.internet.email().toLowerCase(),
        age: faker.number.int({ min: 25, max: 35 }),
        department: 'Engineering',
      },
      {
        id: 2,
        name: faker.person.fullName(),
        email: faker.internet.email().toLowerCase(),
        age: faker.number.int({ min: 28, max: 40 }),
        department: 'Marketing',
      },
      {
        id: 3,
        name: faker.person.fullName(),
        email: faker.internet.email().toLowerCase(),
        age: faker.number.int({ min: 26, max: 38 }),
        department: 'Sales',
      },
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
  ): any {
    const testData: any = {};

    for (const param of endpoint.parameters) {
      if (endpoint.path.includes(`{${param.name}}`)) {
        testData[param.name] = this.generateParameterValue(param, dataType);
      }
    }

    if (endpoint.requestBody && endpoint.method !== 'GET') {
      const bodyData = this.generateRequestBodyData(endpoint.requestBody, dataType);
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
        if (param.name === 'id') {
          return this.testUsers[Math.floor(Math.random() * this.testUsers.length)].id;
        }
        if (param.name === 'department') {
          return this.validDepartments[Math.floor(Math.random() * this.validDepartments.length)];
        }
        if (param.validValues && param.validValues.length > 0) {
          return param.validValues[0];
        }
        return this.getDefaultValidValue(param);

      case 'not_found':
        if (param.name === 'id') {
          return 999;
        }
        if (param.name === 'department') {
          return 'NonExistentDepartment';
        }
        return 'non_existent_value';

      case 'invalid_format':
        if (param.name === 'id') {
          return 'invalid_id_format';
        }
        return 'invalid@format!';

      case 'numeric_boundary':
        if (param.type === 'integer') {
          return Math.random() > 0.5 ? 1 : 1000;
        }
        return this.getDefaultValidValue(param);

      default:
        return this.getDefaultValidValue(param);
    }
  }

  /**
   * Generate request body data with proper validation compliance
   */
  private generateRequestBodyData(requestBody: any, dataType: string): any {
    const data: any = {};

    switch (dataType) {
      case 'valid':
        return this.generateValidUserData();

      case 'invalid':
        return {
          name: '',
          email: faker.lorem.word(),
          age: faker.number.int({ min: 10, max: 17 }),
          department: faker.company.buzzNoun(),
        };

      case 'max_length':
        return {
          name: faker.lorem.words(10).substring(0, 50),
          email: `${faker.lorem.words(5).replace(/\s/g, '')}.${faker.lorem.words(3).replace(/\s/g, '')}@example.com`,
          age: 100,
          department: faker.helpers.arrayElement(this.validDepartments),
        };

      case 'min_length':
        return {
          name: faker.person.firstName().substring(0, 2),
          email: `${faker.string.alpha(1)}@${faker.string.alpha(1)}.co`,
          age: 18,
          department: faker.helpers.arrayElement(this.validDepartments),
        };

      case 'missing_required':
        return {
          age: faker.number.int({ min: 18, max: 65 }),
          department: faker.helpers.arrayElement(this.validDepartments),
        };

      case 'duplicate_email':
        return {
          name: faker.person.fullName(),
          email: this.testUsers[0].email,
          age: faker.number.int({ min: 18, max: 65 }),
          department: faker.helpers.arrayElement(this.validDepartments),
        };

      case 'invalid_department':
        return {
          name: faker.person.fullName(),
          email: faker.internet.email().toLowerCase(),
          age: faker.number.int({ min: 18, max: 65 }),
          department: faker.company.buzzNoun(),
        };

      default:
        return this.generateValidUserData();
    }
  }

  /**
   * Generate valid user data for successful test scenarios using Faker
   */
  private generateValidUserData(): any {
    return {
      name: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      age: faker.number.int({ min: 18, max: 65 }),
      department: faker.helpers.arrayElement(this.validDepartments),
    };
  }

  /**
   * Get default valid value for parameter types using Faker
   */
  private getDefaultValidValue(param: any): any {
    switch (param.type) {
      case 'string':
        if (param.format === 'email') return faker.internet.email().toLowerCase();
        if (param.name === 'department') return faker.helpers.arrayElement(this.validDepartments);
        return faker.lorem.word();
      case 'integer':
      case 'number':
        if (param.name === 'age') return faker.number.int({ min: 18, max: 65 });
        if (param.name === 'id') return faker.number.int({ min: 1, max: 1000 });
        return faker.number.int({ min: 1, max: 100 });
      case 'boolean':
        return faker.datatype.boolean();
      default:
        return faker.lorem.word();
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
    return [...this.validDepartments];
  }

  /**
   * Generate test data seeding instructions for documentation
   */
  generateTestDataSeedingInstructions(): string {
    return `
# Test Data Seeding Instructions

For reliable test execution, the following test data is generated using Faker with a fixed seed (12345):

## Base Test Users (Generated with Faker):
${this.testUsers.map((user) => `- User ID ${user.id}: ${user.name} (${user.email}) - ${user.department}, Age: ${user.age}`).join('\n')}

## Valid Departments:
${this.validDepartments.map((dept) => `- ${dept}`).join('\n')}

## Test Data Features:
- **Realistic Data**: Generated using Faker.js for authentic names, emails, and ages
- **Consistent Results**: Fixed seed (12345) ensures reproducible test data across runs
- **Variety**: Each test run generates varied but valid data within constraints
- **Professional Quality**: Business-realistic names, properly formatted emails, valid ages

## API Server Setup:
1. Ensure the demo API server is running on http://localhost:8081
2. Seed the database with the test users above (generated with Faker)
3. Configure department validation with the valid departments
4. Implement proper email uniqueness validation
5. Test data will be consistent across runs due to seeded Faker generation
`;
  }
}

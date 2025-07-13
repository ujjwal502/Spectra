
# Test Data Seeding Instructions

For reliable test execution, the following test data is generated using Faker with a fixed seed (12345):

## Base Test Users (Generated with Faker):
- User ID 1: Erick Doyle (violet74@yahoo.com) - Engineering, Age: 25
- User ID 2: Ms. Eula Schroeder (ludie43@hotmail.com) - Marketing, Age: 40
- User ID 3: Mr. Ricardo Balistreri (jerad89@gmail.com) - Sales, Age: 36

## Valid Departments:
- Engineering
- Marketing
- Sales
- HR

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

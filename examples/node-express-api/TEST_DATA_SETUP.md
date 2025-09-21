# Test Data Seeding Instructions

Spectra uses Faker with a fixed seed (12345) to generate deterministic, backend-agnostic sample data based on your OpenAPI schemas. No domain-specific fixtures (like departments or emails) are assumed unless explicitly defined in your spec.

## Determinism
- Fixed Seed: Ensures reproducible test data across runs
- Spec-Driven: Values are generated from types, formats, enums, and examples in your OpenAPI schema

## Guidance
- Provide meaningful example/examples and enum values in your schema to steer realistic data
- Include constraints like minLength, maxLength, minimum, maximum, and format for better test coverage

## API Server Setup
1. Ensure your API server is running and accessible
2. If your endpoints require existing resource IDs, seed minimal records accordingly
3. Authentication headers should be configured per your environment
4. Test data will be consistent across runs due to seeded Faker generation

### Spectra

AI-powered API testing automation with intelligent spec generation and testing workflows.

### Prerequisites

- **Node.js**: v20 or newer (LTS recommended)
- **npm**: comes with Node.js
- **Java**
- **Maven**
- **Envs**: Ensure the required envs are there

### Setup

1. Install dependencies at the project root:

```bash
cd /Spectra
npm install
```

### Run the Demo API (keep it running)

In a separate terminal, start the Spring Boot demo API:

```bash
cd /examples/demo-api
mvn spring-boot:run
```

The API will be available at `http://localhost:8081`.

### Generate Spec and Run Intelligent Testing

Back in the project root:

1. Generate the spec for the demo API:

```bash
npm run generate:spec:demo-api
```

This produces `examples/demo-api/enrichedOpenapi.json`.

2. Run intelligent testing for the demo API:

```bash
npm run test:demo-api:intelligent
```

Notes:

- Ensure the demo API is running before starting intelligent tests.

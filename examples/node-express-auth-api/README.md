# Node Express Auth API (Example)

Run the server:

```bash
cd examples/node-express-auth-api
npm install
npm start
```

Get a token:

```bash
curl -s -X POST http://localhost:3001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"password123"}' | jq -r .token
```

Run Spectra with bearer auth:

```bash
export OPENAI_API_KEY=your_key
npx ts-node src/cli/enhanced.ts run-intelligent-testing \
  ./examples/node-express-auth-api/openapi.json \
  --base-url http://localhost:3001 \
  --auth-bearer YOUR_TOKEN
```

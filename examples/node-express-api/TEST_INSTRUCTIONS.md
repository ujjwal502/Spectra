# Testing Spectra with Node.js Express API

## Quick Test Setup

### 1. Start the Node.js API
```bash
cd examples/node-express-api
npm install
npm start
```

The API should be running on `http://localhost:3000`

### 2. Verify API is working
```bash
curl http://localhost:3000/api/v1/users
curl http://localhost:3000/health
```

You should see JSON responses with demo users and health status.

### 3. Test File Upload Endpoints (Optional)
```bash
# First, get an auth token
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john.doe@example.com","password":"password123"}' | jq -r '.accessToken')

# Test single image upload (create a test image first)
echo -n -e '\xFF\xD8\xFF\xE0\x00\x10JFIF\x00' > /tmp/test.jpg
curl -X POST http://localhost:3000/api/v1/uploads/image \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@/tmp/test.jpg"

# List uploaded files
curl http://localhost:3000/api/v1/uploads \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Run Spectra Testing
```bash
# From the project root
npm run test:demo-api:intelligent_2
```

## Expected Behavior

### Before Fix (Broken)
- Spectra would try to hit `http://localhost:8081` (Java API port)
- Tests would fail with connection errors
- URLs in logs would show wrong port

### After Fix (Working)
- Spectra should extract base URL from OpenAPI spec: `http://localhost:3000/api/v1`
- Tests should successfully hit the Node.js API
- Debug logs should show:
  ```
  🌐 [SPEC EXTRACTION] Found server URL in API spec: http://localhost:3000/api/v1
  🌐 [AI ANALYSIS] Extracted base URL from API spec: http://localhost:3000/api/v1
  🌐 [URL EXTRACTION] Found base URL in system map: http://localhost:3000/api/v1
  🌐 [SMART EXECUTION] Using dynamic base URL: http://localhost:3000/api/v1
  🔧 [CURL-RUNNER] Base URL from runner: http://localhost:3000/api/v1
  🔧 [CURL-RUNNER] Final constructed URL: http://localhost:3000/api/v1/users
  ```

## Debug Output to Look For

The fix adds comprehensive logging:

1. **URL Extraction from OpenAPI spec**: Shows how base URL is parsed from servers section
2. **System Map Creation**: Shows base URL being stored in system map
3. **Curl Runner**: Shows actual URLs being constructed and called
4. **Test Execution**: Shows which endpoints are being tested

## Troubleshooting

If tests still fail:

1. **Check Node.js API is running**: `curl http://localhost:3000/health`
2. **Verify OpenAPI spec**: Check that `openapi.json` has correct server URL
3. **Check debug logs**: Look for the URL extraction and construction logs
4. **Port conflicts**: Make sure port 3000 isn't used by another service

## Success Indicators

✅ API tests pass with 200/201 status codes
✅ No connection refused errors
✅ Spectra generates test scenarios and Gherkin features
✅ URL logs show `localhost:3000` instead of `localhost:8081`
✅ File upload endpoints accept multipart/form-data requests
✅ Uploaded files are accessible via `/uploads/{filename}`

## File Upload Testing

The API now supports multipart/form-data file uploads:

| Endpoint | Content-Type | Description |
|----------|--------------|-------------|
| `POST /api/v1/uploads/image` | multipart/form-data | Single image upload |
| `POST /api/v1/uploads/images` | multipart/form-data | Multiple images (up to 5) |
| `POST /api/v1/uploads/profile` | multipart/form-data | Profile with text + images |
| `POST /api/v1/products/{id}/image` | multipart/form-data | Product image |

**Supported formats**: JPEG, PNG, GIF, WebP  
**Max size**: 5MB per file  
**Auth required**: Yes (JWT Bearer token)

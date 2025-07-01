# Spectra Backend Test Monitor

A real-time web interface for monitoring the execution of your existing `npm run test:backend` command. This UI provides live visualization of test progress, results, and metrics as your backend tests run.

## Overview

This tool integrates with your existing Spectra testing workflow to provide:

- **Real-time test monitoring** of `npm run test:backend`
- **Live progress tracking** with step-by-step visualization
- **Interactive test results** with detailed assertions and metrics
- **Live logs** showing exactly what's happening during test execution
- **Performance metrics** and test statistics

## Quick Start

### 1. Start the Backend Server

First, start your backend server:

```bash
# Option 1: Use the helper script
npm run start:backend

# Option 2: Manual start
cd examples/backend
npm install  # if first time
npm run dev
```

The backend should be running at `http://localhost:3000`

### 2. Start the Test Monitor UI

In a new terminal, start the monitoring interface:

```bash
npm run dashboard
# or
npm run demo
```

This will:

- Build the React UI
- Start the WebSocket server
- Open the interface at `http://localhost:3001`

### 3. Run Your Tests

1. Open `http://localhost:3001` in your browser
2. Verify the backend URL is correct (should be `http://localhost:3000`)
3. Click "Start Backend Test"
4. Watch your tests execute in real-time!

## What You'll See

### Real-Time Process Tracking

The UI shows each step of your test execution:

1. **Backend Health Check** - Verifies your server is running
2. **Loading API Schema** - Reads the OpenAPI specification
3. **Generating Test Cases** - Creates test cases from your API
4. **Executing Tests** - Runs functional and non-functional tests
5. **Generating Reports** - Creates detailed test reports

### Live Test Results

As tests execute, you'll see:

- **Test Status** - Pass/fail indicators for each endpoint
- **HTTP Methods** - Color-coded badges (GET, POST, PUT, DELETE)
- **Response Times** - Duration for each test
- **Detailed Assertions** - Expand to see what was tested
- **Error Details** - Full error messages for failed tests

### Real-Time Metrics

The dashboard shows:

- **Test Counts** - Total, passed, failed tests
- **Success Rate** - Percentage of passing tests
- **Performance Metrics** - Response times and throughput
- **Progress Tracking** - Visual progress bars

### Live Logs

See exactly what's happening:

- **Timestamped logs** from the test execution
- **Color-coded messages** (info, warning, error, success)
- **Real-time output** from `npm run test:backend`

## How It Works

### Integration with Existing Tests

The monitor doesn't replace your existing tests - it enhances them:

1. **Spawns Process** - Runs `npm run test:backend` as a child process
2. **Parses Output** - Analyzes console output in real-time
3. **Extracts Data** - Identifies test steps, results, and metrics
4. **Streams to UI** - Sends updates via WebSocket to the browser
5. **Loads Results** - Reads the final `test-results.json` file

### No Code Changes Required

Your existing test files remain unchanged:

- `examples/backend-test.ts` - Your main test script
- `examples/backend/openapi.json` - Your API specification
- All test logic and assertions stay the same

### Real-Time Communication

```
Browser ←→ WebSocket ←→ Monitor Server ←→ npm run test:backend
```

## Configuration

### Backend URL

Make sure the backend URL in the UI matches your server:

- Default: `http://localhost:3000`
- Change in the UI if your backend runs on a different port

### AI Enhancement

Toggle AI features on/off:

- **Enabled**: Requires `OPENAI_API_KEY` environment variable
- **Disabled**: Uses standard test generation without AI

## Troubleshooting

### Backend Not Running

If you see "Backend is not running":

1. Start the backend: `npm run start:backend`
2. Verify it's accessible at `http://localhost:3000/health`
3. Check for port conflicts

### Test Process Fails

If tests fail to start:

1. Ensure you're in the project root directory
2. Check that `npm run test:backend` works from command line
3. Verify all dependencies are installed

### WebSocket Connection Issues

If the UI doesn't update:

1. Refresh the browser page
2. Check that port 3001 is available
3. Ensure no firewall is blocking the connection

### No Test Results

If results don't appear:

1. Check that tests are actually running
2. Verify `examples/backend/test-results.json` is being created
3. Look at the live logs for error messages

## Advanced Usage

### Custom Backend Ports

If your backend runs on a different port:

1. Update the "Backend API URL" field in the UI
2. Or modify the default in `src/ui/src/components/DemoControls.tsx`

### Multiple Test Runs

You can run multiple test sessions:

1. Click "Clear Results" to reset the UI
2. Click "Start Backend Test" to run again
3. Each session is independent

### Saving Results

Test results are automatically saved to:

- `examples/backend/test-results.json` - Detailed JSON results
- Console output - Full test execution logs

## Development

### Modifying the UI

To customize the monitoring interface:

```bash
cd src/ui
npm run dev  # Start development server
# Edit components in src/components/
npm run build  # Build for production
```

### Adding Custom Parsing

To parse additional test output:

1. Edit `src/ui/server.js`
2. Modify the `parseTestOutput()` method
3. Add new step types or result parsing

## Best Practices

### For Demos

1. **Prepare**: Run tests once manually to ensure everything works
2. **Clean State**: Clear results before starting a demo
3. **Explain**: Narrate what's happening as tests execute
4. **Show Details**: Expand test results to show assertions

### For Development

1. **Monitor Regularly**: Use during development to catch regressions
2. **Check Logs**: Use live logs to debug test issues
3. **Track Metrics**: Monitor performance trends over time

## Integration with CI/CD

While this UI is designed for interactive use, you can still use your existing CI/CD:

- **CI/CD**: Continue using `npm run test:backend` in pipelines
- **Local Development**: Use the UI for interactive testing and debugging
- **Demos**: Use the UI for client presentations and showcases

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Verify your backend is running and accessible
3. Check the browser console for JavaScript errors
4. Review the server logs for WebSocket issues

---

**Happy Testing! 🚀**

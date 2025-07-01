# Spectra Demo UI - Complete Guide

## Overview

The Spectra Demo UI is a real-time web interface designed specifically for demonstrating Spectra's AI-powered API testing capabilities to clients. It provides a visual, interactive experience that shows every step of the testing process as it happens, making it perfect for client presentations, sales demos, and technical showcases.

## Key Features

### 🎯 Real-Time Visualization

- **Live Process Tracking**: Watch each step of the testing process unfold in real-time
- **Interactive Timeline**: See the complete history of operations with status indicators
- **Live Logs**: Real-time output from the Spectra engine with color-coded messages
- **Progress Indicators**: Visual progress bars and completion status

### 📊 Comprehensive Results Display

- **Test Metrics Dashboard**: Real-time statistics including pass/fail rates and performance metrics
- **Detailed Test Results**: Expandable cards showing full assertion details and error information
- **Non-Functional Testing Results**: Performance, security, reliability, and load test metrics
- **Visual Status Indicators**: Color-coded badges and icons for quick assessment

### 💻 Generated Code Viewer

- **Gherkin Features**: View AI-generated BDD test scenarios in real-time
- **Test Cases**: Inspect generated test case JSON structures
- **OpenAPI Specifications**: See generated or loaded API specifications
- **Tabbed Interface**: Easy switching between different code types

### ⚙️ Flexible Configuration

- **Quick Start Presets**: Pre-configured setups for common demo scenarios
- **Advanced Options**: Full control over test parameters and AI settings
- **Multiple Test Types**: Support for functional, non-functional, or combined testing
- **AI Enhancement Toggle**: Enable/disable AI-powered features

## Getting Started

### Prerequisites

Before running the demo UI, ensure you have:

1. **Node.js 14+** installed on your system
2. **Spectra project** properly set up and configured
3. **OpenAI API key** configured (for AI features)
4. **Target API** accessible (for live demos)

### Installation & Setup

1. **Navigate to your Spectra project root**:

   ```bash
   cd /path/to/your/spectra/project
   ```

2. **Start the Demo UI**:

   ```bash
   # Option 1: Using npm script (recommended)
   npm run dashboard

   # Option 2: Using the demo alias
   npm run demo

   # Option 3: Direct launch script
   node launch-demo.js
   ```

3. **Access the UI**:
   - Open your browser and navigate to `http://localhost:3001`
   - The UI will automatically load and be ready for demos

### First Demo Run

1. **Choose a Preset**: Start with the "Backend Demo" preset for your first run
2. **Configure Settings**: Adjust API URL if needed (default: `http://localhost:3000`)
3. **Start Demo**: Click the "Start Demo" button
4. **Watch the Process**: Observe as Spectra analyzes, generates, and executes tests
5. **Review Results**: Explore the detailed test results and generated code

## Demo Scenarios

### 1. Backend Demo (Recommended for First-Time Demos)

**Best for**: Initial client presentations, showcasing core functionality

- **API Target**: Local backend example (`http://localhost:3000`)
- **Schema Source**: Pre-built OpenAPI specification
- **Test Types**: Full functional and non-functional testing
- **Duration**: ~2-3 minutes
- **Features Demonstrated**:
  - Schema loading and validation
  - AI-powered test case generation
  - Gherkin scenario creation
  - Functional test execution
  - Performance and security testing
  - Real-time metrics calculation

### 2. Petstore API Demo

**Best for**: Quick demonstrations, public API testing

- **API Target**: Public Swagger Petstore API
- **Schema Source**: Standard Petstore OpenAPI specification
- **Test Types**: Functional testing with AI enhancement
- **Duration**: ~1-2 minutes
- **Features Demonstrated**:
  - Public API testing
  - AI-enhanced test generation
  - Real-time test execution
  - Result visualization

### 3. Code-to-API Demo

**Best for**: Showcasing spec generation capabilities

- **Source**: Analyze backend source code
- **Generation**: AI-powered OpenAPI spec generation from code
- **Test Types**: Complete end-to-end workflow
- **Duration**: ~3-4 minutes
- **Features Demonstrated**:
  - Source code analysis
  - Automatic OpenAPI spec generation
  - AI-powered test creation
  - Full testing workflow

## UI Components Deep Dive

### Demo Controls Panel

The control panel is your command center for managing demos:

**Preset Configurations**:

- Quick-start buttons for common scenarios
- Pre-configured API URLs and settings
- One-click demo initiation

**Configuration Options**:

- **API URL**: Target API endpoint for testing
- **Test Type**: Choose between functional, non-functional, or both
- **AI Enhancement**: Toggle AI-powered features on/off

**Advanced Settings** (click "Advanced" to reveal):

- **Schema Path**: Path to existing OpenAPI specification
- **Source Code Path**: Path for spec generation from code
- **Generate Spec**: Enable automatic spec generation

**Control Buttons**:

- **Start Demo**: Begin the demonstration
- **Stop Demo**: Halt the current demo
- **Clear**: Reset all results and logs

### Process Viewer

Real-time visualization of the testing process:

**Current Step Display**:

- Highlighted current operation with status
- Progress indicators and timing information
- Detailed step descriptions

**Timeline View**:

- Complete history of all operations
- Status indicators (running, completed, failed)
- Duration tracking for each step
- Expandable details for troubleshooting

**Live Logs**:

- Real-time output from the Spectra engine
- Color-coded messages (info, warning, error, success)
- Timestamps for all log entries
- Scrollable terminal-style interface

### Test Results Panel

Comprehensive display of test execution results:

**Results Overview**:

- Total test count and completion status
- Quick visual indicators for pass/fail status
- HTTP method badges with color coding

**Detailed Views** (click to expand):

- **Test Case Information**: Feature titles and descriptions
- **Functional Assertions**: Individual assertion results with error details
- **Non-Functional Results**: Performance metrics, security findings
- **Error Details**: Full error messages and stack traces

**Interactive Features**:

- Expandable/collapsible result cards
- Copy functionality for error messages
- Filtering and sorting options

### Metrics Dashboard

Real-time statistics and performance data:

**Summary Statistics**:

- Total tests executed
- Pass/fail counts and percentages
- Success rate calculations
- Overall test duration

**Performance Metrics** (when available):

- Average response time
- Minimum/maximum response times
- Throughput measurements
- Resource utilization data

**Security Metrics** (when available):

- Vulnerability counts
- Security score ratings
- Risk assessments
- Compliance indicators

**Progress Tracking**:

- Visual progress bars
- Completion percentages
- Real-time updates during execution

### Code Viewer

Display of generated code and specifications:

**Tabbed Interface**:

- **Gherkin Features**: BDD-style test scenarios
- **Test Cases**: JSON test case structures
- **OpenAPI Spec**: API specifications

**Features**:

- Syntax highlighting for readability
- Real-time updates as code is generated
- Copy-to-clipboard functionality
- Formatted JSON display

## Best Practices for Client Demos

### Pre-Demo Preparation

1. **Test Your Setup**:

   ```bash
   # Run a complete test beforehand
   npm run dashboard
   # Execute a full demo cycle
   ```

2. **Prepare Backup Materials**:

   - Screenshots of successful demo runs
   - Video recordings of the process
   - Static reports as fallback

3. **Environment Checklist**:
   - [ ] Stable internet connection
   - [ ] Target APIs are accessible
   - [ ] OpenAI API key is configured
   - [ ] All dependencies are installed
   - [ ] Demo scenarios are tested

### During the Demo

1. **Start Simple**: Begin with the Backend Demo preset
2. **Narrate the Process**: Explain each step as it happens
3. **Highlight AI Features**: Point out AI-generated content
4. **Show Details**: Expand test results to show comprehensive information
5. **Relate to Client Needs**: Connect features to client's specific requirements

### Demo Script Template

```
1. Introduction (30 seconds)
   "Today I'll show you Spectra's AI-powered API testing in action..."

2. Configuration (1 minute)
   "Let me configure this for your API environment..."
   - Show preset selection
   - Explain configuration options

3. Execution (2-3 minutes)
   "Now watch as Spectra analyzes and tests your API..."
   - Narrate each step in the process viewer
   - Highlight AI-generated content in real-time

4. Results Review (2 minutes)
   "Here are the comprehensive results..."
   - Show metrics dashboard
   - Expand detailed test results
   - Demonstrate non-functional testing results

5. Code Generation (1 minute)
   "Spectra also generates all the test code..."
   - Show Gherkin features
   - Display test cases
   - Review OpenAPI specifications

6. Wrap-up (30 seconds)
   "This entire process took just 3 minutes and provided..."
```

### Post-Demo Follow-up

1. **Share Results**: Export or screenshot key metrics
2. **Provide Documentation**: Share relevant guides and examples
3. **Schedule Technical Deep-dive**: Plan detailed implementation discussion
4. **Gather Feedback**: Collect client questions and requirements

## Troubleshooting

### Common Issues and Solutions

#### Port Already in Use

```bash
# Check what's using port 3001
lsof -ti:3001

# Kill the process
lsof -ti:3001 | xargs kill

# Or change the port in server.js
```

#### Build Failures

```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
cd src/ui
rm -rf node_modules
npm install

# Check Node.js version
node --version  # Should be 14+
```

#### WebSocket Connection Issues

- Check firewall settings
- Verify CORS configuration in `server.js`
- Ensure both frontend and backend are running
- Try refreshing the browser

#### Demo Execution Errors

- Verify API endpoints are accessible
- Check OpenAI API key configuration
- Ensure schema files exist and are valid
- Review network connectivity

### Debug Mode

Enable detailed logging:

```bash
DEBUG=spectra:* npm run dashboard
```

### Log Analysis

Check the console output for:

- WebSocket connection status
- API response codes
- Error stack traces
- Performance metrics

## Customization

### Adding Custom Presets

Edit `src/ui/src/components/DemoControls.tsx`:

```typescript
const presetConfigs = [
  // ... existing presets
  {
    name: 'My Custom API',
    config: {
      apiUrl: 'https://my-api.example.com',
      schemaPath: 'path/to/my-schema.json',
      testType: 'both',
      useAI: true,
      generateSpec: false,
    },
  },
];
```

### Styling Customization

Modify `src/ui/src/index.css`:

```css
:root {
  --primary-color: #your-brand-color;
  --secondary-color: #your-secondary-color;
  /* ... other variables */
}
```

### Adding New Metrics

1. Extend the `DemoMetrics` interface in `src/ui/src/types.ts`
2. Update the `MetricsPanel` component
3. Modify the server to emit new metric data

## Technical Architecture

### Frontend Stack

- **React 18**: Modern React with hooks
- **TypeScript**: Type safety and developer experience
- **Socket.IO Client**: Real-time communication
- **Vite**: Fast build tool and dev server
- **CSS Variables**: Customizable theming

### Backend Stack

- **Node.js + Express**: Server and API
- **Socket.IO Server**: WebSocket communication
- **Spectra Integration**: Direct engine integration
- **Session Management**: Multi-client support

### Communication Flow

```
Browser ←→ Socket.IO ←→ Demo Server ←→ Spectra Engine
```

### Data Flow

1. User configures demo in UI
2. Configuration sent via WebSocket
3. Server creates demo session
4. Spectra engine executes tests
5. Results streamed back to UI in real-time

## Security Considerations

- WebSocket connections are isolated per session
- No sensitive data is stored in browser
- API keys are handled server-side only
- CORS is properly configured
- Input validation on all configuration options

## Performance Optimization

- Real-time updates are throttled to prevent UI lag
- Large result sets are paginated
- WebSocket messages are compressed
- Static assets are cached
- Build output is optimized for production

## Contributing

To contribute to the demo UI:

1. **Development Setup**:

   ```bash
   cd src/ui
   npm install
   npm run dev
   ```

2. **Make Changes**: Edit components in `src/components/`
3. **Test Changes**: Verify with demo scenarios
4. **Build**: Run `npm run build` for production

## Support

For issues or questions:

1. Check this guide first
2. Review the troubleshooting section
3. Check the project's main documentation
4. Create an issue in the project repository

---

**Happy Demoing! 🚀**

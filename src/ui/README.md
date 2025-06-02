# Spectra Demo UI

A real-time web interface for demonstrating Spectra's AI-powered API testing capabilities to clients. This interactive dashboard shows every step of the testing process in real-time, making it perfect for client presentations and demos.

## Features

### 🎯 **Real-Time Demo Experience**

- **Live Process Visualization**: Watch each step of the testing process unfold in real-time
- **Interactive Controls**: Start, stop, and configure demos with an intuitive interface
- **Real-Time Logs**: See live output from the Spectra engine as tests execute
- **Progress Tracking**: Visual progress indicators and step-by-step timeline

### 📊 **Comprehensive Test Results**

- **Test Metrics Dashboard**: Real-time statistics including pass/fail rates and performance metrics
- **Detailed Test Results**: Expandable test result cards with full assertion details
- **Non-Functional Testing**: Performance, security, reliability, and load test results
- **Visual Status Indicators**: Color-coded status badges and icons for quick assessment

### 💻 **Generated Code Viewer**

- **Gherkin Features**: View AI-generated BDD test scenarios
- **Test Cases**: Inspect generated test case JSON structures
- **OpenAPI Specifications**: See generated or loaded API specifications
- **Syntax Highlighting**: Clean, readable code display with proper formatting

### ⚙️ **Flexible Configuration**

- **Quick Start Presets**: Pre-configured setups for common demo scenarios
- **Advanced Options**: Full control over test parameters and AI settings
- **Multiple Test Types**: Functional, non-functional, or combined testing modes
- **AI Enhancement**: Toggle AI-powered features on/off

## Getting Started

### Prerequisites

- Node.js 14+ installed
- Spectra project set up and configured
- OpenAI API key (for AI features)

### Quick Start

1. **Start the Demo UI**:

   ```bash
   # From the project root
   npm run dashboard

   # Or alternatively
   npm run demo
   ```

2. **Open in Browser**:

   - Navigate to `http://localhost:3001`
   - The UI will automatically open

3. **Run a Demo**:
   - Choose a preset configuration or customize your own
   - Click "Start Demo" to begin the real-time demonstration
   - Watch as Spectra analyzes, generates, and executes tests

### Demo Scenarios

#### 1. **Backend Demo** (Recommended for first-time demos)

- **API**: Local backend example (`http://localhost:3000`)
- **Schema**: Pre-built OpenAPI specification
- **Features**: Full functional and non-functional testing
- **Duration**: ~2-3 minutes

#### 2. **Petstore API Demo**

- **API**: Public Swagger Petstore API
- **Schema**: Standard Petstore OpenAPI spec
- **Features**: Functional testing with AI enhancement
- **Duration**: ~1-2 minutes

#### 3. **Code-to-API Demo**

- **Source**: Analyze backend source code
- **Generation**: AI-powered OpenAPI spec generation
- **Features**: Complete end-to-end workflow
- **Duration**: ~3-4 minutes

## Demo Flow

### Phase 1: Initialization

1. **Engine Setup**: Initialize Spectra with AI capabilities
2. **Schema Loading**: Load or generate OpenAPI specification
3. **Configuration**: Apply test settings and parameters

### Phase 2: Test Generation

1. **AI Analysis**: Analyze API endpoints and data models
2. **Gherkin Creation**: Generate BDD-style test scenarios
3. **Test Case Building**: Create executable test cases with mock data

### Phase 3: Test Execution

1. **Functional Testing**: Execute API tests with assertions
2. **Non-Functional Testing**: Run performance, security, and reliability tests
3. **Real-Time Results**: Display results as they complete

### Phase 4: Results & Analysis

1. **Metrics Calculation**: Compute success rates and performance metrics
2. **Report Generation**: Create detailed test reports
3. **Visualization**: Display results in interactive dashboard

## UI Components

### Demo Controls Panel

- **Preset Configurations**: Quick-start options for common scenarios
- **Configuration Options**: API URL, test types, AI settings
- **Control Buttons**: Start, stop, and clear demo functions
- **Advanced Settings**: Schema paths, source code paths, generation options

### Process Viewer

- **Current Step Display**: Highlighted current operation with progress
- **Timeline View**: Complete step history with status indicators
- **Live Logs**: Real-time output from the Spectra engine
- **Error Handling**: Clear error messages and recovery options

### Test Results Panel

- **Results List**: Expandable cards for each test case
- **Status Indicators**: Visual pass/fail status with method badges
- **Detailed Views**: Full assertion results and error details
- **Non-Functional Data**: Performance metrics and security findings

### Metrics Dashboard

- **Summary Statistics**: Total tests, pass/fail counts, success rates
- **Performance Metrics**: Response times, throughput, and latency data
- **Security Metrics**: Vulnerability counts and security scores
- **Progress Tracking**: Visual progress bars and completion status

### Code Viewer

- **Tabbed Interface**: Switch between Gherkin, test cases, and OpenAPI specs
- **Syntax Highlighting**: Clean, readable code formatting
- **Real-Time Updates**: Code appears as it's generated
- **Copy Functionality**: Easy copying of generated code

## Technical Architecture

### Frontend (React + TypeScript)

- **React 18**: Modern React with hooks and functional components
- **TypeScript**: Full type safety and IntelliSense support
- **Socket.IO Client**: Real-time communication with backend
- **Lucide Icons**: Beautiful, consistent iconography
- **Tailwind CSS**: Utility-first styling for responsive design

### Backend (Node.js + Express)

- **Express Server**: RESTful API and static file serving
- **Socket.IO Server**: WebSocket communication for real-time updates
- **Spectra Integration**: Direct integration with Spectra testing engine
- **Session Management**: Multi-client demo session handling

### Real-Time Communication

- **WebSocket Events**: Bidirectional real-time communication
- **Event Types**: Steps, results, metrics, logs, and code updates
- **Session Isolation**: Each client gets independent demo sessions
- **Error Handling**: Graceful error recovery and user feedback

## Customization

### Adding New Presets

Edit the `presetConfigs` array in `DemoControls.tsx`:

```typescript
{
  name: 'My Custom Demo',
  config: {
    apiUrl: 'https://my-api.com',
    schemaPath: 'path/to/my-schema.json',
    testType: 'both',
    useAI: true,
    generateSpec: false
  }
}
```

### Styling Customization

- Modify CSS variables in `index.css` for color schemes
- Update Tailwind classes for layout changes
- Add custom animations and transitions

### Adding New Metrics

Extend the `DemoMetrics` interface in `types.ts` and update the `MetricsPanel` component.

## Troubleshooting

### Common Issues

1. **Port Already in Use**

   - Change the port in `server.js` (default: 3001)
   - Kill existing processes: `lsof -ti:3001 | xargs kill`

2. **Build Failures**

   - Ensure all dependencies are installed: `npm install`
   - Check Node.js version (requires 14+)
   - Clear cache: `npm cache clean --force`

3. **WebSocket Connection Issues**

   - Check firewall settings
   - Verify CORS configuration in `server.js`
   - Ensure both frontend and backend are running

4. **Demo Execution Errors**
   - Verify API endpoints are accessible
   - Check OpenAI API key configuration
   - Ensure schema files exist and are valid

### Debug Mode

Enable debug logging by setting environment variables:

```bash
DEBUG=spectra:* npm run dashboard
```

## Best Practices for Client Demos

### Preparation

1. **Test Your Setup**: Run through the demo beforehand
2. **Prepare Backup**: Have screenshots/videos ready as backup
3. **Check Network**: Ensure stable internet connection
4. **API Availability**: Verify target APIs are accessible

### During the Demo

1. **Start Simple**: Begin with the Backend Demo preset
2. **Explain Each Step**: Narrate what's happening in real-time
3. **Highlight AI Features**: Point out AI-generated content
4. **Show Results**: Expand test results to show detailed information
5. **Discuss Benefits**: Relate features to client's specific needs

### Follow-Up

1. **Share Results**: Export or screenshot key metrics
2. **Provide Documentation**: Share relevant guides and examples
3. **Schedule Follow-Up**: Plan next steps and implementation discussion

## Contributing

To contribute to the demo UI:

1. **Setup Development Environment**:

   ```bash
   cd src/ui
   npm install
   npm run dev  # Start development server
   ```

2. **Make Changes**: Edit React components in `src/components/`
3. **Test Changes**: Verify functionality with demo scenarios
4. **Build and Test**: Run `npm run build` to ensure production build works

## License

This demo UI is part of the Spectra project and follows the same ISC license.

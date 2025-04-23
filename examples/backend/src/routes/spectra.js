const express = require('express');
const fs = require('fs');
const path = require('path');
const { parseGherkinFeature, extractTestScenarios } = require('../middleware/gherkinParser');
const router = express.Router();

/**
 * @route   GET /api/spectra
 * @desc    Get overview of Spectra API endpoints
 * @access  Public
 */
router.get('/', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}/api/spectra`;

  res.json({
    name: 'Spectra API',
    description: 'API for accessing Spectra test results and Gherkin features',
    version: '1.0.0',
    endpoints: [
      {
        path: `${baseUrl}/features`,
        method: 'GET',
        description: 'Get all Gherkin feature files',
      },
      {
        path: `${baseUrl}/features/:id`,
        method: 'GET',
        description: 'Get a specific Gherkin feature file by ID',
      },
      {
        path: `${baseUrl}/results`,
        method: 'GET',
        description: 'Get test results from the most recent test run',
      },
      {
        path: `${baseUrl}/regression`,
        method: 'GET',
        description: 'Get regression test results',
      },
      {
        path: `${baseUrl}/baseline`,
        method: 'GET',
        description: 'Get regression baseline',
      },
      {
        path: `${baseUrl}/summary`,
        method: 'GET',
        description: 'Get a combined summary of all Spectra data',
      },
    ],
  });
});

/**
 * @route   GET /api/spectra/features
 * @desc    Get all Gherkin feature files
 * @access  Public
 */
router.get('/features', (req, res) => {
  try {
    const featuresDir = path.join(__dirname, '../../features');
    const files = fs.readdirSync(featuresDir).filter((file) => file.endsWith('.feature'));

    const features = [];
    for (const file of files) {
      const filePath = path.join(featuresDir, file);
      const content = fs.readFileSync(filePath, 'utf8');

      // Extract endpoint from filename (e.g., get__todos.feature -> GET /todos)
      const filenamePattern = /^([a-z]+)__(.+)\.feature$/;
      const match = file.match(filenamePattern);

      let method = '';
      let endpoint = '';

      if (match) {
        method = match[1].toUpperCase();
        endpoint = '/' + match[2].replace(/_/g, '/').replace(/\{id\}/g, ':id');
      }

      // Parse the feature content
      const parsedFeature = parseGherkinFeature(content);
      const scenarios = extractTestScenarios(parsedFeature);

      features.push({
        id: file.replace('.feature', ''),
        filename: file,
        method,
        endpoint,
        title: parsedFeature.title,
        description: parsedFeature.description,
        scenarios,
        rawContent: content,
      });
    }

    res.json(features);
  } catch (error) {
    res.status(500).json({
      error: 'Server Error',
      message: `Failed to retrieve features: ${error.message}`,
    });
  }
});

/**
 * @route   GET /api/spectra/features/:id
 * @desc    Get a specific Gherkin feature file
 * @access  Public
 */
router.get('/features/:id', (req, res) => {
  try {
    const featureId = req.params.id;
    const featuresDir = path.join(__dirname, '../../features');
    const filePath = path.join(featuresDir, `${featureId}.feature`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Feature file not found',
      });
    }

    const content = fs.readFileSync(filePath, 'utf8');

    // Extract endpoint from filename
    const filenamePattern = /^([a-z]+)__(.+)$/;
    const match = featureId.match(filenamePattern);

    let method = '';
    let endpoint = '';

    if (match) {
      method = match[1].toUpperCase();
      endpoint = '/' + match[2].replace(/_/g, '/').replace(/\{id\}/g, ':id');
    }

    // Parse the feature content
    const parsedFeature = parseGherkinFeature(content);
    const scenarios = extractTestScenarios(parsedFeature);

    res.json({
      id: featureId,
      filename: `${featureId}.feature`,
      method,
      endpoint,
      title: parsedFeature.title,
      description: parsedFeature.description,
      scenarios,
      rawContent: content,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Server Error',
      message: `Failed to retrieve feature: ${error.message}`,
    });
  }
});

/**
 * @route   GET /api/spectra/results
 * @desc    Get test results
 * @access  Public
 */
router.get('/results', (req, res) => {
  try {
    const resultsPath = path.join(__dirname, '../../test-results.json');

    if (!fs.existsSync(resultsPath)) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Test results not found. Run tests first with npm run test:backend',
      });
    }

    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

    // Calculate summary statistics
    let passed = 0;
    let failed = 0;

    results.forEach((result) => {
      if (result.success) passed++;
      else failed++;
    });

    res.json({
      summary: {
        total: results.length,
        passed,
        failed,
        passRate: results.length > 0 ? Math.round((passed / results.length) * 100) : 0,
      },
      results,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Server Error',
      message: `Failed to retrieve test results: ${error.message}`,
    });
  }
});

/**
 * @route   GET /api/spectra/regression
 * @desc    Get regression results
 * @access  Public
 */
router.get('/regression', (req, res) => {
  try {
    const regressionPath = path.join(__dirname, '../../regression-results.json');

    if (!fs.existsSync(regressionPath)) {
      return res.status(404).json({
        error: 'Not Found',
        message:
          'Regression results not found. Run regression tests first with npm run test:backend:regression',
      });
    }

    const results = JSON.parse(fs.readFileSync(regressionPath, 'utf8'));
    res.json(results);
  } catch (error) {
    res.status(500).json({
      error: 'Server Error',
      message: `Failed to retrieve regression results: ${error.message}`,
    });
  }
});

/**
 * @route   GET /api/spectra/baseline
 * @desc    Get regression baseline
 * @access  Public
 */
router.get('/baseline', (req, res) => {
  try {
    const baselinePath = path.join(__dirname, '../../regression-baseline.json');

    if (!fs.existsSync(baselinePath)) {
      return res.status(404).json({
        error: 'Not Found',
        message:
          'Regression baseline not found. Run baseline creation first with npm run test:backend:regression:baseline',
      });
    }

    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    res.json(baseline);
  } catch (error) {
    res.status(500).json({
      error: 'Server Error',
      message: `Failed to retrieve regression baseline: ${error.message}`,
    });
  }
});

/**
 * @route   GET /api/spectra/summary
 * @desc    Get a combined summary of all Spectra data
 * @access  Public
 */
router.get('/summary', (req, res) => {
  try {
    const featuresDir = path.join(__dirname, '../../features');
    const resultsPath = path.join(__dirname, '../../test-results.json');
    const regressionPath = path.join(__dirname, '../../regression-results.json');
    const baselinePath = path.join(__dirname, '../../regression-baseline.json');

    // Get features
    let features = [];
    if (fs.existsSync(featuresDir)) {
      const files = fs.readdirSync(featuresDir).filter((file) => file.endsWith('.feature'));
      features = files.map((file) => {
        const filenamePattern = /^([a-z]+)__(.+)\.feature$/;
        const match = file.match(filenamePattern);

        let method = '';
        let endpoint = '';

        if (match) {
          method = match[1].toUpperCase();
          endpoint = '/' + match[2].replace(/_/g, '/').replace(/\{id\}/g, ':id');
        }

        const filePath = path.join(featuresDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const parsedFeature = parseGherkinFeature(content);

        return {
          id: file.replace('.feature', ''),
          filename: file,
          method,
          endpoint,
          title: parsedFeature.title,
          scenarioCount: parsedFeature.scenarios.length,
        };
      });
    }

    // Get test results summary
    let results = { available: false };
    if (fs.existsSync(resultsPath)) {
      const resultsData = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
      let passed = 0;
      let failed = 0;

      resultsData.forEach((result) => {
        if (result.success) passed++;
        else failed++;
      });

      results = {
        available: true,
        total: resultsData.length,
        passed,
        failed,
        passRate: resultsData.length > 0 ? Math.round((passed / resultsData.length) * 100) : 0,
        lastRun: fs.statSync(resultsPath).mtime,
      };
    }

    // Get regression info
    let regression = { available: false };
    if (fs.existsSync(regressionPath)) {
      const regressionData = JSON.parse(fs.readFileSync(regressionPath, 'utf8'));
      regression = {
        available: true,
        summary: regressionData,
        lastRun: fs.statSync(regressionPath).mtime,
      };
    }

    // Get baseline info
    let baseline = { available: false };
    if (fs.existsSync(baselinePath)) {
      baseline = {
        available: true,
        lastRun: fs.statSync(baselinePath).mtime,
      };
    }

    res.json({
      features: {
        count: features.length,
        list: features,
      },
      testResults: results,
      regression,
      baseline,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Server Error',
      message: `Failed to retrieve summary: ${error.message}`,
    });
  }
});

module.exports = router;

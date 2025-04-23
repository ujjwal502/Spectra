/**
 * Gherkin Feature Parser
 *
 * Utility functions to parse Gherkin feature files into structured objects
 */

/**
 * Parse a Gherkin feature file content into a structured object
 * @param {string} content - Raw content of the feature file
 * @returns {Object} Parsed feature object
 */
function parseGherkinFeature(content) {
  const lines = content.split('\n').map((line) => line.trim());

  const feature = {
    title: '',
    description: '',
    scenarios: [],
  };

  let currentScenario = null;
  let inDescription = false;
  let descriptionLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines
    if (!line) continue;

    // Parse Feature line
    if (line.startsWith('Feature:')) {
      feature.title = line.substring('Feature:'.length).trim();
      inDescription = true;
      continue;
    }

    // Collect description lines until a Scenario is found
    if (inDescription && !line.startsWith('Scenario:')) {
      descriptionLines.push(line);
      continue;
    }

    // Parse Scenario
    if (line.startsWith('Scenario:')) {
      // End description collection
      if (inDescription) {
        feature.description = descriptionLines.join('\n').trim();
        inDescription = false;
      }

      // Save previous scenario if exists
      if (currentScenario) {
        feature.scenarios.push(currentScenario);
      }

      // Create new scenario
      currentScenario = {
        title: line.substring('Scenario:'.length).trim(),
        steps: [],
      };
      continue;
    }

    // Parse steps
    if (
      currentScenario &&
      (line.startsWith('Given ') ||
        line.startsWith('When ') ||
        line.startsWith('Then ') ||
        line.startsWith('And ') ||
        line.startsWith('But '))
    ) {
      // Find the keyword
      const keywords = ['Given ', 'When ', 'Then ', 'And ', 'But '];
      let keyword = '';
      let text = '';

      for (const k of keywords) {
        if (line.startsWith(k)) {
          keyword = k.trim();
          text = line.substring(k.length).trim();
          break;
        }
      }

      if (keyword && text) {
        currentScenario.steps.push({
          keyword,
          text,
        });
      }
    }
  }

  // Add the last scenario
  if (currentScenario) {
    feature.scenarios.push(currentScenario);
  }

  return feature;
}

/**
 * Extract test scenarios to create a more testable structure
 * @param {Object} feature - Parsed feature object
 * @returns {Array} Array of test scenarios
 */
function extractTestScenarios(feature) {
  return feature.scenarios.map((scenario) => {
    const testSteps = {
      setup: [],
      action: [],
      verification: [],
    };

    for (const step of scenario.steps) {
      if (step.keyword === 'Given') {
        testSteps.setup.push(step.text);
      } else if (step.keyword === 'When') {
        testSteps.action.push(step.text);
      } else if (step.keyword === 'Then' || step.keyword === 'And' || step.keyword === 'But') {
        testSteps.verification.push(step.text);
      }
    }

    return {
      title: scenario.title,
      steps: scenario.steps,
      testSteps,
    };
  });
}

module.exports = {
  parseGherkinFeature,
  extractTestScenarios,
};

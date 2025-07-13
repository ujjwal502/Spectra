import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { SpecGeneratorOptions } from './types';
import { EnhancedSpecIntegration } from './integrations/enhancedSpecIntegration';

dotenv.config();

/**
 * Run the API spec generation
 */
async function main(): Promise<void> {
  // Move args declaration outside the try block
  const args = process.argv.slice(2);

  try {
    const command = args[0];

    // Remove AI flag filtering - keep all original args
    const processedArgs = args;

    // Check for AI availability
    const useAI = process.env.OPENAI_API_KEY ? true : false;

    if (!useAI) {
      console.error('⚠️ AI features disabled. Please set OPENAI_API_KEY in your environment');
      process.exit(1);
    }

    console.log('🧠 AI-powered features enabled');

    switch (command) {
      case 'generate-spec': {
        const sourcePath = processedArgs[1];
        const outputPath = processedArgs[2] || 'api-schema.json';

        if (!sourcePath) {
          console.error('❌ Source path is required for generate-spec command');
          console.log('Usage: npm run dev generate-spec <source-path> [output-path] [options]');
          console.log('\nOptions:');
          console.log('  --no-group       Disable grouping endpoints by resource');
          console.log('  --no-prefix      Disable API prefix preservation');
          console.log('  --no-jsdoc       Disable JSDoc extraction');
          console.log('  --base-url=URL   Set the API base URL (default: http://localhost:3000)');
          process.exit(1);
        }

        console.log(`🔍 Analyzing codebase in ${sourcePath}...`);

        try {
          // Parse options
          const options: Partial<SpecGeneratorOptions> = {};

          // Set defaults
          options.groupByResource = true;
          options.preserveApiPrefix = true;
          options.extractJSDocComments = true;
          options.baseUrl = 'http://localhost:3000';

          // Process command line options
          processedArgs.forEach((arg) => {
            if (arg === '--no-group') {
              options.groupByResource = false;
            } else if (arg === '--no-prefix') {
              options.preserveApiPrefix = false;
            } else if (arg === '--no-jsdoc') {
              options.extractJSDocComments = false;
            } else if (arg.startsWith('--base-url=')) {
              options.baseUrl = arg.split('=')[1];
            }
          });

          // Log the configuration
          console.log('\n🛠️ Configuration:');
          console.log(`  Group by resource: ${options.groupByResource ? 'enabled' : 'disabled'}`);
          console.log(
            `  API prefix preservation: ${options.preserveApiPrefix ? 'enabled' : 'disabled'}`,
          );
          console.log(
            `  JSDoc extraction: ${options.extractJSDocComments ? 'enabled' : 'disabled'}`,
          );
          console.log('  AI enhancement: enabled (using OpenAI API)');
          console.log('  Enhanced AI schema generation: enabled');
          console.log(`  Base URL: ${options.baseUrl}`);

          // Generate OpenAPI spec directly from the source code with options
          console.log(`\n🔄 Generating OpenAPI spec from ${sourcePath}...`);

          // Create Enhanced Spec Integration with options
          const enhancedSpecIntegration = new EnhancedSpecIntegration(options);
          const openApiSpec = await enhancedSpecIntegration.generateSpec(sourcePath);

          // Save OpenAPI spec to file
          fs.writeFileSync(outputPath, JSON.stringify(openApiSpec, null, 2), 'utf8');

          console.log(`✅ OpenAPI spec saved to ${outputPath}`);
          console.log(`\n💡 You can now use this spec with Spectra:`);
          console.log(`  npm run test:demo-api:intelligent`);
        } catch (error) {
          console.error(
            `❌ Failed to generate OpenAPI spec: ${error instanceof Error ? error.message : error}`,
          );
          if (error instanceof Error && error.stack) {
            console.error(error.stack);
          }
          process.exit(1);
        }
        break;
      }

      default:
        console.log(`
API Spec Generation Tool

Usage:
  npm run generate:spec:demo-api

This tool generates OpenAPI specifications from source code using AI-powered analysis.

Options:
  --no-group       Disable grouping endpoints by resource
  --no-prefix      Disable API prefix preservation
  --no-jsdoc       Disable JSDoc extraction
  --base-url=URL   Set the API base URL (default: http://localhost:3000)

Note: 
- AI-powered schema enhancement requires OPENAI_API_KEY in your environment
- Generated specs can be used with the intelligent testing command

Examples:
  npm run generate:spec:demo-api
        `);
        break;
    }
  } catch (error) {
    console.error(`❌ Execution failed: ${error instanceof Error ? error.message : error}`);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the main function
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

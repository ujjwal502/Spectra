#!/usr/bin/env node

import { Command } from 'commander';
import { addEnhancedCommands } from './enhancedCommands';
import dotenv from 'dotenv';

dotenv.config();

const program = new Command();

program
  .name('spectra-enhanced')
  .description('Enhanced AI-powered API testing automation with LangGraph + Repomix')
  .version('0.3.0');

addEnhancedCommands(program);

program
  .command('info')
  .description('Show information about enhanced features')
  .action(() => {
    console.log(`
🌟 Spectra Enhanced - AI-Powered API Testing

Enhanced Highlights:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 Codebase-aware analysis via context
🧠 AI-driven multi-phase testing workflow
🚀 Orchestrated steps with retries and insights

Available Commands:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  run-intelligent-testing <apiSpecPath>  Run intelligent testing on an OpenAPI spec
  check-env                              Check environment configuration
  info                                   Show this information

Examples (Node):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  # Show info
  npx ts-node src/cli/enhanced.ts info

  # Check env
  OPENAI_API_KEY=your_key npx ts-node src/cli/enhanced.ts check-env

  # Run intelligent testing
  OPENAI_API_KEY=your_key npx ts-node src/cli/enhanced.ts run-intelligent-testing ./path/to/openapi.json

Examples (Docker):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  # Show info (default)
  docker run --rm spectra-pilot:0.3.0

  # Or explicitly
  docker run --rm spectra-pilot:0.3.0 info

  # Check env
  docker run --rm -e OPENAI_API_KEY=your_key spectra-pilot:0.3.0 check-env

  # Run testing with a mounted directory
  docker run --rm -e OPENAI_API_KEY=your_key -v "$PWD:/work" \
    spectra-pilot:0.3.0 run-intelligent-testing /work/path/to/openapi.json

Prerequisites:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✅ OPENAI_API_KEY environment variable (required)
  ✅ Node.js 16+ (if running outside Docker)

Get Started:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1. Set your OpenAI API key: export OPENAI_API_KEY=your_key_here
  2. Show info: npx ts-node src/cli/enhanced.ts info
  3. Run testing: npx ts-node src/cli/enhanced.ts run-intelligent-testing ./your_openapi.json

For more help on specific commands, use: --help with any command
    `);
  });

program
  .command('check-env')
  .description('Check if environment is properly configured')
  .action(() => {
    console.log('🔧 Environment Check\n');

    const checks = [
      {
        name: 'OpenAI API Key',
        check: () => !!process.env.OPENAI_API_KEY,
        required: true,
        fix: 'Set OPENAI_API_KEY environment variable',
      },
      {
        name: 'Node.js Version',
        check: () => {
          const version = process.version;
          const major = parseInt(version.slice(1).split('.')[0]);
          return major >= 16;
        },
        required: true,
        fix: 'Upgrade to Node.js 16 or higher',
      },
    ];

    let allPassed = true;

    checks.forEach((check) => {
      const passed = check.check();
      const icon = passed ? '✅' : check.required ? '❌' : '⚠️';
      console.log(`${icon} ${check.name}: ${passed ? 'OK' : 'FAILED'}`);

      if (!passed) {
        console.log(`   Fix: ${check.fix}`);
        if (check.required) {
          allPassed = false;
        }
      }
    });

    console.log();

    if (allPassed) {
      console.log('🎉 Environment is ready for Spectra Enhanced!');
      console.log('Try: npx ts-node src/cli/enhanced.ts run-intelligent-testing ./path/to/openapi.json');
    } else {
      console.log('❌ Please fix the above issues before using enhanced features.');
      process.exit(1);
    }
  });

program.parse(process.argv);

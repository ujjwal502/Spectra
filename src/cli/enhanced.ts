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
🌟 Spectra Enhanced - AI-Powered API Testing with LangGraph + Repomix

Enhanced Features:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 Complete Codebase Analysis
   • Repomix packs entire codebase for AI analysis
   • Framework-agnostic endpoint discovery
   • Business context understanding

🧠 AI-Powered Multi-Agent Workflow
   • Repository Analysis Agent
   • API Discovery Agent  
   • Schema Generation Agent
   • Validation Agent
   • Enhancement Agent

🚀 LangGraph-Inspired Orchestration
   • Sequential workflow with conditional branching
   • Error handling and fallback mechanisms
   • Confidence-based decision making

📊 Comprehensive Analysis & Comparison
   • Side-by-side comparison with traditional methods
   • Detailed confidence metrics
   • Performance analysis
   • Business context insights

Available Commands:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  generate-spec-enhanced  Generate OpenAPI spec using AI + Repomix
  compare-generation      Compare enhanced vs traditional methods
  demo-enhanced           Run demo on built-in examples
  batch-enhanced          Process multiple codebases
  info                    Show this information

Prerequisites:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✅ OPENAI_API_KEY environment variable (required)
  ✅ Repomix for codebase analysis (installed automatically)
  ✅ LangGraph.js for workflow orchestration (installed automatically)

Examples:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  # Generate enhanced OpenAPI spec
  npx ts-node src/cli/enhanced.ts generate-spec-enhanced ./my-api-code

  # Compare methods and generate analysis report  
  npx ts-node src/cli/enhanced.ts generate-spec-enhanced ./my-api-code --compare

  # Run comprehensive demo
  npx ts-node src/cli/enhanced.ts demo-enhanced

  # Compare methods side-by-side
  npx ts-node src/cli/enhanced.ts compare-generation ./my-api-code

Get Started:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1. Set your OpenAI API key: export OPENAI_API_KEY=your_key_here
  2. Try the demo: npx ts-node src/cli/enhanced.ts demo-enhanced  
  3. Analyze your codebase: npx ts-node src/cli/enhanced.ts generate-spec-enhanced ./your-code

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
      console.log('🎉 Environment is ready for enhanced Spectra features!');
      console.log('Try: npx ts-node src/cli/enhanced.ts demo-enhanced');
    } else {
      console.log('❌ Please fix the above issues before using enhanced features.');
      process.exit(1);
    }
  });

program.parse(process.argv);

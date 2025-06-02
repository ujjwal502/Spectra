#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting Spectra Demo UI...\n');

// Check if we're in the UI directory
const uiDir = __dirname;
const packageJsonPath = path.join(uiDir, 'package.json');

if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ package.json not found in UI directory');
  console.error('Please run this script from the src/ui directory');
  process.exit(1);
}

// Install dependencies if node_modules doesn't exist
const nodeModulesPath = path.join(uiDir, 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
  console.log('📦 Installing UI dependencies...');
  const installProcess = spawn('npm', ['install'], {
    cwd: uiDir,
    stdio: 'inherit',
    shell: true,
  });

  installProcess.on('close', (code) => {
    if (code !== 0) {
      console.error('❌ Failed to install dependencies');
      process.exit(1);
    }
    buildAndStart();
  });
} else {
  buildAndStart();
}

function buildAndStart() {
  console.log('🔨 Building React application...');

  const buildProcess = spawn('npm', ['run', 'build'], {
    cwd: uiDir,
    stdio: 'inherit',
    shell: true,
  });

  buildProcess.on('close', (code) => {
    if (code !== 0) {
      console.error('❌ Build failed');
      process.exit(1);
    }

    console.log('✅ Build completed successfully');
    console.log('🌐 Starting demo server...\n');

    // Start the demo server
    const serverProcess = spawn('node', ['server.cjs'], {
      cwd: uiDir,
      stdio: 'inherit',
      shell: true,
    });

    serverProcess.on('close', (code) => {
      console.log(`Demo server exited with code ${code}`);
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down demo server...');
      serverProcess.kill('SIGINT');
      process.exit(0);
    });
  });
}

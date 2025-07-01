#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting Spectra Backend Server...\n');

// Check if we're in the project root
const projectRoot = process.cwd();
const backendDir = path.join(projectRoot, 'examples', 'backend');

if (!fs.existsSync(backendDir)) {
  console.error('❌ Backend directory not found');
  console.error('Please run this script from the Spectra project root');
  process.exit(1);
}

// Check if package.json exists in backend
const backendPackageJson = path.join(backendDir, 'package.json');
if (!fs.existsSync(backendPackageJson)) {
  console.error('❌ Backend package.json not found');
  console.error('Please ensure the backend example is properly set up');
  process.exit(1);
}

// Install dependencies if node_modules doesn't exist
const nodeModulesPath = path.join(backendDir, 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
  console.log('📦 Installing backend dependencies...');
  const installProcess = spawn('npm', ['install'], {
    cwd: backendDir,
    stdio: 'inherit',
    shell: true,
  });

  installProcess.on('close', (code) => {
    if (code !== 0) {
      console.error('❌ Failed to install backend dependencies');
      process.exit(1);
    }
    startBackend();
  });
} else {
  startBackend();
}

function startBackend() {
  console.log('🌐 Starting backend server on http://localhost:3001...\n');

  // Start the backend server
  const serverProcess = spawn('npm', ['run', 'dev'], {
    cwd: backendDir,
    stdio: 'inherit',
    shell: true,
  });

  serverProcess.on('close', (code) => {
    console.log(`Backend server exited with code ${code}`);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down backend server...');
    serverProcess.kill('SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down backend server...');
    serverProcess.kill('SIGTERM');
    process.exit(0);
  });
}

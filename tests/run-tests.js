/**
 * Test Runner for Azan Dashboard
 * 
 * This script runs the automated tests for the Azan Dashboard application.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Print header
console.log(`${colors.bright}${colors.blue}==================================${colors.reset}`);
console.log(`${colors.bright}${colors.blue}  Azan Dashboard Test Runner     ${colors.reset}`);
console.log(`${colors.bright}${colors.blue}==================================${colors.reset}`);
console.log();

// Check if server is running
async function isServerRunning() {
  try {
    const response = await fetch('http://localhost:3000/api/health');
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Run a specific test file
async function runTest(testFile) {
  return new Promise((resolve, reject) => {
    console.log(`${colors.cyan}Running test: ${path.basename(testFile)}${colors.reset}`);
    
    const mochaPath = path.join(__dirname, '../node_modules/.bin/mocha');
    const mocha = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['mocha', testFile], {
      stdio: 'inherit'
    });
    
    mocha.on('close', (code) => {
      if (code === 0) {
        console.log(`${colors.green}✓ Test passed: ${path.basename(testFile)}${colors.reset}`);
        resolve(true);
      } else {
        console.log(`${colors.red}✗ Test failed: ${path.basename(testFile)}${colors.reset}`);
        resolve(false);
      }
    });
    
    mocha.on('error', (err) => {
      console.error(`${colors.red}Error running test: ${err}${colors.reset}`);
      reject(err);
    });
  });
}

// Main function
async function main() {
  try {
    // Check if server is running
    const serverRunning = await isServerRunning();
    if (!serverRunning) {
      console.log(`${colors.yellow}Warning: Server doesn't appear to be running at http://localhost:3000${colors.reset}`);
      console.log(`${colors.yellow}Please start the server before running tests.${colors.reset}`);
      console.log(`${colors.yellow}You can start the server by running: npm start${colors.reset}`);
      process.exit(1);
    }
    
    console.log(`${colors.green}Server is running. Starting tests...${colors.reset}`);
    
    // Check for Selenium WebDriver dependencies
    try {
      require('selenium-webdriver');
    } catch (error) {
      console.log(`${colors.red}Error: selenium-webdriver not found${colors.reset}`);
      console.log(`${colors.yellow}Please install it by running: npm install selenium-webdriver${colors.reset}`);
      process.exit(1);
    }
    
    // Check if ChromeDriver is installed
    try {
      require('chromedriver');
    } catch (error) {
      console.log(`${colors.red}Error: chromedriver not found${colors.reset}`);
      console.log(`${colors.yellow}Please install it by running: npm install chromedriver${colors.reset}`);
      process.exit(1);
    }
    
    // Get test files
    const testFiles = process.argv.slice(2);
    
    if (testFiles.length === 0) {
      // If no specific tests provided, run all tests
      console.log(`${colors.bright}Running all tests:${colors.reset}`);
      const sourceTest = path.join(__dirname, 'source-switching.test.js');
      await runTest(sourceTest);
    } else {
      // Run specified tests
      console.log(`${colors.bright}Running specified tests:${colors.reset}`);
      for (const testFile of testFiles) {
        const fullPath = path.resolve(testFile);
        if (fs.existsSync(fullPath)) {
          await runTest(fullPath);
        } else {
          console.log(`${colors.red}Test file not found: ${testFile}${colors.reset}`);
        }
      }
    }
    
    console.log();
    console.log(`${colors.bright}${colors.blue}==================================${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}  Test execution completed       ${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}==================================${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}Error running tests: ${error}${colors.reset}`);
    process.exit(1);
  }
}

// Run the main function
main(); 
/**
 * Security Review and Authentication Test
 * 
 * This script tests the authentication requirements for all API endpoints
 * to ensure proper security controls are in place.
 * 
 * Tests:
 * 1. Public endpoints are accessible without authentication
 * 2. Protected endpoints require valid authentication
 * 3. Setup modal is accessible without authentication
 * 4. Authentication bypass prevention
 */

import fetch from 'node-fetch';
import { createHash } from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const BASE_URL = 'http://localhost:3002';
const TEST_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const TEST_PASSWORD = 'test_password'; // Use a test password, not the real one

// Authentication token storage
let authToken = null;

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0
};

// List of endpoints to test
const endpoints = [
  // Public endpoints - should be accessible without authentication
  { method: 'GET', path: '/api/prayer-times', requiresAuth: false, name: 'Get Prayer Times' },
  { method: 'GET', path: '/api/prayer-source-info', requiresAuth: false, name: 'Get Prayer Source Info' },
  { method: 'GET', path: '/api/features', requiresAuth: false, name: 'Get Features' },
  { method: 'GET', path: '/api/prayer-sources', requiresAuth: false, name: 'Get Available Prayer Sources' },
  { method: 'GET', path: '/api/prayer-source/timezones', requiresAuth: false, name: 'Get Valid Timezones' },
  { method: 'GET', path: '/api/logs', requiresAuth: false, name: 'Get Logs' },
  { method: 'GET', path: '/api/logs/stream', requiresAuth: false, name: 'Stream Logs' },
  { method: 'GET', path: '/api/logs/last-error', requiresAuth: false, name: 'Get Last Error' },
  { method: 'GET', path: '/api/test-mode', requiresAuth: false, name: 'Get Test Mode' },
  { method: 'GET', path: '/api/auth/status', requiresAuth: false, name: 'Check Auth Status' },
  
  // Protected endpoints - should require authentication
  { method: 'POST', path: '/api/prayer-times/refresh', requiresAuth: true, name: 'Refresh Prayer Times' },
  { method: 'GET', path: '/api/prayer-source-settings', requiresAuth: true, name: 'Get Prayer Source Settings' },
  { method: 'POST', path: '/api/prayer-source/validate/mymasjid', requiresAuth: true, name: 'Validate MyMasjid Guild ID', body: { guildId: 'test-guild-id' } },
  { method: 'POST', path: '/api/prayer-source/validate/aladhan', requiresAuth: true, name: 'Validate Aladhan Parameters', body: { latitude: 0, longitude: 0, timezone: 'UTC' } },
  { method: 'POST', path: '/api/prayer-source/validate', requiresAuth: true, name: 'Validate Prayer Source Settings', body: { source: 'mymasjid', guildId: 'test-guild-id' } },
  { method: 'POST', path: '/api/prayer-source', requiresAuth: true, name: 'Update Prayer Source', body: { source: 'mymasjid', guildId: 'test-guild-id' } },
  { method: 'POST', path: '/api/prayer-source/test', requiresAuth: true, name: 'Test Prayer Source Connection', body: { source: 'mymasjid', guildId: 'test-guild-id' } },
  { method: 'POST', path: '/api/logs/clear', requiresAuth: true, name: 'Clear Logs' },
  { method: 'POST', path: '/api/features', requiresAuth: true, name: 'Update Features', body: { systemLogsEnabled: true } },
  { method: 'POST', path: '/api/test-mode', requiresAuth: true, name: 'Update Test Mode', body: { enabled: false } },
  { method: 'POST', path: '/api/auth/logout', requiresAuth: true, name: 'Logout' }
];

/**
 * Format console output with colors
 */
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Log a message with color
 */
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Authenticate and get token
 */
async function authenticate() {
  try {
    log('\n🔐 Authenticating...', colors.cyan);
    
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: TEST_USERNAME,
        password: TEST_PASSWORD
      })
    });
    
    const data = await response.json();
    
    if (data.success && data.token) {
      authToken = data.token;
      log('✅ Authentication successful', colors.green);
      return true;
    } else {
      log(`❌ Authentication failed: ${data.message || 'Unknown error'}`, colors.red);
      log('⚠️ Make sure you set the correct ADMIN_USERNAME in .env and update TEST_PASSWORD in this script if needed.', colors.yellow);
      return false;
    }
  } catch (error) {
    log(`❌ Authentication error: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Test an endpoint with and without authentication
 */
async function testEndpoint(endpoint) {
  log(`\n🧪 Testing ${endpoint.method} ${endpoint.path} (${endpoint.name})`, colors.cyan);
  
  // First test without authentication
  try {
    const options = {
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (endpoint.body) {
      options.body = JSON.stringify(endpoint.body);
    }
    
    const response = await fetch(`${BASE_URL}${endpoint.path}`, options);
    const status = response.status;
    
    if (!endpoint.requiresAuth) {
      // Public endpoint should be accessible
      if (status >= 200 && status < 300) {
        log(`✅ Public endpoint accessible without auth (${status})`, colors.green);
        testResults.passed++;
      } else {
        log(`❌ Public endpoint not accessible without auth (${status})`, colors.red);
        testResults.failed++;
      }
    } else {
      // Protected endpoint should return 401 Unauthorized
      if (status === 401) {
        log(`✅ Protected endpoint correctly requires auth (${status})`, colors.green);
        testResults.passed++;
      } else {
        log(`❌ SECURITY ISSUE: Protected endpoint accessible without auth (${status})`, colors.red);
        testResults.failed++;
      }
    }
  } catch (error) {
    log(`❌ Error testing without auth: ${error.message}`, colors.red);
    testResults.failed++;
  }
  
  // Now test with authentication (if we have a token)
  if (authToken) {
    try {
      const options = {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': authToken
        }
      };
      
      if (endpoint.body) {
        options.body = JSON.stringify(endpoint.body);
      }
      
      const response = await fetch(`${BASE_URL}${endpoint.path}`, options);
      const status = response.status;
      
      if (endpoint.requiresAuth) {
        // Protected endpoint should be accessible with auth
        if (status >= 200 && status < 300) {
          log(`✅ Protected endpoint accessible with auth (${status})`, colors.green);
          testResults.passed++;
        } else {
          log(`❌ Protected endpoint not accessible with auth (${status})`, colors.red);
          testResults.failed++;
        }
      } else {
        // Public endpoint should also be accessible with auth
        if (status >= 200 && status < 300) {
          log(`✅ Public endpoint accessible with auth (${status})`, colors.green);
          testResults.passed++;
        } else {
          log(`❌ Public endpoint not accessible with auth (${status})`, colors.red);
          testResults.failed++;
        }
      }
    } catch (error) {
      log(`❌ Error testing with auth: ${error.message}`, colors.red);
      testResults.failed++;
    }
  } else {
    log('⚠️ Skipping auth test (no token)', colors.yellow);
    testResults.skipped++;
  }
}

/**
 * Test authentication bypass attempts
 */
async function testAuthBypass() {
  log('\n🧪 Testing Authentication Bypass Prevention', colors.cyan);
  
  // Test 1: Empty token
  try {
    const response = await fetch(`${BASE_URL}/api/prayer-source-settings`, {
      headers: {
        'x-auth-token': ''
      }
    });
    
    if (response.status === 401) {
      log('✅ Empty token correctly rejected', colors.green);
      testResults.passed++;
    } else {
      log(`❌ SECURITY ISSUE: Empty token accepted (${response.status})`, colors.red);
      testResults.failed++;
    }
  } catch (error) {
    log(`❌ Error testing empty token: ${error.message}`, colors.red);
    testResults.failed++;
  }
  
  // Test 2: Invalid token format
  try {
    const response = await fetch(`${BASE_URL}/api/prayer-source-settings`, {
      headers: {
        'x-auth-token': 'invalid-token'
      }
    });
    
    if (response.status === 401) {
      log('✅ Invalid token correctly rejected', colors.green);
      testResults.passed++;
    } else {
      log(`❌ SECURITY ISSUE: Invalid token accepted (${response.status})`, colors.red);
      testResults.failed++;
    }
  } catch (error) {
    log(`❌ Error testing invalid token: ${error.message}`, colors.red);
    testResults.failed++;
  }
  
  // Test 3: SQL Injection attempt in token
  try {
    const response = await fetch(`${BASE_URL}/api/prayer-source-settings`, {
      headers: {
        'x-auth-token': "' OR '1'='1"
      }
    });
    
    if (response.status === 401) {
      log('✅ SQL Injection attempt correctly rejected', colors.green);
      testResults.passed++;
    } else {
      log(`❌ SECURITY ISSUE: SQL Injection attempt accepted (${response.status})`, colors.red);
      testResults.failed++;
    }
  } catch (error) {
    log(`❌ Error testing SQL injection: ${error.message}`, colors.red);
    testResults.failed++;
  }
}

/**
 * Test setup modal accessibility
 */
async function testSetupModalAccessibility() {
  log('\n🧪 Testing Setup Modal Accessibility', colors.cyan);
  
  try {
    // Check if the setup endpoint is accessible without auth
    const response = await fetch(`${BASE_URL}/api/config/status`);
    
    if (response.status >= 200 && response.status < 300) {
      log('✅ Setup status endpoint accessible without auth', colors.green);
      testResults.passed++;
      
      // Check the response to see if setup is needed
      const data = await response.json();
      log(`ℹ️ Setup needed: ${data.needsSetup}`, colors.blue);
    } else {
      log(`❌ Setup status endpoint not accessible without auth (${response.status})`, colors.red);
      testResults.failed++;
    }
  } catch (error) {
    log(`❌ Error testing setup modal accessibility: ${error.message}`, colors.red);
    testResults.failed++;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  log('🚀 Starting Security Review and Authentication Tests', colors.magenta);
  
  // First authenticate
  const authSuccess = await authenticate();
  
  // Test each endpoint
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }
  
  // Test authentication bypass prevention
  await testAuthBypass();
  
  // Test setup modal accessibility
  await testSetupModalAccessibility();
  
  // Print summary
  log('\n📊 Test Summary:', colors.magenta);
  log(`✅ Passed: ${testResults.passed}`, colors.green);
  log(`❌ Failed: ${testResults.failed}`, colors.red);
  log(`⚠️ Skipped: ${testResults.skipped}`, colors.yellow);
  
  if (testResults.failed > 0) {
    log('\n⚠️ Some tests failed. Please review the security issues above.', colors.red);
    process.exit(1);
  } else {
    log('\n✅ All tests passed! Authentication is properly implemented.', colors.green);
    process.exit(0);
  }
}

// Run the tests
runTests().catch(error => {
  log(`❌ Unhandled error: ${error.message}`, colors.red);
  process.exit(1);
}); 
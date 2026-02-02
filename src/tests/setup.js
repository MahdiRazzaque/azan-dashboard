require('module-alias/register');
// Global setup file to suppress console logs
global.console = {
  ...console,
  // Keep native behaviour for other methods, use empty function for these
  log: process.env.DEBUG ? console.log : jest.fn(),
  info: process.env.DEBUG ? console.info : jest.fn(),
  warn: process.env.DEBUG ? console.warn : jest.fn(),
  debug: process.env.DEBUG ? console.debug : jest.fn(),
  // Always let errors through so we can see why tests fail
  error: console.error,
};

// Set test environment variables
process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

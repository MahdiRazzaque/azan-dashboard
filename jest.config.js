module.exports = {
  testEnvironment: 'node',
  verbose: true,
  moduleFileExtensions: ['js', 'json', 'node'],
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  clearMocks: true,
  collectCoverage: false,
};

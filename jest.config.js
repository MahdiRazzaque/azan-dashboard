module.exports = {
  testEnvironment: 'node',
  verbose: true,
  moduleFileExtensions: ['js', 'json', 'node'],
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  clearMocks: true,
  collectCoverage: false,
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/client/",
    "/public/"
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/client/",
    "/public/"
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
};

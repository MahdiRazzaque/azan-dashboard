module.exports = {
  rootDir: '../',
  testEnvironment: 'node',
  verbose: true,
  moduleFileExtensions: ['js', 'json', 'node'],
  roots: ['<rootDir>/src'],
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
  moduleNameMapper: {
    '^@adapters/(.*)$': '<rootDir>/src/adapters/$1',
    '^@providers$': '<rootDir>/src/providers',
    '^@providers/(.*)$': '<rootDir>/src/providers/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@config$': '<rootDir>/src/config',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@outputs$': '<rootDir>/src/outputs',
    '^@outputs/(.*)$': '<rootDir>/src/outputs/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@routes/(.*)$': '<rootDir>/src/routes/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js'],
};
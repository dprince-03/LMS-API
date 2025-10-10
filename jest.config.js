// module.exports = {
//   testEnvironment: 'node',
//   testMatch: ['**/test/**/*.test.js', '**/test/**/*.spec.js'],
//   collectCoverageFrom: [
//     'src/**/*.js',
//     '!src/**/*.test.js',
//     '!src/**/*.spec.js'
//   ],
//   coverageDirectory: 'coverage',
//   coverageReporters: ['text', 'lcov', 'html'],
//   setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
//   testTimeout: 10000,
//   verbose: true
// };

module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/config/**',
    '!**/node_modules/**'
  ],
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js'
  ],
  verbose: true,
  testTimeout: 10000,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
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


// module.exports = {
//   testEnvironment: 'node',
//   coverageDirectory: 'coverage',
//   collectCoverageFrom: [
//     'src/**/*.js',
//     '!src/config/**',
//     '!**/node_modules/**'
//   ],
//   testMatch: [
//     '**/tests/**/*.test.js',
//     '**/__tests__/**/*.js'
//   ],
//   verbose: true,
//   testTimeout: 10000,
//   setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
//   coverageThreshold: {
//     global: {
//       branches: 70,
//       functions: 70,
//       lines: 70,
//       statements: 70
//     }
//   }
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
  testTimeout: 30000,
  
  // Setup file runs before each test file
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Global teardown runs once after all tests
  globalTeardown: '<rootDir>/tests/teardown.js',
  
  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Force exit after tests complete
  forceExit: true,
  
  // Detect async operations that weren't properly handled
  detectOpenHandles: false,
  
  // Maximum workers (use 1 for sequential execution)
  maxWorkers: 1
};
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['./tests/setup.js'],
  globalTeardown: './tests/globalTeardown.js',
  // Integration tests share PG `tita_test` DB — chạy serial để tránh race trên DDL.
  maxWorkers: 1,
  // knex pool giữ keep-alive connection sau test → forceExit cho jest worker thoát sạch.
  // globalTeardown vẫn destroy knex singleton ở controller process.
  forceExit: true,
  testTimeout: 30000,
  // captchapng@0.0.1 ship package.json kèm UTF-8 BOM → jest-resolve không đọc được.
  // Map sang mock stub trong tests/__mocks__.
  moduleNameMapper: {
    '^captchapng$': '<rootDir>/tests/__mocks__/captchapng.js',
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'services/**/*.js',
    'middlewares/**/*.js',
    'common/**/*.js',
    '!**/node_modules/**',
  ],
};

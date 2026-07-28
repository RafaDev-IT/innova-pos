module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  globalSetup: '<rootDir>/tests/globalSetup.js',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/server.js', '!src/database/**'],
  coverageDirectory: 'coverage',
  // Las suites comparten una única base de datos de test, por eso corren en serie
  // (`--runInBand`) y se les da margen para migrar antes del primer test.
  testTimeout: 30000,
  verbose: true,
};

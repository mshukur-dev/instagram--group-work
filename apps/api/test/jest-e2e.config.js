// E2E tests against a real database: test/**/*.e2e-spec.ts
module.exports = {
  rootDir: '.',
  testRegex: '.*\.e2e-spec\.ts$',
  transform: { '^.+\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }] },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testEnvironment: 'node',
  testTimeout: 30000,
};

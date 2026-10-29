/** Unit tests: no database, no network. */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/apps/*/test/unit/**/*.spec.ts', '<rootDir>/libs/*/test/**/*.spec.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  moduleNameMapper: { '^@tradedesk/common$': '<rootDir>/libs/common/src/index.ts' },
};

/** E2E tests: real Postgres. Needs E2E_PG_URL, for example postgres://postgres@127.0.0.1:54329/postgres */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/apps/*/test/e2e/**/*.e2e-spec.ts'],
  testTimeout: 60000,
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  moduleNameMapper: { '^@tradedesk/common$': '<rootDir>/libs/common/src/index.ts' },
};

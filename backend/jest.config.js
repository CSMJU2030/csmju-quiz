// unit test — ไฟล์ *.spec.ts ใน src
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }] },
  testEnvironment: 'node',
  // Prisma client ที่ generate อ้างไฟล์ด้วย .js → ให้ jest หาไฟล์ .ts แทน
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  collectCoverageFrom: ['**/*.ts', '!generated/**', '!main.ts'],
};

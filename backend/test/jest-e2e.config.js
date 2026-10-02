// e2e — บูตแอปจริง + ฐานข้อมูลจริง (ต้องตั้ง DATABASE_URL) + JWKS ปลอมในเทส
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  testEnvironment: 'node',
  // Prisma client ที่ generate อ้างไฟล์ด้วย .js → ให้ jest หาไฟล์ .ts แทน
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  testTimeout: 30000,
};

// สร้าง openapi.json จาก decorator ของ controller (tech-stack.md ข้อ 3 · กฎ API-01)
// อ่านโค้ดที่ build แล้วใน dist/ (script generate:openapi สั่ง nest build ก่อน)
// ไม่ต้องต่อฐานข้อมูล: preview mode สร้างกราฟโมดูลโดยไม่เรียก lifecycle hook
'use strict';
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');

const PLACEHOLDER_ENV = {
  DATABASE_URL: 'postgresql://localhost/openapi_placeholder',
  CORE_HUB_URL: 'http://localhost:3000',
  CORE_HUB_JWKS_URL: 'http://localhost:3000/api/v1/.well-known/jwks.json',
  CORE_HUB_ISSUER: 'core-hub',
  CORE_HUB_AUDIENCE: 'csmju2030',
  SUBSYSTEM_ID: 'csmju-quiz',
  FRONTEND_URL: 'http://localhost:3102',
};

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sortKeys(value[k])]));
  }
  return value;
}

async function main() {
  // ใช้ค่าคงที่เสมอ เพื่อให้ไฟล์ที่ได้เหมือนกันทุกเครื่อง (CI ตรวจ diff)
  Object.assign(process.env, PLACEHOLDER_ENV);
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../dist/app.module');
  const { buildOpenApi, configureApp } = require('../dist/app.setup');

  const app = await NestFactory.create(AppModule, { preview: true, logger: false });
  configureApp(app, PLACEHOLDER_ENV.FRONTEND_URL);
  const doc = buildOpenApi(app);
  writeFileSync(join(__dirname, '..', 'openapi.json'), `${JSON.stringify(sortKeys(doc), null, 2)}\n`);
  await app.close();
  console.log(`openapi.json written (${Object.keys(doc.paths).length} paths)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

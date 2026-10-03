// การตั้งค่าแอปที่ใช้ร่วมกันระหว่าง main.ts, e2e test และสคริปต์ generate:openapi
import { INestApplication, RequestMethod } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { EnvelopeInterceptor } from './common/envelope.interceptor';
import { createValidationPipe } from './common/validation';
import { SESSION_COOKIE } from './auth/token-extractor';

/**
 * /api/... ทั้งหมด · ยกเว้น GET /auth/login, GET /auth/callback (ต้องตรงกับ callback_url ในทะเบียน)
 * และ POST /auth/logout
 */
export const GLOBAL_PREFIX_OPTIONS = {
  exclude: [
    { path: 'auth/login', method: RequestMethod.GET },
    { path: 'auth/callback', method: RequestMethod.GET },
    { path: 'auth/logout', method: RequestMethod.POST },
  ],
};

/**
 * จำนวน proxy ที่เชื่อ X-Forwarded-For — frontend (Next.js) เป็นประตูเดียวและ proxy /api/* /auth/* มาที่นี่
 * (connect-core-hub ข้อ 0–1) จึงมี 1 hop · req.ip = IP ของเบราว์เซอร์ที่ Next ส่งต่อมา (ใช้กับ rate limit ของผู้เล่น)
 */
export const TRUSTED_PROXY_HOPS = 1;

/** ทุกคำตอบของ /auth/* ต้องมี Cache-Control: no-store (auth-contract ข้อ 5) — รวมถึง 404/405 ของ path อื่นใต้ /auth */
function noStoreOnAuth(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/auth' || req.path.startsWith('/auth/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
}

export function configureApp(
  app: INestApplication,
  frontendOrigin: string,
  { withPrefix = true }: { withPrefix?: boolean } = {},
) {
  const http = app.getHttpAdapter().getInstance() as { set?: (k: string, v: unknown) => void };
  http.set?.('trust proxy', TRUSTED_PROXY_HOPS);
  app.use(noStoreOnAuth);
  if (withPrefix) app.setGlobalPrefix('api', GLOBAL_PREFIX_OPTIONS);
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalInterceptors(new EnvelopeInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new AllExceptionsFilter());
  // เบราว์เซอร์เรียกผ่าน proxy ของ frontend (same-origin) จึงไม่ต้องใช้ CORS แล้ว
  // คงไว้แบบจำกัด origin เดียว (credentials ต้องระบุ origin แน่นอน ไม่ใช่ *) — ไม่มีผลเสีย
  app.enableCors({ origin: frontendOrigin, credentials: true });
}

export function buildOpenApi(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('CSMJU Quiz API')
    .setDescription(
      'API ของระบบย่อย CSMJU Quiz — ทุก response ห่อด้วย { success, data[, meta] } หรือ { success: false, error }',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addCookieAuth(
      SESSION_COOKIE,
      { type: 'apiKey', in: 'cookie', name: SESSION_COOKIE },
      SESSION_COOKIE, // ชื่อ security scheme = ชื่อคุกกี้ ให้ตรงกับ @ApiCookieAuth(SESSION_COOKIE)
    )
    .build();
  return SwaggerModule.createDocument(app, config, { operationIdFactory: (c, m) => `${c}_${m}` });
}

// ตรวจ environment ตอนบูต — ค่าไม่ครบหรือผิดรูปแบบให้หยุดทันที (fail fast)
import { z } from 'zod';

const url = z.string().url();

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3002),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  /** จำนวน connection สูงสุดของระบบนี้ (deployment.md ข้อ 4.1) · server ตั้ง 5 */
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),

  CORE_HUB_URL: url,
  CORE_HUB_JWKS_URL: url,
  CORE_HUB_ISSUER: z.string().min(1),
  CORE_HUB_AUDIENCE: z.string().min(1),
  /** เว็บของ Core Hub — /auth/login พาไป {CORE_HUB_WEB_URL}/sso/authorize (ค่าเริ่มต้นสำหรับเครื่องพัฒนา) */
  CORE_HUB_WEB_URL: url.default('http://127.0.0.1:3100'),

  SUBSYSTEM_ID: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'SUBSYSTEM_ID must be kebab-case'),
  /** ชื่อที่แสดงผล — ตรงกับ displayName ในทะเบียน Core Hub และ display_name ใน subsystem.yaml */
  SUBSYSTEM_NAME: z.string().trim().min(1).default('CSMJU Quiz'),
  /**
   * origin สาธารณะของระบบ = frontend ที่ proxy /api/* และ /auth/* มาที่ backend (connect-core-hub ข้อ 0–1)
   * ใช้ตรวจ next และเป็นปลายทางหลัง SSO callback · Callback URL ในทะเบียน = {FRONTEND_URL}/auth/callback
   */
  FRONTEND_URL: url,

  JWKS_CACHE_TTL_MS: z.coerce.number().int().positive().default(600_000),
  JWKS_MIN_REFRESH_INTERVAL_MS: z.coerce.number().int().min(30_000).default(30_000),
  JWKS_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
  JWT_CLOCK_TOLERANCE_SEC: z.coerce.number().int().min(0).max(60).default(5),

  /** ผู้เล่นเข้าห้องด้วยบัตรเข้าห้องโดยไม่ล็อกอิน (PM อนุมัติ 2 ต.ค. 2569) · false = ปิดทุก endpoint ของผู้เล่น */
  GUEST_PLAY_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  /** จำนวนครั้งที่ขอเข้าห้อง (ค้นห้อง + เข้าร่วม) ต่อ IP ต่อนาที — เกินแล้วตอบ 429 */
  GUEST_JOIN_RATE_LIMIT: z.coerce.number().int().min(1).max(1000).default(30),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment:\n  ${problems.join('\n  ')}`);
  }
  // ค่าเริ่มต้นของ CORE_HUB_WEB_URL ใช้ได้เฉพาะเครื่องพัฒนา
  if (parsed.data.NODE_ENV === 'production' && !raw.CORE_HUB_WEB_URL) {
    throw new Error('Invalid environment:\n  CORE_HUB_WEB_URL: required in production');
  }
  return parsed.data;
}

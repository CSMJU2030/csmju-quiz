// เริ่ม SSO จากระบบย่อยพร้อม state และหน้า next (auth-contract.md 1.2 ข้อ 5 และ 5.2 · standards 1.7.0)
//   GET /auth/login?next=/game/join?pin=123456
//   → ตั้งคุกกี้ csmju_quiz_sso_state = <state>.<next แบบ base64url>  (Path=/auth/callback · 600 วินาที)
//   → 302 {CORE_HUB_WEB_URL}/sso/authorize?subsystem=csmju-quiz&state=<state>
//   callback ที่มี state → เทียบกับคุกกี้แบบ constant-time → ตั้ง session → 302 ไปหน้า next
// ผู้ใช้ที่ยังไม่ล็อกอินจะเห็นหน้า login ของ Core Hub แล้วกลับมาหน้าเดิมเอง ไม่ต้องกดเมนูใน Core Hub
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';

export const SSO_STATE_COOKIE = 'csmju_quiz_sso_state';
export const SSO_STATE_PATH = '/auth/callback';
export const SSO_STATE_TTL_MS = 600_000;
const MAX_NEXT = 512;

/**
 * กฎของ next (ข้อ 5.2) — ผ่านครบจึงใช้ได้ ไม่ผ่านคืน null (ใช้หน้าแรกแทน)
 * ตรวจทั้งตอน /auth/login และอีกครั้งตอน callback เพราะค่ากลับมาจากคุกกี้
 */
export function safeNext(next: unknown, frontendUrl: string): string | null {
  if (typeof next !== 'string' || next.length < 1 || next.length > MAX_NEXT) return null;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null;
  for (let i = 0; i < next.length; i++) {
    const code = next.charCodeAt(i);
    if (code <= 31 || code === 127) return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(next, frontendUrl);
  } catch {
    return null;
  }
  if (parsed.origin !== new URL(frontendUrl).origin) return null;
  if (parsed.pathname === '/auth' || parsed.pathname.startsWith('/auth/')) return null;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/** state สุ่ม 32 ไบต์ แบบ base64url */
export function newSsoState(): string {
  return randomBytes(32).toString('base64url');
}

export function encodeStateCookie(state: string, next: string): string {
  return `${state}.${Buffer.from(next, 'utf8').toString('base64url')}`;
}

/** เทียบ state จาก callback กับคุกกี้ — ตรงกันคืน next ที่เก็บไว้ ('' = ไม่มี next) · ไม่ตรงคืน null */
export function matchStateCookie(cookie: string | null, state: string): string | null {
  if (!cookie || !state) return null;
  const dot = cookie.indexOf('.');
  if (dot <= 0) return null;
  const saved = Buffer.from(cookie.slice(0, dot));
  const given = Buffer.from(state);
  if (saved.length !== given.length || !timingSafeEqual(saved, given)) return null;
  return Buffer.from(cookie.slice(dot + 1), 'base64url').toString('utf8');
}

export function setStateCookie(res: Response, value: string, secure: boolean) {
  res.cookie(SSO_STATE_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: SSO_STATE_PATH,
    maxAge: SSO_STATE_TTL_MS,
  });
}

/** ใช้ได้ครั้งเดียว — ลบทิ้งก่อนตรวจทุกครั้งที่ callback มี state (และตอน logout) */
export function clearStateCookie(res: Response, secure: boolean) {
  res.cookie(SSO_STATE_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: SSO_STATE_PATH,
    maxAge: 0,
  });
}

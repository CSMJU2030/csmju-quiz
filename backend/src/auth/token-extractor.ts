// ขั้น 1 — รับ token ได้ 2 ทาง ตรวจเหมือนกัน (auth-contract.md ข้อ 6)
//   Authorization: Bearer <token>  (มาก่อน)  ·  Cookie: csmju_quiz_access_token=<token>
// ห้ามเชื่อ identity จาก body / query / custom header
// ห้ามอ่านคุกกี้ของเว็บ Core Hub (csmju_access_token · csmju_refresh_token) ที่ติดมาเพราะคุกกี้ไม่แยกตาม port
import type { Request } from 'express';

/** คุกกี้ session = `<ชื่อระบบ>_access_token` (ชื่อระบบ csmju-quiz เปลี่ยน - เป็น _) · jwt-contract sso.sessionCookieSuffix */
export const SESSION_COOKIE = 'csmju_quiz_access_token';

export type Extracted =
  { kind: 'token'; token: string } | { kind: 'missing' } | { kind: 'malformed' };

export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      const value = part.slice(idx + 1).trim();
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return null;
}

export function extractToken(req: Pick<Request, 'headers'>): Extracted {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.length > 0) {
    const match = /^Bearer\s+(\S+)\s*$/i.exec(auth);
    return match ? { kind: 'token', token: match[1] } : { kind: 'malformed' }; // เช่น Basic → 401
  }
  const cookie = readCookie(req.headers.cookie, SESSION_COOKIE);
  return cookie ? { kind: 'token', token: cookie } : { kind: 'missing' };
}

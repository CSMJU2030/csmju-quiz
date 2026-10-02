// คุกกี้ session = Core Hub token ที่ verify แล้ว (auth-contract.md 1.2 ข้อ 5.1)
//   ชื่อ csmju_quiz_access_token · HttpOnly + SameSite=Lax + Path=/ · Secure เมื่อ production
//   Max-Age = exp − ตอนนี้ (ไม่ยาวกว่า token) · ไม่มีตาราง session หรือ session id ของตัวเอง
import type { Response } from 'express';
import { SESSION_COOKIE } from './token-extractor';

export function setSessionCookie(res: Response, token: string, exp: number, secure: boolean) {
  const maxAgeMs = Math.max(0, exp * 1000 - Date.now());
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: maxAgeMs,
  });
}

/**
 * ออกจากระบบ — attribute ต้องตรงกับตอนตั้ง (path '/') เบราว์เซอร์จึงลบคุกกี้เดิมได้
 * ตั้งค่าว่างพร้อม Max-Age=0 (conformance L3-22 ตรวจ Max-Age=0) และ Expires ในอดีต
 */
export function clearSessionCookie(res: Response, secure: boolean) {
  res.cookie(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 0,
  });
}

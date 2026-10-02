// บัตรเข้าห้องของผู้เล่นที่ไม่ล็อกอิน (PM อนุมัติ 2 ต.ค. 2569 · แทนการล็อกอิน)
//   - ค่าสุ่ม 32 bytes ส่งให้ผู้เล่นเป็นคุกกี้ HttpOnly · SameSite=Lax · Secure เมื่อ production
//   - ฐานข้อมูลเก็บเฉพาะ sha256 ของบัตร ผูกกับผู้เล่นคนเดียวในห้องเดียว
//   - ไม่ใช่ JWT และไม่ใช่การยืนยันตัวตน: ใช้ได้แค่เข้าร่วม ส่งคำตอบ และดูสถานะห้องนั้น
//   - หมดอายุเมื่อห้องถูกปิด (ลบผู้เล่นทิ้งตาม cascade) ถูกเตะออก หรือครบ 4 ชั่วโมง
//   - ห้าม log ค่าบัตรหรือ header Cookie
import { createHash, randomBytes } from 'node:crypto';
import { readCookie } from '../auth/token-extractor';

export const ROOM_PASS_COOKIE = 'quiz_room_pass';
export const ROOM_PASS_TTL_MS = 4 * 60 * 60 * 1000;
export const ROOM_PASS_BYTES = 32;

/** path ของคุกกี้ — เบราว์เซอร์ส่งบัตรไปเฉพาะ endpoint ของห้องนั้น */
export function roomPassPath(sessionId: string) {
  return `/api/v1/guest-games/${sessionId}`;
}

export function hashRoomPass(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function newRoomPass(now = Date.now()) {
  const value = randomBytes(ROOM_PASS_BYTES).toString('base64url');
  return { value, hash: hashRoomPass(value), expiresAt: new Date(now + ROOM_PASS_TTL_MS) };
}

/** ค่าบัตรจาก header Cookie · รูปแบบไม่ถูกต้อง → null */
export function readRoomPass(cookieHeader: string | undefined): string | null {
  const value = readCookie(cookieHeader, ROOM_PASS_COOKIE);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

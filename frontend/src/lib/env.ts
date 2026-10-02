// src/lib/env.ts
// ค่า config ฝั่งหน้าเว็บ — ทุกค่าที่ขึ้นต้น NEXT_PUBLIC_ เป็นข้อมูลสาธารณะ
// ห้ามใส่ความลับหรือ token ใด ๆ (ui-design-system.md ข้อ 16.1.1, 16.2 ข้อ 17)

/** ต้องตรงกับ name ใน subsystem.yaml และทะเบียนของ Core Hub */
export const SUBSYSTEM_NAME = process.env.NEXT_PUBLIC_SUBSYSTEM_NAME ?? "csmju-quiz";

/** ชื่อที่แสดงผล (ใช้ใน title แท็บและ AppShell) */
export const SUBSYSTEM_DISPLAY_NAME = "CSMJU Quiz";

/**
 * ต้นทางของ API — ว่างเสมอ (เรียกแบบ relative ที่ origin ของหน้าเว็บ)
 * next.config.ts ส่ง /api/* และ /auth/* ต่อไป backend (BACKEND_URL ฝั่ง server · connect-core-hub ข้อ 1)
 * ห้ามชี้ไป backend ตรง ๆ — คุกกี้ session ตั้งไว้ที่ origin ของหน้าเว็บ ข้าม origin แล้วคุกกี้ไม่ไปด้วย
 */
export const API_BASE_URL = "";

/**
 * URL หน้าเว็บของ Core Hub เช่น https://csmju2030.jowave.com — ใช้แค่ลิงก์ "กลับหน้าหลัก"
 * (SSO เริ่มที่ /auth/login ของระบบนี้เอง · backend เป็นผู้พาไป Core Hub)
 */
export const CORE_HUB_WEB_URL = (process.env.NEXT_PUBLIC_CORE_HUB_WEB_URL ?? "").replace(/\/$/, "");

/** ใช้ proxy ของหน้าเว็บเสมอ จึงพร้อมใช้งานทุกสภาพแวดล้อม (ไม่มี URL ของ backend ให้ตั้งในเบราว์เซอร์แล้ว) */
export const isApiConfigured = true;

/** "<ชื่อหน้า> · <ชื่อระบบย่อย> · CSMJU" (ui-design-system.md ข้อ 11.4) */
export function pageTitle(page: string) {
  return `${page} · ${SUBSYSTEM_DISPLAY_NAME} · CSMJU`;
}

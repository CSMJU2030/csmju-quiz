import path from "node:path";
import type { NextConfig } from "next";

// รากของ pnpm workspace (lockfile และ node_modules/.pnpm อยู่ที่นี่)
// ต้องตั้งเอง เพราะถ้า frontend/ มี .git ของตัวเอง Next จะถือว่า frontend/ เป็นราก แล้วหา next ไม่เจอ
const workspaceRoot = path.join(__dirname, "..");

// ประตูเดียวของระบบ (connect-core-hub ข้อ 0–1 · standards 1.7.0)
// เบราว์เซอร์คุยกับ origin ของหน้าเว็บนี้เท่านั้น — /api/* และ /auth/* ส่งต่อไป backend ฝั่ง server
// คุกกี้ session (csmju_quiz_access_token) และบัตรเข้าห้อง (quiz_room_pass) จึงผูกกับ origin ของหน้าเว็บ
// BACKEND_URL อ่านตอน build/start ฝั่ง server เท่านั้น (ไม่ใช่ NEXT_PUBLIC_) · ค่า default = backend dev ของ repo นี้
const BACKEND_URL = (process.env.BACKEND_URL ?? "http://127.0.0.1:3002").replace(/\/$/, "");

const nextConfig: NextConfig = {
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
  // SSE (/api/v1/.../events) ต้องไม่ถูกบีบอัด — gzip ของ Next จะกักข้อมูลไว้จนเต็ม buffer
  compress: false,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
      { source: "/auth/login", destination: `${BACKEND_URL}/auth/login` },
      { source: "/auth/callback", destination: `${BACKEND_URL}/auth/callback` },
      { source: "/auth/logout", destination: `${BACKEND_URL}/auth/logout` },
    ];
  },
};

export default nextConfig;

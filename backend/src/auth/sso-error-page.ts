// หน้า HTML ของ callback ที่ไม่สำเร็จ (auth-contract.md 1.2 ข้อ 5.1)
//   state ไม่มีคุกกี้หรือไม่ตรง → 401 · เบราว์เซอร์ที่ขอ text/html ได้หน้านี้พร้อมปุ่ม "เข้าสู่ระบบอีกครั้ง" (ลิงก์ /auth/login)
//   ห้าม redirect เอง — เบราว์เซอร์ที่ไม่เก็บคุกกี้จะวนไม่จบ · client อื่นได้ error envelope เป็น JSON ตามปกติ
import type { Request, Response } from 'express';
import { type ErrorCode, errorBody } from '../common/envelope';

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

export interface SsoErrorPage {
  /** หัวข้อบนหน้า (ภาษาไทย) */
  title: string;
  /** คำอธิบายสั้น ๆ (ภาษาไทย) */
  detail: string;
  /** ข้อความใน error envelope (JSON) */
  message: string;
  /** แสดงปุ่ม "เข้าสู่ระบบอีกครั้ง" */
  retry: boolean;
}

export function renderSsoErrorPage(page: SsoErrorPage, loginPath = '/auth/login'): string {
  const button = page.retry
    ? `<a class="btn" href="${escapeHtml(loginPath)}">เข้าสู่ระบบอีกครั้ง</a>`
    : `<a class="btn" href="/">กลับหน้าแรก</a>`;
  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>${escapeHtml(page.title)} · CSMJU Quiz</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#f6f7f9;color:#1f2937}
  main{max-width:28rem;margin:1rem;padding:2rem;background:#fff;border-radius:12px;
    box-shadow:0 1px 3px rgba(0,0,0,.08);text-align:center}
  h1{font-size:1.25rem;margin:0 0 .75rem}
  p{margin:0 0 1.5rem;line-height:1.6;color:#4b5563}
  .btn{display:inline-block;padding:.65rem 1.4rem;border-radius:8px;background:#1d4ed8;color:#fff;
    text-decoration:none;font-weight:600}
  @media (prefers-color-scheme:dark){body{background:#111827;color:#f3f4f6}
    main{background:#1f2937}p{color:#d1d5db}}
</style>
</head>
<body>
<main>
<h1>${escapeHtml(page.title)}</h1>
<p>${escapeHtml(page.detail)}</p>
${button}
</main>
</body>
</html>
`;
}

/** เบราว์เซอร์ (Accept: text/html) ได้หน้า HTML · อื่น ๆ ได้ error envelope */
export function sendSsoError(
  req: Request,
  res: Response,
  status: number,
  code: ErrorCode,
  page: SsoErrorPage,
) {
  res.status(status);
  if (req.accepts(['json', 'html']) === 'html') {
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    res.type('html').send(renderSsoErrorPage(page));
    return;
  }
  res.json(errorBody(code, page.message));
}

export const SSO_PAGES = {
  stateFailed: {
    title: 'การเข้าสู่ระบบหมดเวลาหรือไม่ถูกต้อง',
    detail:
      'ไม่พบข้อมูลการเข้าสู่ระบบที่เริ่มจากเบราว์เซอร์นี้ (อาจใช้เวลานานเกิน 10 นาที หรือเปิดจากแท็บอื่น) กรุณาเข้าสู่ระบบอีกครั้ง',
    message: 'SSO state does not match this browser',
    retry: true,
  },
  tokenRejected: {
    title: 'เข้าสู่ระบบไม่สำเร็จ',
    detail: 'ตรวจสอบสิทธิ์การเข้าใช้งานจาก Core Hub ไม่ผ่าน กรุณาเข้าสู่ระบบอีกครั้ง',
    message: 'Missing or invalid token',
    retry: true,
  },
  roleRejected: {
    title: 'บัญชีของคุณไม่มีสิทธิ์เข้าระบบนี้',
    detail: 'role ของบัญชีนี้ไม่ได้รับอนุญาตให้ใช้ CSMJU Quiz',
    message: 'Your role cannot use this subsystem',
    retry: false,
  },
} satisfies Record<string, SsoErrorPage>;

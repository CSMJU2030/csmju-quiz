// ตรวจไฟล์รูปก่อนส่งต่อ — ดูชนิดจาก byte ต้นไฟล์ ไม่เชื่อชื่อไฟล์หรือ Content-Type ที่ผู้ใช้ส่ง (deployment.md ข้อ 4.3)
// Core Hub รับ JPEG · PNG · WebP ไม่เกิน 10 MB และไม่รับ SVG (reference-data.md ข้อ 6)

/** เพดานของระบบนี้ (ต่ำกว่า Core Hub) — รูปประกอบคำถามบนจอไม่ต้องใหญ่กว่านี้ */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export function sniffImage(bytes: Uint8Array): ImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return 'image/png';
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

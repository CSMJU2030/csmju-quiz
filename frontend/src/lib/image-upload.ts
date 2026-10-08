// อัปโหลดรูปประกอบคำถาม — backend ส่งต่อไปบริการเก็บรูปของ Core Hub แล้วคืน id กับ URL สำหรับแสดง
// รูปเปิดดูได้โดยไม่ต้องล็อกอิน (reference-data.md ข้อ 6) — ห้ามใช้กับรูปที่มีข้อมูลส่วนบุคคล
import { apiUpload } from "@/lib/api";

export const MAX_IMAGE_MB = 5;
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
const ACCEPTED = new Set(IMAGE_ACCEPT.split(","));

/** ตรวจก่อนส่ง — คืนข้อความ error หรือ null (backend ตรวจจาก byte ต้นไฟล์ซ้ำอีกชั้น) */
export function imageFileProblem(file: Pick<File, "type" | "size">): string | null {
  if (!ACCEPTED.has(file.type)) return "รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP";
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) return `ไฟล์ต้องไม่เกิน ${MAX_IMAGE_MB} MB`;
  return null;
}

export async function uploadQuestionImage(file: File): Promise<{ id: string; url: string }> {
  const form = new FormData();
  form.append("file", file);
  return apiUpload<{ id: string; url: string }>("/api/v1/images", form);
}

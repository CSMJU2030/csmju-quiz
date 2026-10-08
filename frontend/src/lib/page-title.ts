import type { Metadata } from "next";
import { SUBSYSTEM_DISPLAY_NAME } from "@/lib/env";

/**
 * title ของแท็บตาม ui-design-system.md ข้อ 11.4 — "<ชื่อหน้า> · <ชื่อระบบย่อย> · CSMJU"
 * ใช้ absolute เพราะ layout ที่ตั้ง title แบบข้อความธรรมดา (เช่น /quiz) ทำให้หน้าลูก (/quiz/create)
 * ไม่ได้ template ของ root — แท็บจึงเหลือแค่ "สร้างแบบทดสอบ"
 */
export function pageTitle(name: string): Metadata["title"] {
  return { absolute: `${name} · ${SUBSYSTEM_DISPLAY_NAME} · CSMJU` };
}

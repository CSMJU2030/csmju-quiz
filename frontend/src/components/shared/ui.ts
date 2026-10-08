// src/components/shared/ui.ts
// class สำเร็จรูปชั่วคราว ตามสเปค ui-design-system.md ข้อ 7.2 / 7.2.1 / 8.2
// ชื่อค่าคงที่ตรงกับ ui.ts ของ template (`@/csmju`) — เมื่อได้ template แล้ว
// ให้เปลี่ยน import เป็น `from "@/csmju"` แล้วลบไฟล์นี้ทิ้ง

/** วงแหวน focus 2px + offset 2px สี focus-ring (token accent) — ข้อ 3.1, 7.2 */
const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const buttonBase = `relative inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-label-md transition disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

/** ปุ่มหลัก — สูงสุด 1 ปุ่มต่อพื้นที่ */
export const primaryButtonClass = `${buttonBase} btn-gradient text-on-primary`;

/** ปุ่มรอง / ยกเลิก */
export const secondaryButtonClass = `${buttonBase} border border-outline-variant bg-transparent text-on-surface-variant hover:bg-surface-variant/50`;

/** ปุ่มยืนยันการลบใน ConfirmDialog */
export const dangerButtonClass = `${buttonBase} bg-error text-on-primary hover:opacity-90`;

/** ปุ่ม tonal — ลิงก์ที่ต้องการน้ำหนักระดับปุ่ม */
export const tonalButtonClass = `${buttonBase} bg-primary-container/10 text-primary-container hover:bg-primary-container/20`;

/** ปุ่มบนพื้นเข้ม (brand-gradient) */
export const onDarkButtonClass = `${buttonBase} border border-surface-container-lowest/25 bg-surface-container-lowest/10 text-on-primary backdrop-blur-sm hover:bg-surface-container-lowest/20`;

/**
 * ลิงก์ข้อความแบบเดี่ยว (ไม่อยู่กลางประโยค) — พื้นที่กดสูงอย่างน้อย 44px (ข้อ 6.1)
 * ลิงก์ที่อยู่กลางประโยคให้ใช้ inlineLinkClass แทน (ได้รับยกเว้นเรื่องขนาดพื้นที่กด)
 */
export const linkClass = `inline-flex min-h-11 items-center rounded-sm text-label-md text-primary-container hover:underline ${focusRing}`;

/** ลิงก์กลางประโยค */
export const inlineLinkClass = `rounded-sm text-primary-container underline underline-offset-2 ${focusRing}`;

/** ปุ่มไอคอนในแถว (แก้ไข) — ต้องมี aria-label เสมอ */
export const iconButtonClass = `inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg p-1.5 text-outline transition-colors hover:text-primary-container disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

/** ปุ่มไอคอนลบ — ต้องมี aria-label เสมอ */
export const iconDangerButtonClass = `inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg p-1.5 text-outline transition-colors hover:text-error disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

/** ปุ่มไอคอนวงกลม (top bar) */
export const iconRoundButtonClass = `inline-flex min-h-11 min-w-11 items-center justify-center rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-variant/50 ${focusRing}`;

export const inputClass =
  "min-h-12 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-body-md text-on-surface transition-colors placeholder:text-on-surface-variant focus:border-accent focus:ring-3 focus:ring-accent/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export const labelClass = "text-label-md text-on-surface";

/** การ์ดปกติใช้เส้นขอบ ไม่ใช้เงา (--csmju-shadow-none · ข้อ 3.4) */
export const cardClass =
  "overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest";

export const cardHeaderClass = "border-b border-outline-variant/40 px-6 py-5";

export const thClass = "whitespace-nowrap px-6 py-4 font-semibold";

export const tdClass = "px-6 py-4";

export type Tone = "success" | "info" | "warning" | "error" | "neutral";

/** badge สถานะ (ข้อ 3.1 ตาราง Semantic) — ใช้คู่กับจุดสีเสมอ */
export const TONE_STYLES: Record<Tone, { badge: string; dot: string }> = {
  success: { badge: "bg-success/10 text-on-surface", dot: "bg-success" },
  info: { badge: "bg-primary-container/10 text-primary-container", dot: "bg-primary-container" },
  warning: { badge: "bg-brand-amber/15 text-on-surface", dot: "bg-brand-amber" },
  error: { badge: "bg-error-container text-on-error-container", dot: "bg-error" },
  neutral: { badge: "bg-surface-variant text-on-surface-variant", dot: "bg-outline" },
};

export const badgeClass = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label-sm";

/**
 * จังหวะทยอยขึ้นของรายการ — ใช้ stagger-1/2/3 (80/160/240ms) ตามข้อ 3.6 เท่านั้น
 * ห้ามเขียนค่า ms เองใน style (ข้อ 16.2 ข้อ 1) · ลำดับที่ 3 ขึ้นไปใช้ stagger-3
 */
export function staggerClass(index: number): string {
  if (index <= 0) return "";
  return index === 1 ? "stagger-1" : index === 2 ? "stagger-2" : "stagger-3";
}

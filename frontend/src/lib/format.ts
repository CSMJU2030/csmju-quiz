// src/lib/format.ts
// util แสดงผลชั่วคราวตาม ui-design-system.md ข้อ 11.3 (ยังไม่มีใน "@/csmju")
// พ.ศ. เป็นค่าเริ่มต้น · timezone ตรึงที่ Asia/Bangkok · ส่งข้อมูลเป็น ISO 8601 ค.ศ. เสมอ

const TZ = "Asia/Bangkok";

function toDate(value: string | number | Date) {
  return value instanceof Date ? value : new Date(value);
}

/** 11 ส.ค. 2569 · หรือ 11 สิงหาคม 2569 เมื่อ style = "long" */
export function formatDate(value: string | number | Date, style: "short" | "long" = "short") {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    timeZone: TZ,
    day: "numeric",
    month: style === "long" ? "long" : "short",
    year: "numeric",
  }).format(toDate(value));
}

/** 09:30 น. */
export function formatTime(value: string | number | Date) {
  const time = new Intl.DateTimeFormat("th-TH", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(toDate(value));
  return `${time} น.`;
}

/** 11 ส.ค. 2569 09:30 น. */
export function formatDateTime(value: string | number | Date) {
  return `${formatDate(value)} ${formatTime(value)}`;
}

/** 3 ชั่วโมงที่แล้ว — ใช้เฉพาะ ≤ 7 วัน เกินนั้นแสดงวันที่ */
export function formatRelative(value: string | number | Date, now: number = Date.now()) {
  const diffMs = toDate(value).getTime() - now;
  const diffSec = Math.round(diffMs / 1000);
  if (Math.abs(diffSec) > 7 * 24 * 3600) return formatDate(value);
  const rtf = new Intl.RelativeTimeFormat("th", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];
  for (const [unit, sec] of units) {
    if (Math.abs(diffSec) >= sec || unit === "second") {
      return rtf.format(Math.round(diffSec / sec), unit);
    }
  }
  return formatDate(value);
}

/** 2,450 */
export function formatNumber(value: number) {
  return new Intl.NumberFormat("th-TH").format(value);
}

/** เงินจาก API เป็นสตางค์ (integer) → 150.00 บาท */
export function formatMoney(satang: number) {
  return `${new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(satang / 100)} บาท`;
}

/** 81% */
export function formatPercent(value: number) {
  return `${formatNumber(Math.round(value))}%`;
}

/** 20260811-0930 — ส่วนท้ายชื่อไฟล์ (เวลาไทย Asia/Bangkok · ปี ค.ศ. · อักษรอังกฤษล้วน) · วันที่ไม่ถูกต้อง → null */
export function formatFileStamp(value: string | number | Date): string | null {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}${get("month")}${get("day")}-${get("hour")}${get("minute")}`;
}

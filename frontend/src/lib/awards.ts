// src/lib/awards.ts
// ชื่อและคำอธิบายรางวัลพิเศษ — ใช้ร่วมกันระหว่างหน้าประกาศผลและประวัติการเล่น
// ชนิดรางวัลต้องตรงกับ backend/src/game/podium.ts (AWARD_KINDS)

import {
  BoltIcon,
  LocalFireDepartmentIcon,
  TrackChangesIcon,
  type IconComponent,
} from "@/components/icons";
import { formatNumber } from "@/lib/format";

export type AwardKind = "fastest" | "streak" | "accuracy";

export const AWARD_INFO: Record<
  AwardKind,
  { title: string; icon: IconComponent; detail: (value: number) => string }
> = {
  fastest: {
    title: "มือไวที่สุด",
    icon: BoltIcon,
    detail: (v) => `ตอบถูกเป็นคนแรก ${formatNumber(v)} ข้อ`,
  },
  streak: {
    title: "ต่อเนื่องที่สุด",
    icon: LocalFireDepartmentIcon,
    detail: (v) => `ตอบถูกติดกัน ${formatNumber(v)} ข้อ`,
  },
  accuracy: {
    title: "แม่นยำที่สุด",
    icon: TrackChangesIcon,
    detail: (v) => `ตอบถูก ${v}% ของทั้งหมด`,
  },
};

/**
 * ชนิดรางวัลที่หน้าเว็บรู้จัก — backend เพิ่มชนิดใหม่ก่อนหน้าเว็บอัปเดตได้
 * ชนิดที่ไม่รู้จักให้ข้ามไป (ไม่ใช่ทำทั้งหน้าพังเพราะ AWARD_INFO[kind] เป็น undefined)
 */
export function isAwardKind(kind: unknown): kind is AwardKind {
  return typeof kind === "string" && Object.prototype.hasOwnProperty.call(AWARD_INFO, kind);
}

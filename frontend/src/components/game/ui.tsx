// src/components/game/ui.tsx
// ส่วนประกอบร่วมของหน้าเกม — ใช้ token เท่านั้น (ui-design-system.md ข้อ 3, 7.2.1)
"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import {
  ArrowDownwardIcon,
  ArrowUpwardIcon,
  RemoveIcon,
  WarningIcon,
  type IconComponent,
} from "@/components/icons";
import { ErrorState, PageSkeleton } from "@/components/shared/states";
import { TONE_STYLES, type Tone } from "@/components/shared/ui";

/* ─────── Loading: skeleton ไม่ใช่ spinner กลางจอ (ข้อ 9.1) ─────── */
export function PageLoader({ label = "กำลังโหลดข้อมูล..." }: { label?: string }) {
  return <PageSkeleton label={label} />;
}

/* ─────── Error / Not found ─────── */
export function PageError({
  title,
  message,
  children,
}: {
  title: string;
  message?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <ErrorState title={title} description={message} />
      {children && <div className="flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}

/* ─────── แถบแจ้งการเชื่อมต่อขัดข้อง (ดึงสถานะไม่สำเร็จชั่วคราว — เกมยังอยู่บนจอ) ─────── */
export function ConnectionBanner({ show, className = "" }: { show: boolean; className?: string }) {
  return (
    // live region อยู่บนจอตลอด (ว่างเมื่อปกติ) เพื่อให้โปรแกรมอ่านหน้าจอประกาศเมื่อมีข้อความ
    <div role="status" aria-live="polite">
      {show && (
        <p
          className={`flex items-center justify-center gap-2 rounded-lg bg-brand-amber/15 px-4 py-2 text-label-md text-on-surface ${className}`}
        >
          <WarningIcon className="h-4 w-4 shrink-0" />
          การเชื่อมต่อขัดข้อง กำลังลองใหม่…
        </p>
      )}
    </div>
  );
}

/* ─────── StatCard (ข้อ 7.2.1) ─────── */
const STAT_TONES: Record<"neutral" | "info" | "success" | "warning", string> = {
  neutral: "bg-surface-container text-on-surface-variant",
  info: "bg-primary-container/10 text-primary-container",
  success: "bg-success/15 text-on-surface",
  warning: "bg-brand-amber/15 text-on-surface",
};

export function StatCard({
  icon: StatIcon,
  label,
  value,
  tone = "info",
}: {
  icon: IconComponent;
  label: string;
  value: string;
  tone?: keyof typeof STAT_TONES;
}) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-label-md text-on-surface-variant">{label}</p>
        <span className={`rounded-lg p-2.5 ${STAT_TONES[tone]}`}>
          <StatIcon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-4 font-display text-headline-lg text-primary-container tabular-nums">
        {value}
      </p>
    </div>
  );
}

/* ─────── Badge สถานะ (ข้อ 7.2.1) — จุดสี + ข้อความเสมอ ─────── */
export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const style = TONE_STYLES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label-sm ${style.badge}`}
    >
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${style.dot}`} />
      {children}
    </span>
  );
}

/* ─────── เหรียญอันดับ 1-3 (next/image เสิร์ฟ WebP อัตโนมัติ · ข้อ 14) ─────── */
/** เหรียญทอง/เงิน/ทองแดง — รูปสื่อความหมาย จึงมี alt บอกอันดับ (ข้อ 12.1) · ขนาดตามกล่องที่ครอบ */
export function RankMedal({
  place,
  className = "h-full w-full",
}: {
  place: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <Image
      src={`/medals/medal-${place}.png`}
      alt={`อันดับ ${place}`}
      width={128}
      height={128}
      draggable={false}
      className={`object-contain ${className}`}
    />
  );
}

/** อันดับ 1-3 แสดงเป็นเหรียญ · อันดับอื่นแสดงเป็นตัวเลข */
export function RankIcon({ place }: { place: number }) {
  if (place === 1 || place === 2 || place === 3) return <RankMedal place={place} />;
  return <span className="text-label-md tabular-nums">{place}</span>;
}

/** พื้นหลังกล่องอันดับ — อันดับ 1-3 เป็นเหรียญอยู่แล้วจึงไม่ต้องมีพื้น */
export const rankStyle = (place: number) =>
  place <= 3 ? "" : "bg-surface-container text-on-surface-variant";

/* ─────── ลูกศรอันดับขึ้น/ลง — มีไอคอน + ตัวเลขกำกับเสมอ (ข้อ 3.1) ─────── */
export function RankDelta({ delta }: { delta: number }) {
  if (!delta) {
    return (
      <span className="inline-flex items-center gap-1 text-label-sm text-on-surface-variant">
        <RemoveIcon className="h-4 w-4" aria-label="อันดับเท่าเดิม" />
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-label-sm tabular-nums text-on-surface`}>
      {up ? (
        <ArrowUpwardIcon className="h-4 w-4 text-success" aria-label="อันดับขึ้น" />
      ) : (
        <ArrowDownwardIcon className="h-4 w-4 text-error" aria-label="อันดับลง" />
      )}
      {Math.abs(delta)}
    </span>
  );
}

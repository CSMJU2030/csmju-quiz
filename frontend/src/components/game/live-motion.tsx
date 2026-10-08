// src/components/game/live-motion.tsx
// การเคลื่อนไหวระหว่างเกม — ตัวเลขคะแนนนับขึ้น · แถวอันดับเลื่อนจากตำแหน่งเดิม
// เคารพ prefers-reduced-motion: ตัวเลขแสดงค่าสุดท้ายทันที · แถวไม่เลื่อน (ui-design-system.md ข้อ 3.6)
"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/** เวลานับตัวเลข (ms) — ยาวพอให้เห็นว่าคะแนนเพิ่ม แต่จบก่อนนับถอยหลังข้อถัดไป */
export const COUNT_UP_MS = 900;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** ค่าระหว่างทาง (ease-out cubic) — แยกออกมาเพื่อทดสอบได้ */
export function tween(from: number, to: number, progress: number) {
  const p = Math.min(1, Math.max(0, progress));
  return Math.round(from + (to - from) * (1 - (1 - p) ** 3));
}

/** นับตัวเลขจาก `from` ไป `to` ครั้งเดียวเมื่อ `to` เปลี่ยน */
export function useCountUp(to: number, from: number, durationMs = COUNT_UP_MS) {
  const [value, setValue] = useState(from);
  const frame = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(frame.current);
    if (prefersReducedMotion() || from === to) {
      frame.current = requestAnimationFrame(() => setValue(to));
      return () => cancelAnimationFrame(frame.current);
    }
    const start = performance.now();
    const step = (t: number) => {
      const progress = (t - start) / durationMs;
      setValue(tween(from, to, progress));
      if (progress < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [to, from, durationMs]);
  return value;
}

/** ตัวเลขที่นับขึ้น — screen reader อ่านค่าสุดท้ายค่าเดียว */
export function CountUp({
  to,
  from = 0,
  format = (n) => String(n),
  className,
}: {
  to: number;
  from?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const value = useCountUp(to, from);
  return (
    <span className={className}>
      <span aria-hidden="true">{format(value)}</span>
      <span className="sr-only">{format(to)}</span>
    </span>
  );
}

/**
 * แถวในตารางอันดับ — เริ่มที่ตำแหน่งของอันดับเดิมแล้วเลื่อนเข้าที่ (ระยะ = จำนวนแถว × pitch)
 * แถวที่เพิ่งเข้ามา (ไม่มีอันดับเดิมในรายการ) เลื่อนขึ้นจากใต้รายการ
 */
export function RankRow({
  as: Tag = "li",
  index,
  prevIndex,
  pitch,
  className = "",
  children,
}: {
  as?: "li" | "div";
  /** ลำดับในรายการตอนนี้ (0 = บนสุด) */
  index: number;
  /** ลำดับในรายการก่อนข้อนี้ — null = ไม่อยู่ในรายการเดิม */
  prevIndex: number | null;
  /** ระยะห่างระหว่างแถว (px) รวมช่องว่าง */
  pitch: number;
  className?: string;
  children: ReactNode;
}) {
  const shift = (prevIndex ?? index + 2) - index;
  const style = { "--rank-from": `${shift * pitch}px` } as CSSProperties;
  return (
    <Tag
      style={style}
      className={`${shift === 0 ? "fade-slide-up" : "rank-move"} ${shift < 0 ? "relative z-0" : "relative z-10"} ${className}`}
    >
      {children}
    </Tag>
  );
}

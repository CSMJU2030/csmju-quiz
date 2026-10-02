// src/lib/scoring.ts
// สูตรคะแนนต่อข้อ — สูตรเดียวกับ backend/src/game/scoring.ts (เกมจริงคิดคะแนนที่ server)
// หน้าเว็บใช้เฉพาะหน้าทดลองเล่น (preview) ซึ่งไม่บันทึกผล
// ตอบถูก: คะแนนของข้อ × (50% + 50% ตามความเร็ว) × โบนัสตอบถูกต่อเนื่อง (สูงสุด ×2) · ข้อ "ไม่คิดคะแนน" (0) ได้ 0

export function calculatePoints({
  correct,
  basePoints,
  speed,
  streak,
}: {
  correct: boolean;
  basePoints: number | undefined;
  /** 0–1 (1 = ตอบทันที) */
  speed: number;
  /** จำนวนข้อที่ตอบถูกติดกันรวมข้อนี้ */
  streak: number;
}) {
  if (!correct) return 0;
  const base = Number.isFinite(basePoints) ? Math.max(0, Number(basePoints)) : 1000;
  const streakMultiplier = Math.min(1 + (Math.max(1, streak) - 1) * 0.1, 2);
  const s = Math.min(1, Math.max(0, speed));
  return Math.round(base * (0.5 + 0.5 * s) * streakMultiplier);
}

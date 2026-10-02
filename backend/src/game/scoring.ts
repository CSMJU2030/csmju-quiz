/**
 * คะแนนต่อข้อ — สูตรเดียวกับ frontend/src/lib/game-store.ts calculatePoints
 * ตอบถูก: คะแนนของข้อ × (50% + 50% ตามความเร็ว) × โบนัสตอบถูกต่อเนื่อง (สูงสุด ×2)
 * ข้อที่ตั้ง "ไม่คิดคะแนน" (0) ได้ 0 เสมอ
 */
export function calculatePoints(input: {
  correct: boolean;
  basePoints: number;
  /** 0–1 (1 = ตอบทันที) */
  speed: number;
  /** จำนวนข้อที่ตอบถูกติดกันรวมข้อนี้ */
  streak: number;
}) {
  if (!input.correct) return 0;
  const base = Number.isFinite(input.basePoints) ? Math.max(0, input.basePoints) : 1000;
  const streakMultiplier = Math.min(1 + (Math.max(1, input.streak) - 1) * 0.1, 2);
  const speed = Math.min(1, Math.max(0, input.speed));
  return Math.round(base * (0.5 + 0.5 * speed) * streakMultiplier);
}

/** อันดับแบบแข่งขัน (คะแนนเท่ากันได้อันดับเดียวกัน เช่น 1, 2, 2, 4) — เสมอให้คนเข้าก่อนอยู่บน */
export function rankPlayers<T extends { score: number; joinedAt: number }>(players: T[]) {
  const sorted = [...players].sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
  let rank = 0;
  let prevScore: number | null = null;
  return sorted.map((p, i) => {
    if (p.score !== prevScore) {
      rank = i + 1;
      prevScore = p.score;
    }
    return { ...p, rank };
  });
}

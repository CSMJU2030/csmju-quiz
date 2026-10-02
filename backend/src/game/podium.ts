// สถิติรายผู้เล่นและรางวัลพิเศษหลังจบเกม — คำนวณจากคำตอบที่บันทึกไว้ใน DB
// ใช้แสดงหน้าประกาศผล (phase PODIUM) ให้ทั้ง host และผู้เล่นเห็นชุดเดียวกัน

export interface PodiumAnswer {
  playerId: string;
  questionIndex: number;
  isCorrect: boolean;
  isTimedOut: boolean;
  responseMs: number;
}

export interface PlayerGameStats {
  playerId: string;
  correct: number;
  /** ข้อที่ตอบจริง (ไม่นับหมดเวลา) */
  answered: number;
  /** ตอบถูกติดกันยาวที่สุดตลอดเกม */
  maxStreak: number;
  /** จำนวนข้อที่ตอบถูกเร็วที่สุดในห้อง */
  firstCorrect: number;
}

export const AWARD_KINDS = ['fastest', 'streak', 'accuracy'] as const;
export type AwardKind = (typeof AWARD_KINDS)[number];

export interface Award {
  kind: AwardKind;
  playerId: string;
  /** จำนวนข้อ (fastest/streak) หรือเปอร์เซ็นต์ (accuracy) */
  value: number;
}

export function computePlayerStats(
  playerIds: string[],
  answers: PodiumAnswer[],
  totalQuestions: number,
): Map<string, PlayerGameStats> {
  const stats = new Map<string, PlayerGameStats>();
  for (const id of playerIds) {
    stats.set(id, { playerId: id, correct: 0, answered: 0, maxStreak: 0, firstCorrect: 0 });
  }
  const streak = new Map<string, number>();

  for (let index = 0; index < totalQuestions; index++) {
    const forQuestion = answers.filter((a) => a.questionIndex === index);
    let first: PodiumAnswer | null = null;
    for (const s of stats.values()) {
      const mine = forQuestion.find((a) => a.playerId === s.playerId);
      if (mine && !mine.isTimedOut) s.answered++;
      if (mine?.isCorrect) {
        s.correct++;
        const run = (streak.get(s.playerId) ?? 0) + 1;
        streak.set(s.playerId, run);
        s.maxStreak = Math.max(s.maxStreak, run);
        if (!first || mine.responseMs < first.responseMs) first = mine;
      } else {
        streak.set(s.playerId, 0);
      }
    }
    if (first) {
      const s = stats.get(first.playerId);
      if (s) s.firstCorrect++;
    }
  }
  return stats;
}

/** รางวัล 3 ประเภท — ค่าเท่ากันให้คนคะแนนรวมสูงกว่า · ไม่มีใครเข้าเกณฑ์ = ไม่มอบ */
export function computeAwards(
  stats: Map<string, PlayerGameStats>,
  scores: Map<string, number>,
  totalQuestions: number,
): Award[] {
  const list = [...stats.values()];
  const pick = (value: (s: PlayerGameStats) => number, min: number) => {
    let best: PlayerGameStats | null = null;
    for (const s of list) {
      const v = value(s);
      if (v < min) continue;
      if (
        !best ||
        v > value(best) ||
        (v === value(best) && (scores.get(s.playerId) ?? 0) > (scores.get(best.playerId) ?? 0))
      ) {
        best = s;
      }
    }
    return best ? { playerId: best.playerId, value: value(best) } : null;
  };

  const awards: Award[] = [];
  const fastest = pick((s) => s.firstCorrect, 1);
  if (fastest) awards.push({ kind: 'fastest', ...fastest });
  const longest = pick((s) => s.maxStreak, 2);
  if (longest) awards.push({ kind: 'streak', ...longest });
  if (totalQuestions > 0) {
    const accuracy = pick((s) => Math.round((s.correct / totalQuestions) * 100), 1);
    if (accuracy) awards.push({ kind: 'accuracy', ...accuracy });
  }
  return awards;
}

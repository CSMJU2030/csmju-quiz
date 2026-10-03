import { buildPlayerReview, type ReviewSession, summarizeStats } from './player-review';

const t = (s: number) => new Date(Date.UTC(2026, 8, 30, 10, 0, s));
const q = (id: string, correctId: string, wrongId: string) => ({
  id,
  type: 'MULTIPLE_CHOICE',
  prompt: `Q ${id}`,
  imageUrl: null,
  timeLimit: 20,
  points: 1000,
  options: [
    { id: correctId, text: 'ถูก', isCorrect: true },
    { id: wrongId, text: 'ผิด', isCorrect: false },
  ],
});

function session(): ReviewSession {
  return {
    id: 'g1',
    quizTitle: 'แบบทดสอบ',
    quizSnapshot: {
      quizId: 'z',
      title: 'แบบทดสอบ',
      questions: [q('q1', 'a1', 'b1'), q('q2', 'a2', 'b2'), q('q3', 'a3', 'b3')],
    },
    startedAt: t(0),
    finishedAt: t(60),
    updatedAt: t(60),
    players: [
      {
        id: 'p1',
        coreUserId: 'u1',
        nickname: 'หนึ่ง',
        avatarIndex: 2,
        score: 1900,
        createdAt: t(1),
      },
      { id: 'p2', coreUserId: 'u2', nickname: 'สอง', avatarIndex: 5, score: 800, createdAt: t(2) },
    ],
    answers: [
      // p1: ถูก ถูก หมดเวลา
      {
        playerId: 'p1',
        questionIndex: 0,
        optionId: 'a1',
        isCorrect: true,
        isTimedOut: false,
        points: 950,
        responseMs: 1000,
      },
      {
        playerId: 'p1',
        questionIndex: 1,
        optionId: 'a2',
        isCorrect: true,
        isTimedOut: false,
        points: 950,
        responseMs: 3000,
      },
      {
        playerId: 'p1',
        questionIndex: 2,
        optionId: null,
        isCorrect: false,
        isTimedOut: true,
        points: 0,
        responseMs: 20000,
      },
      // p2: ผิด ถูก(เร็วกว่า p1) — ไม่มีแถวของข้อ 3 (เข้าห้องช้า/ไม่ได้ตอบ)
      {
        playerId: 'p2',
        questionIndex: 0,
        optionId: 'b1',
        isCorrect: false,
        isTimedOut: false,
        points: 0,
        responseMs: 2000,
      },
      {
        playerId: 'p2',
        questionIndex: 1,
        optionId: 'a2',
        isCorrect: true,
        isTimedOut: false,
        points: 800,
        responseMs: 1500,
      },
    ],
  };
}

describe('buildPlayerReview', () => {
  it('ผลรวมและอันดับของผู้เล่น', () => {
    const r = buildPlayerReview(session(), 'p1')!;
    expect(r).toMatchObject({
      rank: 1,
      playerCount: 2,
      score: 1900,
      questionCount: 3,
      correct: 2,
      incorrect: 0,
      timeout: 1,
      accuracy: 66.67,
      maxStreak: 2,
      averageResponseMs: 2000,
      nickname: 'หนึ่ง',
      avatarIndex: 2,
    });
    // p1 ตอบถูกเร็วสุดข้อ 1 · p2 เร็วสุดข้อ 2 → เสมอ 1 ข้อ ให้คนคะแนนสูงกว่า
    expect(r.awards).toEqual(['fastest', 'streak', 'accuracy']);
  });

  it('ทบทวนรายข้อ: ถูก / หมดเวลา / ไม่ได้ตอบ', () => {
    const p1 = buildPlayerReview(session(), 'p1')!;
    expect(p1.answers.map((a) => a.result)).toEqual(['CORRECT', 'CORRECT', 'TIMEOUT']);
    expect(p1.answers[2]).toMatchObject({
      selectedOptionId: null,
      responseMs: null,
      earnedPoints: 0,
    });

    const p2 = buildPlayerReview(session(), 'p2')!;
    expect(p2.answers.map((a) => a.result)).toEqual(['INCORRECT', 'CORRECT', 'NO_ANSWER']);
    expect(p2.answers[0]).toMatchObject({
      selectedOptionId: 'b1',
      earnedPoints: 0,
      responseMs: 2000,
    });
    expect(p2.answers[0].options.find((o) => o.isCorrect)?.optionId).toBe('a1');
    expect(p2).toMatchObject({ rank: 2, correct: 1, incorrect: 1, timeout: 1, awards: [] });
  });

  it('ไม่พบผู้เล่น → null', () => {
    expect(buildPlayerReview(session(), 'nope')).toBeNull();
  });
});

describe('summarizeStats', () => {
  it('ไม่เคยเล่น', () => {
    expect(summarizeStats([])).toMatchObject({
      gamesPlayed: 0,
      wins: 0,
      bestRank: null,
      averageAccuracy: 0,
      lastPlayedAt: null,
    });
  });

  it('รวมหลายเกม', () => {
    const win = buildPlayerReview(session(), 'p1')!;
    const second = { ...buildPlayerReview(session(), 'p2')!, finishedAt: t(90) };
    const s = summarizeStats([win, second]);
    expect(s).toMatchObject({
      gamesPlayed: 2,
      wins: 1,
      podiumFinishes: 2,
      bestRank: 1,
      bestScore: 1900,
      totalScore: 2700,
      totalCorrect: 3,
      totalQuestions: 6,
      bestStreak: 2,
      awardsEarned: 3,
      averageAccuracy: 50,
    });
    expect(s.lastPlayedAt).toEqual(t(90));
  });
});

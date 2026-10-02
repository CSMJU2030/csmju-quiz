import { calculatePoints, rankPlayers } from './scoring';
import { buildSnapshot } from './snapshot';

describe('calculatePoints (สูตรเดียวกับ frontend)', () => {
  it('ใช้คะแนนของข้อเป็นฐาน', () => {
    expect(calculatePoints({ correct: true, basePoints: 1000, speed: 1, streak: 1 })).toBe(1000);
    expect(calculatePoints({ correct: true, basePoints: 2000, speed: 1, streak: 1 })).toBe(2000);
  });
  it('ไม่คิดคะแนน และตอบผิด ได้ 0', () => {
    expect(calculatePoints({ correct: true, basePoints: 0, speed: 1, streak: 3 })).toBe(0);
    expect(calculatePoints({ correct: false, basePoints: 1000, speed: 1, streak: 0 })).toBe(0);
  });
  it('ช้าสุดได้ครึ่ง · โบนัสต่อเนื่องไม่เกิน 2 เท่า', () => {
    expect(calculatePoints({ correct: true, basePoints: 1000, speed: 0, streak: 1 })).toBe(500);
    expect(calculatePoints({ correct: true, basePoints: 1000, speed: 1, streak: 3 })).toBe(1200);
    expect(calculatePoints({ correct: true, basePoints: 1000, speed: 1, streak: 50 })).toBe(2000);
  });
});

describe('rankPlayers', () => {
  it('คะแนนเท่ากันได้อันดับเดียวกัน', () => {
    const r = rankPlayers([
      { id: 'a', score: 10, joinedAt: 1 },
      { id: 'b', score: 30, joinedAt: 2 },
      { id: 'c', score: 10, joinedAt: 3 },
      { id: 'd', score: 5, joinedAt: 4 },
    ]);
    expect(r.map((p) => `${p.id}${p.rank}`)).toEqual(['b1', 'a2', 'c2', 'd4']);
  });
});

describe('buildSnapshot', () => {
  const quiz = {
    id: 'q',
    title: 't',
    questions: [
      {
        id: '1',
        type: 'TRUE_FALSE',
        prompt: 'x',
        imageUrl: null,
        timeLimit: 20,
        points: 1000,
        options: [
          { id: 'a', text: 'ถูก', isCorrect: true },
          { id: 'b', text: 'ผิด', isCorrect: false },
        ],
      },
      {
        id: '2',
        type: 'MULTIPLE_CHOICE',
        prompt: 'y',
        imageUrl: null,
        timeLimit: 30,
        points: 1000,
        options: [
          { id: 'c', text: '1', isCorrect: true },
          { id: 'd', text: '2', isCorrect: false },
          { id: 'e', text: '3', isCorrect: false },
        ],
      },
    ],
  };
  it('ตั้งเวลาเท่ากันทุกข้อ และคงลำดับถูก/ผิด เมื่อสุ่มตัวเลือก', () => {
    const s = buildSnapshot(quiz, {
      timeLimitOverride: 10,
      shuffleQuestions: false,
      shuffleOptions: true,
    });
    expect(s.questions.map((q) => q.timeLimit)).toEqual([10, 10]);
    expect(s.questions[0].options.map((o) => o.text)).toEqual(['ถูก', 'ผิด']);
    expect(new Set(s.questions[1].options.map((o) => o.id))).toEqual(new Set(['c', 'd', 'e']));
  });
});

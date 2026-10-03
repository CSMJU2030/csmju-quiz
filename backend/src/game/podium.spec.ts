import { computeAwards, computePlayerStats, type PodiumAnswer } from './podium';

const a = (
  playerId: string,
  questionIndex: number,
  isCorrect: boolean,
  responseMs = 1000,
  isTimedOut = false,
): PodiumAnswer => ({ playerId, questionIndex, isCorrect, isTimedOut, responseMs });

describe('podium stats & awards', () => {
  const answers = [
    a('p1', 0, true, 900),
    a('p2', 0, true, 500),
    a('p1', 1, true, 800),
    a('p2', 1, false, 400),
    a('p1', 2, true, 700),
    a('p2', 2, false, 0, true),
  ];

  it('นับถูก ตอบจริง ติดกันสูงสุด และตอบถูกเร็วที่สุด', () => {
    const stats = computePlayerStats(['p1', 'p2'], answers, 3);
    expect(stats.get('p1')).toEqual({
      playerId: 'p1',
      correct: 3,
      answered: 3,
      maxStreak: 3,
      firstCorrect: 2,
    });
    expect(stats.get('p2')).toEqual({
      playerId: 'p2',
      correct: 1,
      answered: 2,
      maxStreak: 1,
      firstCorrect: 1,
    });
  });

  it('มอบรางวัลให้คนที่เข้าเกณฑ์ · ค่าเท่ากันให้คะแนนสูงกว่า', () => {
    const stats = computePlayerStats(['p1', 'p2'], answers, 3);
    const awards = computeAwards(
      stats,
      new Map([
        ['p1', 3000],
        ['p2', 900],
      ]),
      3,
    );
    expect(awards).toEqual([
      { kind: 'fastest', playerId: 'p1', value: 2 },
      { kind: 'streak', playerId: 'p1', value: 3 },
      { kind: 'accuracy', playerId: 'p1', value: 100 },
    ]);
  });

  it('ไม่มีใครตอบถูก → ไม่มีรางวัล', () => {
    const stats = computePlayerStats(['p1'], [a('p1', 0, false)], 1);
    expect(computeAwards(stats, new Map(), 1)).toEqual([]);
  });
});

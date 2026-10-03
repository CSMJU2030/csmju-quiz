// ตัวควบคุมจังหวะเกม: ตั้งเวลาซ้อนกันไม่ได้ · ปิดรับคำตอบล็อกแถวห้อง · ตัด streak เฉพาะคนที่หมดเวลาจริง
import { GameEngine } from './game-engine.service';
import { TIMING } from './game-timing';

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const snapshot = {
  questions: [{ id: 'q1', timeLimit: 10, points: 1000, options: [] }],
};

function engineWith(prisma: Record<string, unknown>) {
  const hub = { emit: jest.fn() };
  const engine = new GameEngine(prisma as never, hub as never);
  const timers = (engine as unknown as { timers: Map<string, NodeJS.Timeout> }).timers;
  return { engine, hub, timers };
}

describe('GameEngine.schedule', () => {
  afterEach(() => jest.restoreAllMocks());

  it('schedule() สองครั้งพร้อมกัน → เหลือ timer เดียว (ของรุ่นใหม่กว่า)', async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    const findUnique = jest
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { engine, timers } = engineWith({ gameSession: { findUnique } });
    const spy = jest.spyOn(global, 'setTimeout');

    const a = engine.schedule('g');
    const b = engine.schedule('g');
    const row = {
      status: 'ACTIVE',
      phase: 'RESULT',
      currentQuestionIndex: 0,
      phaseEndsAt: new Date(Date.now() + 60_000),
    };
    second.resolve(row);
    await b;
    first.resolve(row); // รุ่นเก่ากลับมาทีหลัง → ต้องไม่ตั้ง timer ซ้อน
    await a;

    expect(spy).toHaveBeenCalledTimes(1);
    expect(timers.size).toBe(1);
    engine.onModuleDestroy();
  });

  it('cancel() ระหว่าง schedule() รอ DB → ไม่ตั้ง timer', async () => {
    const pending = deferred<unknown>();
    const { engine, timers } = engineWith({
      gameSession: { findUnique: jest.fn(() => pending.promise) },
    });
    const run = engine.schedule('g');
    engine.cancel('g');
    pending.resolve({ status: 'ACTIVE', phase: 'RESULT', phaseEndsAt: new Date() });
    await run;
    expect(timers.size).toBe(0);
  });

  it('ปิดรับคำตอบหลังเวลาที่ผู้เล่นเห็น + LATE_GRACE_MS', async () => {
    const start = Date.now();
    const { engine } = engineWith({
      gameSession: {
        findUnique: jest.fn(async () => ({
          status: 'ACTIVE',
          phase: 'QUESTION',
          currentQuestionIndex: 0,
          questionStartedAt: new Date(start),
          countdownEndsAt: null,
          quizSnapshot: snapshot,
        })),
      },
    });
    const spy = jest.spyOn(global, 'setTimeout');
    await engine.schedule('g');
    const delay = spy.mock.calls[0][1] as number;
    const expected = start + 10_000 + TIMING.LATE_GRACE_MS - Date.now();
    expect(Math.abs(delay - expected)).toBeLessThan(50);
    engine.onModuleDestroy();
  });
});

describe('GameEngine.closeQuestion', () => {
  it('ล็อกแถวห้องก่อน · ตัด streak เฉพาะคนที่บันทึก "หมดเวลา" ได้จริง', async () => {
    const order: string[] = [];
    const tx = {
      $queryRaw: jest.fn(async () => {
        order.push('lock');
        return [{ id: 'g' }];
      }),
      gameSession: {
        updateMany: jest.fn(async () => {
          order.push('update');
          return { count: 1 };
        }),
        findUniqueOrThrow: jest.fn(async () => ({
          quizSnapshot: snapshot,
          players: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
          answers: [{ playerId: 'p1' }],
        })),
      },
      // p3 ตอบทันพอดี (แถวมีอยู่แล้ว) → ไม่ได้ถูกบันทึกเป็นหมดเวลา
      gameAnswer: { createManyAndReturn: jest.fn(async () => [{ playerId: 'p2' }]) },
      gamePlayer: { updateMany: jest.fn(async () => ({ count: 1 })) },
    };
    const { engine, hub } = engineWith({
      $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
      gameSession: { findUnique: jest.fn(async () => null) },
    });

    await expect(engine.advance('g', { phase: 'QUESTION', index: 0 })).resolves.toBe(true);
    expect(order).toEqual(['lock', 'update']);
    expect(tx.gamePlayer.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['p2'] } },
      data: { streak: 0 },
    });
    expect(hub.emit).toHaveBeenCalledWith('g');
  });
});

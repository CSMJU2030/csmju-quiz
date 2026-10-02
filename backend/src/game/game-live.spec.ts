// สิทธิ์ของผู้ดูแลในห้องเกม · SSE ปิดเมื่อหมดสิทธิ์ · โหลดสถานะครั้งเดียวต่อการเปลี่ยนแปลง
import type { MessageEvent } from '@nestjs/common';
import { firstValueFrom, lastValueFrom, Subject, toArray } from 'rxjs';
import type { CoreHubIdentity } from '../auth/core-hub-identity';
import { permissionsOf } from '../auth/permissions';
import type { SubsystemRole } from '../auth/role-mapping';
import { GameSessionsService } from './game-sessions.service';
import { GameStateFeed, liveStream } from './game-state-feed';

const identity = (sub: string, role: SubsystemRole): CoreHubIdentity => ({
  coreUserId: sub,
  email: `${sub}@core.local`,
  coreRole: role === 'ADMIN' ? 'admin' : role === 'HOST' ? 'staff' : 'student',
  subsystemRole: role,
  permissions: permissionsOf(role),
  exp: Math.floor(Date.now() / 1000) + 900,
});

const admin = identity('admin-1', 'ADMIN');
const hostA = identity('host-a', 'HOST');

function session(players: { id: string; coreUserId: string | null }[] = []) {
  const now = new Date();
  return {
    id: 'g',
    quizId: 'q',
    hostCoreUserId: hostA.coreUserId,
    gamePin: '123456',
    status: 'ACTIVE',
    phase: 'QUESTION',
    currentQuestionIndex: 0,
    questionStartedAt: now,
    phaseEndsAt: null,
    countdownEndsAt: null,
    quizTitle: 't',
    quizSnapshot: {
      quizId: 'q',
      title: 't',
      questions: [
        {
          id: 'q1',
          type: 'TRUE_FALSE',
          prompt: 'p',
          imageUrl: null,
          timeLimit: 20,
          points: 1000,
          options: [
            { id: 'o1', text: 'ถูก', isCorrect: true },
            { id: 'o2', text: 'ผิด', isCorrect: false },
          ],
        },
      ],
    },
    settings: {},
    startedAt: now,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
    players: players.map((p, i) => ({
      ...p,
      gameSessionId: 'g',
      roomPassHash: null,
      roomPassExpiresAt: null,
      nickname: `คน${i}`,
      avatarIndex: 0,
      score: 0,
      streak: 0,
      createdAt: now,
      updatedAt: now,
    })),
    answers: [],
  };
}

function service(room: unknown) {
  const create = jest.fn(({ data }) => ({ id: 'new', ...data }));
  const prisma: Record<string, unknown> = {
    gameSession: { findUnique: jest.fn(async () => room) },
    gamePlayer: { create },
    $queryRaw: jest.fn(async () => (room ? [{ id: 'g' }] : [])),
  };
  prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
  const hub = { emit: jest.fn() };
  const svc = new GameSessionsService(prisma as never, {} as never, {} as never, hub as never);
  return { svc, create, prisma };
}

describe('ผู้ดูแล (game:manage:any) ในห้องของคนอื่น', () => {
  it('เข้าเป็นผู้เล่นไม่ได้ → 409 · ผู้เปิดห้องเองก็ไม่ได้', async () => {
    const { svc, create } = service({ ...session(), status: 'LOBBY', phase: 'LOBBY' });
    await expect(svc.join(admin, 'g', { nickname: 'แอดมิน' })).rejects.toMatchObject({
      errorCode: 'CONFLICT',
    });
    await expect(svc.join(hostA, 'g', { nickname: 'โฮสต์' })).rejects.toMatchObject({
      errorCode: 'CONFLICT',
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('เข้าร่วมตรวจและเพิ่มผู้เล่นภายใต้ล็อกแถวห้อง (FOR UPDATE)', async () => {
    const student = identity('stu-1', 'PLAYER');
    const { svc, create, prisma } = service({ ...session(), status: 'LOBBY', phase: 'LOBBY' });
    await svc.join(student, 'g', { nickname: 'นักเรียน' });
    expect(prisma.$transaction).toHaveBeenCalled();
    const sql = (prisma.$queryRaw as jest.Mock).mock.calls[0][0] as string[];
    expect(sql.join('?')).toMatch(/FOR UPDATE/);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('ห้องถูกลบไปแล้ว → 404', async () => {
    const { svc } = service(null);
    await expect(svc.join(identity('s', 'PLAYER'), 'g', { nickname: 'x' })).rejects.toMatchObject({
      errorCode: 'NOT_FOUND',
    });
  });

  it('ถ้าอยู่ในรายชื่อผู้เล่น (ข้อมูลเก่า) → เห็นมุมมองผู้เล่น ไม่เห็นเฉลย/การกระจายคำตอบ', () => {
    const { svc } = service(null);
    const s = session([{ id: 'p-admin', coreUserId: admin.coreUserId }]);
    const view = svc.viewFor(s as never, admin);
    expect(view.viewer).toBe('PLAYER');
    expect(view.distribution).toBeNull();
    expect(view.question?.options.every((o) => !('isCorrect' in o))).toBe(true);
    // ไม่ได้อยู่ในรายชื่อ → มุมมอง host ตามสิทธิ์ดูแล
    expect(svc.viewFor(session() as never, admin).viewer).toBe('HOST');
  });
});

describe('liveStream (SSE)', () => {
  type S = { players: string[] } | null;
  const run = (changes: Subject<S>, me = 'p1', expiresAt?: number) =>
    liveStream<{ players: string[] }>({
      id: 'g',
      first: { players: [me] },
      changes,
      canView: (s) => s.players.includes(me),
      view: (s) => ({ players: s.players }),
      recheck: async () => ({ players: [] }),
      heartbeatMs: 5,
      expiresAt,
    });

  it('ผู้เล่นถูกเตะ → ส่ง closed แล้วจบ stream ทั้งหมด (ping หยุดด้วย)', async () => {
    const changes = new Subject<S>();
    const events: MessageEvent[] = [];
    const done = lastValueFrom(run(changes).pipe(toArray())).then((all) => events.push(...all));
    await new Promise((r) => setTimeout(r, 20)); // ให้มี ping ก่อน
    changes.next({ players: ['p1', 'p2'] });
    changes.next({ players: ['p2'] }); // ถูกเตะ
    await done;
    const types = events.map((e) => e.type);
    expect(types[0]).toBe('state');
    expect(types).toContain('ping');
    expect(types.at(-1)).toBe('closed');
    expect(types.filter((t) => t === 'closed')).toHaveLength(1);
    expect(changes.observed).toBe(false); // เลิกฟังการเปลี่ยนแปลงแล้ว
  });

  it('ห้องถูกลบ (โหลดไม่ได้) → closed แล้วจบ', async () => {
    const changes = new Subject<S>();
    const all = lastValueFrom(run(changes).pipe(toArray()));
    changes.next(null);
    expect((await all).map((e) => e.type)).toEqual(['state', 'closed']);
  });

  it('สถานะที่แชร์เก่ากว่าการเข้าห้อง → ตรวจซ้ำกับ DB ก่อนปิด', async () => {
    const changes = new Subject<S>();
    const stream = liveStream<{ players: string[] }>({
      id: 'g',
      first: { players: ['p1'] },
      changes,
      canView: (s) => s.players.includes('p1'),
      view: (s) => ({ players: s.players }),
      recheck: async () => ({ players: ['p1'] }),
      heartbeatMs: 1000,
    });
    const events: MessageEvent[] = [];
    const sub = stream.subscribe((e) => events.push(e));
    changes.next({ players: [] });
    await new Promise((r) => setTimeout(r, 5));
    expect(events.map((e) => e.type)).toEqual(['state', 'state']);
    sub.unsubscribe();
  });

  it('บัตรหมดอายุ → closed แล้วจบ แม้ห้องไม่เปลี่ยน', async () => {
    const changes = new Subject<S>();
    const last = await lastValueFrom(run(changes, 'p1', Date.now() + 15));
    expect(last.type).toBe('closed');
  });
});

describe('GameStateFeed — โหลดครั้งเดียวต่อการเปลี่ยนแปลง', () => {
  it('ผู้ฟังหลายคนในห้องเดียวกันใช้การโหลดร่วมกัน · ไม่มีผู้ฟังแล้วลบออกจาก map', async () => {
    const changes = new Subject<string>();
    const hub = { on: () => changes.asObservable() };
    const loadFull = jest.fn(async () => session());
    const feed = new GameStateFeed(hub as never, { loadFull } as never);

    const subs = Array.from({ length: 5 }, () => feed.changes('g').subscribe());
    expect(feed.size).toBe(1);
    const next = firstValueFrom(feed.changes('g'));
    changes.next('g');
    changes.next('g'); // ติดกัน → รวบเป็นครั้งเดียว
    await next;
    expect(loadFull).toHaveBeenCalledTimes(1);

    for (const s of subs) s.unsubscribe();
    expect(feed.size).toBe(0);
  });

  it('โหลดไม่ได้ (ห้องถูกลบ) → ส่ง null ให้ผู้ฟัง', async () => {
    const changes = new Subject<string>();
    const feed = new GameStateFeed(
      { on: () => changes } as never,
      {
        loadFull: async () => {
          throw new Error('gone');
        },
      } as never,
    );
    const next = firstValueFrom(feed.changes('g'));
    changes.next('g');
    await expect(next).resolves.toBeNull();
  });
});

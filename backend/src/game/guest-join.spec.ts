import { GameSessionsService, MAX_PLAYERS_PER_ROOM } from './game-sessions.service';
import { hashRoomPass } from './room-pass';

const players = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: `คน${i}`,
    avatarIndex: 0,
    roomPassHash: null as string | null,
    roomPassExpiresAt: null as Date | null,
  }));

function service(session: unknown, findPlayer: unknown = null) {
  const create = jest.fn(({ data }) => ({ id: 'new', ...data }));
  const prisma: Record<string, unknown> = {
    gameSession: { findUnique: jest.fn(async () => session) },
    gamePlayer: { create, findUnique: jest.fn(async () => findPlayer) },
    // ล็อกแถวห้อง (SELECT ... FOR UPDATE) — ไม่มีห้อง = ไม่มีแถว
    $queryRaw: jest.fn(async () => (session ? [{ id: 'g' }] : [])),
  };
  prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
  const hub = { emit: jest.fn() };
  const svc = new GameSessionsService(prisma as never, {} as never, {} as never, hub as never);
  return { svc, create };
}

describe('ผู้เล่นที่ใช้บัตรเข้าห้อง', () => {
  it(`ห้องละไม่เกิน ${MAX_PLAYERS_PER_ROOM} คน`, async () => {
    const { svc, create } = service({ status: 'LOBBY', players: players(MAX_PLAYERS_PER_ROOM) });
    await expect(svc.joinAsGuest('g', { nickname: 'ใหม่' }, null)).rejects.toMatchObject({
      errorCode: 'CONFLICT',
      response: { error: { message: 'Room is full' } },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('รับคนใหม่เฉพาะช่วงห้องเปิดรับ', async () => {
    const { svc } = service({ status: 'ACTIVE', players: [] });
    await expect(svc.joinAsGuest('g', { nickname: 'ใหม่' }, null)).rejects.toMatchObject({
      errorCode: 'CONFLICT',
    });
  });

  it('เก็บแค่ hash ไม่มี core_user_id · คืนค่าบัตรครั้งเดียว', async () => {
    const { svc, create } = service({ status: 'LOBBY', players: [] });
    const { pass } = await svc.joinAsGuest('g', { nickname: 'ใหม่', avatarIndex: 2 }, null);
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({ coreUserId: null, roomPassHash: hashRoomPass(pass!.value) });
    expect(JSON.stringify(data)).not.toContain(pass!.value);
  });

  it('บัตรหมดอายุ (ครบ 4 ชั่วโมง) หรือเป็นของห้องอื่น → 401', async () => {
    const expired = { id: 'p', gameSessionId: 'g', roomPassExpiresAt: new Date(Date.now() - 1) };
    await expect(service(null, expired).svc.guestPlayer('g', 'x')).rejects.toMatchObject({
      errorCode: 'UNAUTHORIZED',
    });
    const otherRoom = {
      id: 'p',
      gameSessionId: 'h',
      roomPassExpiresAt: new Date(Date.now() + 1e6),
    };
    await expect(service(null, otherRoom).svc.guestPlayer('g', 'x')).rejects.toMatchObject({
      errorCode: 'UNAUTHORIZED',
    });
    await expect(service(null, null).svc.guestPlayer('g', null)).rejects.toMatchObject({
      errorCode: 'UNAUTHORIZED',
    });
  });
});

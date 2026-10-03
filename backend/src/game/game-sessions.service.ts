import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { CoreHubIdentity } from '../auth/core-hub-identity';
import { Permission } from '../auth/permissions';
import { Errors } from '../common/app-exception';
import { Paginated } from '../common/envelope';
import { iso } from '../common/iso';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { questionIssues } from '../questions/question-rules';
import { QuizzesService } from '../quizzes/quizzes.service';
import type {
  AnswerReceiptView,
  CreateGameSessionDto,
  GameJoinView,
  GameLobbyView,
  GameSessionQueryDto,
  GameSessionSummaryView,
  GameStateView,
  JoinGameDto,
  SubmitAnswerDto,
} from './game.dto';
import { GameEngine, lockSession } from './game-engine.service';
import { GameHub } from './game-hub';
import { TIMING } from './game-timing';
import { computeAwards, computePlayerStats } from './podium';
import { calculatePoints, rankPlayers } from './scoring';
import { hashRoomPass, newRoomPass } from './room-pass';
import { buildSnapshot, readSettings, readSnapshot, type GameSettings } from './snapshot';

const FULL = { players: true, answers: true } satisfies Prisma.GameSessionInclude;
export type FullSession = Prisma.GameSessionGetPayload<{ include: typeof FULL }>;

/** ห้องละไม่เกิน 100 คน (รวมผู้เล่นที่ล็อกอินและผู้เล่นที่ใช้บัตรเข้าห้อง) */
export const MAX_PLAYERS_PER_ROOM = 100;

/** มุมมองของผู้ดู: ผู้เปิดห้อง หรือผู้เล่นคนหนึ่ง (ระบุด้วย id ของผู้เล่น) */
export interface Viewer {
  isHost: boolean;
  playerId: string | null;
}

type PlayerRow = FullSession['players'][number];

/** เฟสที่ผู้เล่นเห็นเฉลยของข้อปัจจุบันได้แล้ว */
const REVEALED = new Set(['RESULT', 'LEADERBOARD', 'PODIUM']);

@Injectable()
export class GameSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quizzes: QuizzesService,
    private readonly engine: GameEngine,
    private readonly hub: GameHub,
  ) {}

  /* ─────────── host: เปิดห้อง / รายการห้อง ─────────── */

  async create(user: CoreHubIdentity, dto: CreateGameSessionDto): Promise<GameStateView> {
    const quiz = await this.quizzes.loadReadable(user, dto.quizId);
    if (
      quiz.ownerCoreUserId !== user.coreUserId &&
      !user.permissions.includes(Permission.GAME_MANAGE_ANY)
    ) {
      throw Errors.forbidden();
    }
    if (quiz.status !== 'PUBLISHED') throw Errors.conflict('Only published quizzes can be played');
    if (quiz.questions.length === 0) throw Errors.conflict('Quiz has no questions');
    const incomplete = quiz.questions.filter((q) => questionIssues(q).length > 0).length;
    if (incomplete) throw Errors.conflict(`Quiz has ${incomplete} incomplete question(s)`);

    const settings: GameSettings = {
      timeLimitOverride: dto.timeLimitOverride ?? null,
      shuffleQuestions: dto.shuffleQuestions ?? false,
      shuffleOptions: dto.shuffleOptions ?? false,
    };
    const snapshot = buildSnapshot(quiz, settings);

    const session = await this.prisma.gameSession.create({
      data: {
        quizId: quiz.id,
        hostCoreUserId: user.coreUserId,
        gamePin: await this.uniquePin(),
        quizTitle: quiz.title,
        quizSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        settings: settings as unknown as Prisma.InputJsonValue,
      },
      include: FULL,
    });
    return this.viewFor(session, user);
  }

  async list(user: CoreHubIdentity, q: GameSessionQueryDto) {
    if (q.gamePin) return this.findJoinable(user, q);
    if (!user.permissions.includes(Permission.GAME_HOST)) {
      // ผู้เล่นค้นได้เฉพาะด้วยรหัสเกม
      throw Errors.validation(['gamePin is required']);
    }
    const where: Prisma.GameSessionWhereInput = {
      ...(user.permissions.includes(Permission.GAME_MANAGE_ANY)
        ? {}
        : { hostCoreUserId: user.coreUserId }),
      ...(q.status ? { status: q.status } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.gameSession.count({ where }),
      this.prisma.gameSession.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: q.skip,
        take: q.limit,
        include: { _count: { select: { players: true } } },
      }),
    ]);
    const items: GameSessionSummaryView[] = rows.map((s) => ({
      id: s.id,
      gamePin: s.gamePin,
      quizId: s.quizId,
      quizTitle: s.quizTitle,
      status: s.status,
      phase: s.phase,
      playerCount: s._count.players,
      totalQuestions: readSnapshot(s.quizSnapshot).questions.length,
      startedAt: iso(s.startedAt),
      finishedAt: iso(s.finishedAt),
      createdAt: iso(s.createdAt)!,
    }));
    return Paginated.of(items, total, q.page, q.limit);
  }

  /** ห้องที่เปิดรอผู้เล่นด้วยรหัสนี้ (0 หรือ 1 ห้อง) */
  private async findJoinable(user: CoreHubIdentity | null, q: GameSessionQueryDto) {
    const rows = await this.prisma.gameSession.findMany({
      where: { gamePin: q.gamePin, status: 'LOBBY' },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 1,
      include: { players: { select: { coreUserId: true } } },
    });
    const items: GameLobbyView[] = rows.map((s) => ({
      id: s.id,
      gamePin: s.gamePin,
      quizTitle: s.quizTitle,
      status: s.status,
      playerCount: s.players.length,
      totalQuestions: readSnapshot(s.quizSnapshot).questions.length,
      joined: user ? s.players.some((p) => p.coreUserId === user.coreUserId) : false,
    }));
    return Paginated.of(items.slice(q.skip, q.skip + q.limit), items.length, q.page, q.limit);
  }

  /** ผู้เล่นที่ไม่ล็อกอินค้นห้องด้วยรหัสเกม */
  findLobbyForGuest(q: GameSessionQueryDto) {
    if (!q.gamePin) throw Errors.validation(['gamePin is required']);
    return this.findJoinable(null, q);
  }

  async findOne(user: CoreHubIdentity, id: string): Promise<GameStateView> {
    const session = await this.loadFull(id);
    this.assertCanView(session, user);
    return this.viewFor(session, user);
  }

  async remove(user: CoreHubIdentity, id: string) {
    const session = await this.loadFull(id);
    this.assertHost(session, user);
    this.engine.cancel(id);
    await this.prisma.gameSession.delete({ where: { id } });
    this.hub.emit(id);
    return { id, deleted: true };
  }

  /* ─────────── host: ควบคุมเกม ─────────── */

  async start(user: CoreHubIdentity, id: string) {
    const session = await this.loadFull(id);
    this.assertHost(session, user);
    if (session.status !== 'LOBBY') throw Errors.conflict('Game has already started');
    if (session.players.length === 0) throw Errors.conflict('At least one player must join first');
    await this.engine.start(id);
    return this.findOne(user, id);
  }

  async advance(user: CoreHubIdentity, id: string) {
    const session = await this.loadFull(id);
    this.assertHost(session, user);
    if (session.status === 'LOBBY') return this.start(user, id);
    if (session.status !== 'ACTIVE') throw Errors.conflict('Game is not active');
    await this.engine.advance(id, { phase: session.phase, index: session.currentQuestionIndex });
    return this.findOne(user, id);
  }

  /* ─────────── ผู้เล่น ─────────── */

  async join(user: CoreHubIdentity, id: string, dto: JoinGameDto): Promise<GameJoinView> {
    // ตรวจจำนวนคน/ชื่อซ้ำแล้วเพิ่มผู้เล่นภายใต้ล็อกแถวห้อง → คำขอพร้อมกันไม่หลุดเกิน 100 คน/ชื่อไม่ซ้ำ
    const { player, created } = await this.prisma.$transaction(async (tx) => {
      const session = await this.lockedRoom(tx, id);
      // ผู้เปิดห้องและผู้ดูแล (game:manage:any) เห็นเฉลยของทุกห้อง จึงเข้าเป็นผู้เล่นไม่ได้
      if (this.isHost(session, user)) {
        throw Errors.conflict(
          session.hostCoreUserId === user.coreUserId
            ? 'The host cannot join as a player'
            : 'Game managers cannot join a game as a player',
        );
      }

      const existing = session.players.find((p) => p.coreUserId === user.coreUserId);
      // เข้าซ้ำ (เช่น รีเฟรชหน้า) — คืนข้อมูลเดิม
      if (existing) return { player: existing, created: false };

      this.assertCanAddPlayer(session, dto);
      const row = await tx.gamePlayer.create({
        data: {
          gameSessionId: id,
          coreUserId: user.coreUserId,
          nickname: dto.nickname,
          avatarIndex: dto.avatarIndex ?? 0,
        },
      });
      return { player: row, created: true };
    });
    if (created) this.hub.emit(id);
    return toJoinView(id, player);
  }

  /**
   * ผู้เล่นที่ไม่ล็อกอินเข้าห้อง — ออกบัตรเข้าห้องใหม่ (คืนค่าบัตรครั้งเดียวเพื่อใส่คุกกี้)
   * มีบัตรของห้องนี้ที่ยังใช้ได้อยู่แล้ว → คืนผู้เล่นเดิม ไม่ออกบัตรใหม่
   */
  async joinAsGuest(
    id: string,
    dto: JoinGameDto,
    passValue: string | null,
  ): Promise<{ join: GameJoinView; pass: ReturnType<typeof newRoomPass> | null }> {
    const result = await this.prisma.$transaction(async (tx) => {
      const session = await this.lockedRoom(tx, id);

      if (passValue) {
        const hash = hashRoomPass(passValue);
        const existing = session.players.find(
          (p) => p.roomPassHash === hash && isPassAlive(p.roomPassExpiresAt),
        );
        if (existing) return { join: toJoinView(id, existing), pass: null };
      }

      this.assertCanAddPlayer(session, dto);
      const pass = newRoomPass();
      const player = await tx.gamePlayer.create({
        data: {
          gameSessionId: id,
          coreUserId: null,
          roomPassHash: pass.hash,
          roomPassExpiresAt: pass.expiresAt,
          nickname: dto.nickname,
          avatarIndex: dto.avatarIndex ?? 0,
        },
      });
      return { join: toJoinView(id, player), pass };
    });
    if (result.pass) this.hub.emit(id);
    return result;
  }

  /** ห้องพร้อมรายชื่อผู้เล่น หลังล็อกแถวห้องไว้จนจบ transaction · ไม่มีห้อง → 404 */
  private async lockedRoom(tx: Prisma.TransactionClient, id: string) {
    if (!(await lockSession(tx, id))) throw Errors.notFound('Game session');
    const session = await tx.gameSession.findUnique({ where: { id }, include: { players: true } });
    if (!session) throw Errors.notFound('Game session');
    return session;
  }

  /** ผู้เล่นที่ถือบัตรของห้องนี้ · ไม่มีบัตร / บัตรหมดอายุ / ถูกเตะ / ห้องถูกปิด → 401 */
  async guestPlayer(id: string, passValue: string | null) {
    if (!passValue) throw Errors.unauthorized('Room pass is missing or expired');
    const player = await this.prisma.gamePlayer.findUnique({
      where: { roomPassHash: hashRoomPass(passValue) },
    });
    if (!player || player.gameSessionId !== id || !isPassAlive(player.roomPassExpiresAt)) {
      throw Errors.unauthorized('Room pass is missing or expired');
    }
    return player;
  }

  /** รับผู้เล่นใหม่ได้เฉพาะช่วงห้องเปิดรับ · ไม่เกิน 100 คน · ชื่อไม่ซ้ำในห้อง */
  private assertCanAddPlayer(
    session: { status: string; players: { nickname: string }[] },
    dto: JoinGameDto,
  ) {
    if (session.status !== 'LOBBY') throw Errors.conflict('Game has already started');
    if (session.players.length >= MAX_PLAYERS_PER_ROOM) throw Errors.conflict('Room is full');
    if (session.players.some((p) => p.nickname.toLowerCase() === dto.nickname.toLowerCase())) {
      throw Errors.conflict('Nickname is already taken in this game');
    }
  }

  /** ผู้เล่นออกเอง หรือ host เอาผู้เล่นออก — เฉพาะตอนยังไม่เริ่มเกม */
  async removePlayer(user: CoreHubIdentity, id: string, playerId: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id },
      include: { players: true },
    });
    if (!session) throw Errors.notFound('Game session');
    const player = session.players.find((p) => p.id === playerId);
    if (!player) throw Errors.notFound('Player');
    const isHost = this.isHost(session, user);
    if (!isHost && player.coreUserId !== user.coreUserId) throw Errors.forbidden();
    return this.deletePlayer(session, playerId, isHost);
  }

  /** ผู้เล่นที่ใช้บัตรเข้าห้องออกเอง (เฉพาะตัวเอง) */
  async leaveAsGuest(id: string, playerId: string, guestPlayerId: string) {
    if (playerId !== guestPlayerId) throw Errors.forbidden();
    const session = await this.prisma.gameSession.findUnique({ where: { id } });
    if (!session) throw Errors.notFound('Game session');
    return this.deletePlayer(session, playerId, false);
  }

  /**
   * ผู้เล่นออกเองได้เฉพาะก่อนเริ่มเกม · ผู้เปิดห้องเตะออกได้จนกว่าเกมจบ
   * ลบแถวผู้เล่น = บัตรเข้าห้องของคนนั้นใช้ไม่ได้ทันที
   */
  private async deletePlayer(
    session: { id: string; status: string },
    playerId: string,
    byHost: boolean,
  ) {
    if (byHost ? session.status === 'FINISHED' : session.status !== 'LOBBY') {
      throw Errors.conflict(
        byHost
          ? 'Players cannot be removed after the game has finished'
          : 'Players can only leave before the game starts',
      );
    }
    await this.prisma.gamePlayer.delete({ where: { id: playerId } });
    this.hub.emit(session.id);
    return { id: playerId, deleted: true };
  }

  answer(user: CoreHubIdentity, id: string, dto: SubmitAnswerDto): Promise<AnswerReceiptView> {
    return this.submitAnswer(id, dto, (players) =>
      players.find((p) => p.coreUserId === user.coreUserId),
    );
  }

  answerAsGuest(id: string, playerId: string, dto: SubmitAnswerDto): Promise<AnswerReceiptView> {
    return this.submitAnswer(id, dto, (players) => players.find((p) => p.id === playerId));
  }

  private async submitAnswer(
    id: string,
    dto: SubmitAnswerDto,
    pick: (
      players: { id: string; coreUserId: string | null; streak: number }[],
    ) => { id: string; streak: number } | undefined,
  ): Promise<AnswerReceiptView> {
    const now = Date.now();
    const result = await this.prisma.$transaction(async (tx) => {
      // ล็อกแถวห้อง → ไม่ซ้อนกับการปิดรับคำตอบ (closeQuestion ล็อกแถวเดียวกัน)
      await lockSession(tx, id);
      const session = await tx.gameSession.findUnique({
        where: { id },
        include: { players: true },
      });
      if (!session) throw Errors.notFound('Game session');
      const player = pick(session.players);
      if (!player) throw Errors.forbidden('You are not a player in this game');
      if (
        session.status !== 'ACTIVE' ||
        session.phase !== 'QUESTION' ||
        !session.questionStartedAt
      ) {
        throw Errors.conflict('Answers are closed');
      }

      const index = session.currentQuestionIndex;
      const question = readSnapshot(session.quizSnapshot).questions[index];
      if (!question) throw Errors.conflict('Answers are closed');

      const start = session.questionStartedAt.getTime();
      const deadline = start + question.timeLimit * 1000;
      if (now < start - TIMING.START_TOLERANCE_MS)
        throw Errors.conflict('Question has not started yet');
      const closeAt = session.countdownEndsAt
        ? Math.min(session.countdownEndsAt.getTime(), deadline)
        : deadline;
      if (now > closeAt + TIMING.LATE_GRACE_MS) throw Errors.conflict('Answers are closed');

      const option = question.options.find((o) => o.id === dto.optionId);
      if (!option) throw Errors.validation(['optionId is not an option of the current question']);

      const elapsedMs = Math.max(0, now - start);
      const correct = option.isCorrect;
      const streak = correct ? player.streak + 1 : 0;
      const points = calculatePoints({
        correct,
        basePoints: question.points,
        speed: 1 - elapsedMs / (question.timeLimit * 1000),
        streak,
      });

      try {
        await tx.gameAnswer.create({
          data: {
            gameSessionId: id,
            playerId: player.id,
            questionIndex: index,
            questionId: question.id,
            optionId: option.id,
            isCorrect: correct,
            points,
            responseMs: Math.round(elapsedMs),
          },
        });
      } catch (error) {
        if ((error as { code?: string }).code === 'P2002')
          throw Errors.conflict('Already answered this question');
        throw error;
      }
      await tx.gamePlayer.update({
        where: { id: player.id },
        data: { score: { increment: points }, streak },
      });

      const answered = await tx.gameAnswer.count({
        where: { gameSessionId: id, questionIndex: index },
      });
      return { index, allAnswered: answered >= session.players.length };
    });

    this.hub.emit(id);
    if (result.allAnswered) await this.engine.armLockCountdown(id, result.index);
    return { questionIndex: result.index, optionId: dto.optionId, accepted: true };
  }

  /* ─────────── views ─────────── */

  async loadFull(id: string): Promise<FullSession> {
    const session = await this.prisma.gameSession.findUnique({ where: { id }, include: FULL });
    if (!session) throw Errors.notFound('Game session');
    return session;
  }

  isHost(session: { hostCoreUserId: string }, user: CoreHubIdentity) {
    return (
      session.hostCoreUserId === user.coreUserId ||
      user.permissions.includes(Permission.GAME_MANAGE_ANY)
    );
  }

  assertHost(session: { hostCoreUserId: string }, user: CoreHubIdentity) {
    if (!this.isHost(session, user)) throw Errors.forbidden('Only the host can control this game');
  }

  canView(session: Pick<FullSession, 'hostCoreUserId' | 'players'>, user: CoreHubIdentity) {
    return (
      this.isHost(session, user) || session.players.some((p) => p.coreUserId === user.coreUserId)
    );
  }

  assertCanView(session: FullSession, user: CoreHubIdentity) {
    if (!this.canView(session, user)) throw Errors.forbidden('Join this game first');
  }

  viewFor(session: FullSession, user: CoreHubIdentity): GameStateView {
    const me = session.players.find((p) => p.coreUserId === user.coreUserId);
    // อยู่ในรายชื่อผู้เล่น = มุมมองผู้เล่นเสมอ (แม้มีสิทธิ์ดูแลทุกห้อง) → ไม่เห็นเฉลยก่อนเวลา
    const isHost = !me && this.isHost(session, user);
    return this.viewAs(session, { isHost, playerId: me?.id ?? null });
  }

  /** มุมมองของผู้เล่นที่ใช้บัตรเข้าห้อง (ไม่ใช่ผู้เปิดห้องเสมอ) */
  viewForGuest(session: FullSession, playerId: string): GameStateView {
    return this.viewAs(session, { isHost: false, playerId });
  }

  private viewAs(session: FullSession, viewer: Viewer): GameStateView {
    const isHost = viewer.isHost;
    const snapshot = readSnapshot(session.quizSnapshot);
    const index = session.currentQuestionIndex;
    const q = snapshot.questions[index];
    const revealed = isHost || REVEALED.has(session.phase);
    const showQuestion = session.phase !== 'LOBBY' && session.phase !== 'PODIUM' && !!q;

    const current = session.answers.filter((a) => a.questionIndex === index && !a.isTimedOut);
    const answeredIds = new Set(
      session.answers.filter((a) => a.questionIndex === index).map((a) => a.playerId),
    );

    const ranked = rankPlayers(
      session.players.map((p) => ({ ...p, joinedAt: p.createdAt.getTime() })),
    );

    const distribution: Record<string, number> = {};
    if (q) for (const o of q.options) distribution[o.id] = 0;
    for (const a of current)
      if (a.optionId) distribution[a.optionId] = (distribution[a.optionId] ?? 0) + 1;

    const mine = viewer.playerId ? ranked.find((p) => p.id === viewer.playerId) : undefined;
    const myAnswer = mine
      ? session.answers.find((a) => a.playerId === mine.id && a.questionIndex === index)
      : undefined;

    return {
      id: session.id,
      gamePin: session.gamePin,
      status: session.status,
      phase: session.phase,
      viewer: isHost ? 'HOST' : 'PLAYER',
      quizId: session.quizId,
      quizTitle: session.quizTitle,
      currentQuestionIndex: index,
      totalQuestions: snapshot.questions.length,
      questionStartedAt: iso(session.questionStartedAt),
      phaseEndsAt: iso(session.phaseEndsAt),
      countdownEndsAt: iso(session.countdownEndsAt),
      serverTime: new Date().toISOString(),
      settings: readSettings(session.settings),
      question: showQuestion
        ? {
            id: q.id,
            index,
            type: q.type,
            prompt: q.prompt,
            imageUrl: q.imageUrl,
            timeLimit: q.timeLimit,
            points: q.points,
            options: q.options.map((o) =>
              revealed
                ? { id: o.id, text: o.text, isCorrect: o.isCorrect }
                : { id: o.id, text: o.text },
            ),
          }
        : null,
      answeredCount: answeredIds.size,
      playerCount: session.players.length,
      players: ranked.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        avatarIndex: p.avatarIndex,
        score: p.score,
        streak: p.streak,
        rank: p.rank,
        hasAnswered: answeredIds.has(p.id),
      })),
      distribution: revealed ? distribution : null,
      me: mine
        ? {
            playerId: mine.id,
            nickname: mine.nickname,
            avatarIndex: mine.avatarIndex,
            score: mine.score,
            streak: mine.streak,
            rank: mine.rank,
            answer: myAnswer
              ? {
                  optionId: myAnswer.optionId,
                  isTimedOut: myAnswer.isTimedOut,
                  ...(REVEALED.has(session.phase)
                    ? { isCorrect: myAnswer.isCorrect, points: myAnswer.points }
                    : {}),
                }
              : null,
          }
        : null,
      results:
        session.phase === 'PODIUM' ? this.podiumResults(session, snapshot.questions.length) : null,
      startedAt: iso(session.startedAt),
      finishedAt: iso(session.finishedAt),
      createdAt: iso(session.createdAt)!,
    };
  }

  private podiumResults(session: FullSession, totalQuestions: number) {
    const stats = computePlayerStats(
      session.players.map((p) => p.id),
      session.answers,
      totalQuestions,
    );
    const scores = new Map(session.players.map((p) => [p.id, p.score]));
    return {
      players: [...stats.values()],
      awards: computeAwards(stats, scores, totalQuestions),
    };
  }

  private async uniquePin() {
    for (let attempt = 0; attempt < 20; attempt++) {
      const pin = String(randomInt(100000, 1000000));
      const clash = await this.prisma.gameSession.count({
        where: { gamePin: pin, status: { in: ['LOBBY', 'ACTIVE'] } },
      });
      if (clash === 0) return pin;
    }
    throw Errors.conflict('Could not allocate a game PIN, please try again');
  }
}

function toJoinView(gameSessionId: string, p: Pick<PlayerRow, 'id' | 'nickname' | 'avatarIndex'>) {
  return { gameSessionId, playerId: p.id, nickname: p.nickname, avatarIndex: p.avatarIndex };
}

function isPassAlive(expiresAt: Date | null) {
  return expiresAt !== null && expiresAt.getTime() > Date.now();
}

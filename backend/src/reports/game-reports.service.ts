// รายงาน = มุมมองของห้องเกมที่เล่นจบแล้ว (status FINISHED) — คำนวณจากสำเนาแบบทดสอบในเกม
import { Injectable } from '@nestjs/common';
import type { CoreHubIdentity } from '../auth/core-hub-identity';
import { Permission } from '../auth/permissions';
import { Errors } from '../common/app-exception';
import { Paginated } from '../common/envelope';
import { iso } from '../common/iso';
import type { Prisma } from '../generated/prisma/client';
import { rankPlayers } from '../game/scoring';
import { readSnapshot } from '../game/snapshot';
import { buildPlayerReview } from './player-review';
import type { PlayerGameReviewView } from './player-review.dto';
import { toReviewView } from './player-review.mapper';
import { PrismaService } from '../prisma/prisma.service';
import type { GameReportQueryDto, GameReportSummaryView, GameReportView } from './game-report.dto';

const FULL = { players: true, answers: true } satisfies Prisma.GameSessionInclude;
type FullSession = Prisma.GameSessionGetPayload<{ include: typeof FULL }>;

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 10000) / 100 : 0);

/**
 * รายการรายงานใช้แค่ตัวเลขสรุป — ไม่ดึงคำตอบทั้งหมด: นับเฉพาะ "ตอบถูก" ต่อผู้เล่นใน DB
 * (ตอบถูก = is_correct และไม่ใช่หมดเวลา · สูตรเดียวกับ build())
 */
const SUMMARY_SELECT = {
  id: true,
  quizId: true,
  quizTitle: true,
  gamePin: true,
  quizSnapshot: true,
  startedAt: true,
  finishedAt: true,
  updatedAt: true,
  players: {
    select: {
      score: true,
      createdAt: true,
      _count: { select: { answers: { where: { isCorrect: true, isTimedOut: false } } } },
    },
  },
} satisfies Prisma.GameSessionSelect;
type SummaryRow = Prisma.GameSessionGetPayload<{ select: typeof SUMMARY_SELECT }>;

function toSummary(s: SummaryRow): GameReportSummaryView {
  const questionCount = readSnapshot(s.quizSnapshot).questions.length;
  // เรียงตามอันดับแบบเดียวกับ build() → ผลรวมทศนิยมได้ค่าเดียวกันทุกหลัก
  const ranked = rankPlayers(s.players.map((p) => ({ ...p, joinedAt: p.createdAt.getTime() })));
  const accuracies = ranked.map((p) => pct(p._count.answers, questionCount));
  return {
    id: s.id,
    quizId: s.quizId,
    quizTitle: s.quizTitle,
    gamePin: s.gamePin,
    playerCount: s.players.length,
    questionCount,
    averageAccuracy: accuracies.length
      ? Math.round((accuracies.reduce((sum, a) => sum + a, 0) / accuracies.length) * 100) / 100
      : 0,
    topScore: s.players.reduce((max, p) => Math.max(max, p.score), 0),
    startedAt: iso(s.startedAt),
    finishedAt: iso(s.finishedAt ?? s.updatedAt)!,
  };
}

@Injectable()
export class GameReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: CoreHubIdentity, q: GameReportQueryDto) {
    const where: Prisma.GameSessionWhereInput = {
      status: 'FINISHED',
      ...(this.canReadAny(user) ? {} : { hostCoreUserId: user.coreUserId }),
      ...(q.quizId ? { quizId: q.quizId } : {}),
      ...(q.search ? { quizTitle: { contains: q.search, mode: 'insensitive' } } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.gameSession.count({ where }),
      this.prisma.gameSession.findMany({
        where,
        orderBy: [{ finishedAt: 'desc' }, { id: 'asc' }],
        skip: q.skip,
        take: q.limit,
        select: SUMMARY_SELECT,
      }),
    ]);
    return Paginated.of(rows.map(toSummary), total, q.page, q.limit);
  }

  async findOne(user: CoreHubIdentity, id: string): Promise<GameReportView> {
    const session = await this.prisma.gameSession.findUnique({ where: { id }, include: FULL });
    if (!session || session.status !== 'FINISHED') throw Errors.notFound('Game report');
    if (session.hostCoreUserId !== user.coreUserId && !this.canReadAny(user))
      throw Errors.forbidden();
    return this.build(session);
  }

  /** คำตอบรายข้อของผู้เล่นหนึ่งคน — สิทธิ์เดียวกับรายงาน (host ของเกม หรือ ADMIN) */
  async findPlayer(
    user: CoreHubIdentity,
    id: string,
    playerId: string,
  ): Promise<PlayerGameReviewView> {
    const session = await this.prisma.gameSession.findUnique({ where: { id }, include: FULL });
    if (!session || session.status !== 'FINISHED') throw Errors.notFound('Game report');
    if (session.hostCoreUserId !== user.coreUserId && !this.canReadAny(user))
      throw Errors.forbidden();
    const review = buildPlayerReview(session, playerId);
    if (!review) throw Errors.notFound('Player');
    return toReviewView(review);
  }

  private canReadAny(user: CoreHubIdentity) {
    return user.permissions.includes(Permission.REPORT_READ_ANY);
  }

  private build(s: FullSession): GameReportView {
    const snapshot = readSnapshot(s.quizSnapshot);
    const ranked = rankPlayers(s.players.map((p) => ({ ...p, joinedAt: p.createdAt.getTime() })));

    const players = ranked.map((p) => {
      const mine = s.answers.filter((a) => a.playerId === p.id);
      const correct = mine.filter((a) => a.isCorrect && !a.isTimedOut).length;
      const timeout = mine.filter((a) => a.isTimedOut).length;
      const answered = mine.filter((a) => !a.isTimedOut);
      return {
        rank: p.rank,
        playerId: p.id,
        coreUserId: p.coreUserId,
        nickname: p.nickname,
        avatarIndex: p.avatarIndex,
        score: p.score,
        correct,
        incorrect: answered.length - correct,
        timeout,
        accuracy: pct(correct, snapshot.questions.length),
        averageResponseMs: answered.length
          ? Math.round(answered.reduce((sum, a) => sum + a.responseMs, 0) / answered.length)
          : 0,
      };
    });

    const questions = snapshot.questions.map((q, index) => {
      const answers = s.answers.filter((a) => a.questionIndex === index);
      const correctAnswers = answers.filter((a) => a.isCorrect && !a.isTimedOut).length;
      const timeoutAnswers = answers.filter((a) => a.isTimedOut).length;
      return {
        questionNumber: index + 1,
        questionId: q.id,
        type: q.type,
        prompt: q.prompt,
        timeLimit: q.timeLimit,
        totalAnswers: answers.length,
        correctAnswers,
        incorrectAnswers: answers.length - correctAnswers - timeoutAnswers,
        timeoutAnswers,
        correctRate: pct(correctAnswers, answers.length),
        options: q.options.map((o) => ({
          optionId: o.id,
          text: o.text,
          isCorrect: o.isCorrect,
          count: answers.filter((a) => a.optionId === o.id).length,
        })),
      };
    });

    return {
      id: s.id,
      quizId: s.quizId,
      quizTitle: s.quizTitle,
      gamePin: s.gamePin,
      playerCount: players.length,
      questionCount: questions.length,
      averageAccuracy: players.length
        ? Math.round((players.reduce((sum, p) => sum + p.accuracy, 0) / players.length) * 100) / 100
        : 0,
      topScore: players.reduce((max, p) => Math.max(max, p.score), 0),
      startedAt: iso(s.startedAt),
      finishedAt: iso(s.finishedAt ?? s.updatedAt)!,
      players,
      questions,
    };
  }
}

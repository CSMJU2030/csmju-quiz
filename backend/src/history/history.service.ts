// ประวัติการเล่นของผู้ใช้ปัจจุบัน — "ของตัวเอง" = game_players.core_user_id === token.sub
// มีเฉพาะผู้เล่นที่เข้าด้วยบัญชี MJU · ผู้เล่นที่ใช้บัตรเข้าห้อง (core_user_id = null) ไม่มีประวัติ
// ตรวจ ownership ที่ query เสมอ (ไม่พึ่ง guard อย่างเดียว · authorization.md ข้อ 4)
import { Injectable } from '@nestjs/common';
import type { CoreHubIdentity } from '../auth/core-hub-identity';
import { Errors } from '../common/app-exception';
import { Paginated } from '../common/envelope';
import type { PaginationQueryDto } from '../common/pagination.dto';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildPlayerReview, type PlayerGameReview, summarizeStats } from '../reports/player-review';
import type { PlayerGameReviewView } from '../reports/player-review.dto';
import { toResultView, toReviewView } from '../reports/player-review.mapper';
import type { PlayerStatsView } from './history.dto';
import { toStatsView } from './history.mapper';

/**
 * ดึงเฉพาะคอลัมน์ที่ buildPlayerReview ใช้ (ไม่ดึง quiz_snapshot ของ quiz ต้นทาง/settings/คอลัมน์อื่น)
 * ยังต้องมีคะแนนของทุกคน (อันดับ) และคำตอบของทุกคน — รางวัลพิเศษ (เร็วสุด/ต่อเนื่อง/แม่นยำ)
 * เทียบกันทั้งห้อง จึงตัดเหลือเฉพาะคำตอบของตัวเองไม่ได้โดยไม่เปลี่ยนผล
 */
export const REVIEW_SELECT = {
  id: true,
  quizTitle: true,
  quizSnapshot: true,
  startedAt: true,
  finishedAt: true,
  updatedAt: true,
  players: {
    select: {
      id: true,
      coreUserId: true,
      nickname: true,
      avatarIndex: true,
      score: true,
      createdAt: true,
    },
  },
  answers: {
    select: {
      playerId: true,
      questionIndex: true,
      optionId: true,
      isCorrect: true,
      isTimedOut: true,
      points: true,
      responseMs: true,
    },
  },
} satisfies Prisma.GameSessionSelect;

type ReviewRow = Prisma.GameSessionGetPayload<{ select: typeof REVIEW_SELECT }>;

@Injectable()
export class GameHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** เกมที่เล่นจบแล้วที่ฉันเข้าร่วม — ใหม่สุดก่อน */
  async list(user: CoreHubIdentity, q: PaginationQueryDto) {
    const where = this.mine(user);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.gameSession.count({ where }),
      this.prisma.gameSession.findMany({
        where,
        orderBy: [{ finishedAt: 'desc' }, { id: 'asc' }],
        skip: q.skip,
        take: q.limit,
        select: REVIEW_SELECT,
      }),
    ]);
    const items = rows.map((s) => toResultView(this.reviewOf(s, user)));
    return Paginated.of(items, total, q.page, q.limit);
  }

  /** ผลของฉันในเกมนี้ + ทบทวนรายข้อ · ไม่ได้เล่น/ยังไม่จบ → 404 */
  async findOne(user: CoreHubIdentity, id: string): Promise<PlayerGameReviewView> {
    const session = await this.prisma.gameSession.findFirst({
      where: { id, ...this.mine(user) },
      select: REVIEW_SELECT,
    });
    if (!session) throw Errors.notFound('Game history');
    return toReviewView(this.reviewOf(session, user));
  }

  /** สถิติรวมจากทุกเกมที่ฉันเล่นจบ */
  async stats(user: CoreHubIdentity): Promise<PlayerStatsView> {
    const rows = await this.prisma.gameSession.findMany({
      where: this.mine(user),
      select: REVIEW_SELECT,
    });
    return toStatsView(summarizeStats(rows.map((s) => this.reviewOf(s, user))));
  }

  private mine(user: CoreHubIdentity): Prisma.GameSessionWhereInput {
    return { status: 'FINISHED', players: { some: { coreUserId: user.coreUserId } } };
  }

  private reviewOf(s: ReviewRow, user: CoreHubIdentity): PlayerGameReview {
    const me = s.players.find((p) => p.coreUserId === user.coreUserId);
    const review = me ? buildPlayerReview(s, me.id) : null;
    if (!review) throw Errors.notFound('Game history');
    return review;
  }
}

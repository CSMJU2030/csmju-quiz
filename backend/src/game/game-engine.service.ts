// ตัวควบคุมจังหวะเกม — server เป็นผู้เลื่อนเฟสเพียงผู้เดียว (ไม่พึ่งแท็บของ host)
//
//   LOBBY ──start──► QUESTION (นับ 3-2-1 ก่อนข้อแรก) ──หมดเวลา / ปิดรับ──► RESULT (5 วิ)
//     ▲                  │ ทุกคนตอบครบ → countdownEndsAt = +3 วิ                │
//     │                  ▼                                                     ▼
//     └──────────── LEADERBOARD (8 วิ) ◄──────────────────────────────────────┘
//                        │ ข้อถัดไป → QUESTION · ข้อสุดท้าย → PODIUM (FINISHED)
//
// ทุก transition เขียนแบบมีเงื่อนไข (updateMany where phase + index) จึงเลื่อนซ้ำไม่ได้
// เวลาเก็บเป็น timestamp ใน DB → รีสตาร์ต server แล้วตั้งเวลาต่อได้ (onApplicationBootstrap)
// ปิดรับคำตอบกับส่งคำตอบล็อกแถว game_sessions (FOR UPDATE) ใน transaction เดียวกัน → ทำงานทีละรายการ
import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { logApp } from '../common/logger';
import type { GamePhase } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import { GameHub } from './game-hub';
import { TIMING } from './game-timing';
import { readSnapshot } from './snapshot';

interface Guard {
  phase: GamePhase;
  index: number;
}

@Injectable()
export class GameEngine implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly timers = new Map<string, NodeJS.Timeout>();
  /**
   * รุ่นของการตั้งเวลาต่อห้อง — schedule() ที่เริ่มทีหลังชนะเสมอ
   * schedule() ที่ค้างอยู่ (await DB) แล้วรุ่นไม่ตรง = ถูกแทนที่แล้ว ไม่ตั้ง timer ซ้อน
   */
  private readonly generations = new Map<string, number>();
  private seq = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly hub: GameHub,
  ) {}

  async onApplicationBootstrap() {
    const active = await this.prisma.gameSession.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    for (const s of active) await this.schedule(s.id);
    if (active.length) logApp('info', 'resumed active games', { count: active.length });
  }

  onModuleDestroy() {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    this.generations.clear();
  }

  cancel(sessionId: string) {
    this.clearTimer(sessionId);
    // schedule() ที่ยังค้างอยู่จะเห็นว่ารุ่นไม่ตรงแล้วเลิกเอง
    this.generations.delete(sessionId);
  }

  private clearTimer(sessionId: string) {
    const t = this.timers.get(sessionId);
    if (t) clearTimeout(t);
    this.timers.delete(sessionId);
  }

  /* ─────────── คำสั่ง ─────────── */

  async start(sessionId: string) {
    const now = Date.now();
    const ok = await this.transition(
      sessionId,
      { phase: 'LOBBY', index: 0 },
      {
        status: 'ACTIVE',
        phase: 'QUESTION',
        currentQuestionIndex: 0,
        questionStartedAt: new Date(now + TIMING.START_COUNTDOWN_MS),
        countdownEndsAt: null,
        phaseEndsAt: null,
        startedAt: new Date(now),
      },
    );
    return ok;
  }

  /** host กดข้าม: QUESTION → เฉลยทันที · RESULT → อันดับ · LEADERBOARD → ข้อถัดไป/จบ */
  async advance(sessionId: string, guard: Guard) {
    switch (guard.phase) {
      case 'LOBBY':
        return this.start(sessionId);
      case 'QUESTION':
        return this.closeQuestion(sessionId, guard.index);
      case 'RESULT':
        return this.showLeaderboard(sessionId, guard.index);
      case 'LEADERBOARD':
        return this.nextQuestion(sessionId, guard.index);
      default:
        return false;
    }
  }

  /** ทุกคนตอบครบ → นับถอยหลังปิดรับคำตอบ (ไม่เกินเวลาที่เหลือของข้อ) */
  async armLockCountdown(sessionId: string, index: number) {
    const session = await this.prisma.gameSession.findUnique({ where: { id: sessionId } });
    if (!session || session.phase !== 'QUESTION' || session.currentQuestionIndex !== index) return;
    if (session.countdownEndsAt) return;
    const endsAt = Math.min(Date.now() + TIMING.LOCK_WARNING_MS, this.questionDeadline(session));
    await this.transition(
      sessionId,
      { phase: 'QUESTION', index },
      { countdownEndsAt: new Date(endsAt) },
    );
  }

  /* ─────────── transitions ─────────── */

  private async closeQuestion(sessionId: string, index: number) {
    const now = new Date();
    const changed = await this.prisma.$transaction(async (tx) => {
      // รอคำตอบที่กำลังบันทึกอยู่ให้เสร็จก่อน (submitAnswer ล็อกแถวเดียวกัน)
      await lockSession(tx, sessionId);
      const res = await tx.gameSession.updateMany({
        where: { id: sessionId, phase: 'QUESTION', currentQuestionIndex: index },
        data: {
          phase: 'RESULT',
          phaseEndsAt: new Date(now.getTime() + TIMING.RESULT_MS),
          countdownEndsAt: null,
        },
      });
      if (res.count === 0) return false;

      // ผู้ที่ไม่ได้ตอบ = หมดเวลา (0 คะแนน · ตัดการตอบถูกต่อเนื่อง)
      const session = await tx.gameSession.findUniqueOrThrow({
        where: { id: sessionId },
        include: { players: true, answers: { where: { questionIndex: index } } },
      });
      const question = readSnapshot(session.quizSnapshot).questions[index];
      const answered = new Set(session.answers.map((a) => a.playerId));
      const missing = session.players.filter((p) => !answered.has(p.id));
      if (question && missing.length) {
        const inserted = await tx.gameAnswer.createManyAndReturn({
          data: missing.map((p) => ({
            gameSessionId: sessionId,
            playerId: p.id,
            questionIndex: index,
            questionId: question.id,
            isTimedOut: true,
          })),
          skipDuplicates: true,
          select: { playerId: true },
        });
        // ตัด streak เฉพาะคนที่บันทึก "หมดเวลา" จริง — ไม่ทับคนที่ตอบทันพอดี
        if (inserted.length) {
          await tx.gamePlayer.updateMany({
            where: { id: { in: inserted.map((a) => a.playerId) } },
            data: { streak: 0 },
          });
        }
      }
      return true;
    });
    if (changed) await this.afterChange(sessionId);
    return changed;
  }

  private showLeaderboard(sessionId: string, index: number) {
    const endsAt = new Date(Date.now() + TIMING.LEADERBOARD_MS);
    return this.transition(
      sessionId,
      { phase: 'RESULT', index },
      {
        phase: 'LEADERBOARD',
        phaseEndsAt: endsAt,
        countdownEndsAt: endsAt,
      },
    );
  }

  private async nextQuestion(sessionId: string, index: number) {
    const session = await this.prisma.gameSession.findUnique({ where: { id: sessionId } });
    if (!session) return false;
    const total = readSnapshot(session.quizSnapshot).questions.length;
    const now = new Date();
    if (index + 1 < total) {
      return this.transition(
        sessionId,
        { phase: 'LEADERBOARD', index },
        {
          phase: 'QUESTION',
          currentQuestionIndex: index + 1,
          questionStartedAt: now,
          countdownEndsAt: null,
          phaseEndsAt: null,
        },
      );
    }
    return this.transition(
      sessionId,
      { phase: 'LEADERBOARD', index },
      {
        phase: 'PODIUM',
        status: 'FINISHED',
        finishedAt: now,
        countdownEndsAt: null,
        phaseEndsAt: null,
      },
    );
  }

  private async transition(
    sessionId: string,
    guard: Guard,
    data: Parameters<PrismaService['gameSession']['updateMany']>[0]['data'],
  ) {
    const res = await this.prisma.gameSession.updateMany({
      where: { id: sessionId, phase: guard.phase, currentQuestionIndex: guard.index },
      data,
    });
    if (res.count === 0) return false;
    await this.afterChange(sessionId);
    return true;
  }

  private async afterChange(sessionId: string) {
    this.hub.emit(sessionId);
    await this.schedule(sessionId);
  }

  /* ─────────── ตั้งเวลา ─────────── */

  private questionDeadline(session: {
    questionStartedAt: Date | null;
    quizSnapshot: unknown;
    currentQuestionIndex: number;
  }) {
    const q = readSnapshot(session.quizSnapshot as never).questions[session.currentQuestionIndex];
    const start = session.questionStartedAt?.getTime() ?? Date.now();
    return start + (q?.timeLimit ?? 20) * 1000;
  }

  async schedule(sessionId: string) {
    const generation = ++this.seq;
    this.generations.set(sessionId, generation);
    this.clearTimer(sessionId);
    const current = () => this.generations.get(sessionId) === generation;

    const session = await this.prisma.gameSession.findUnique({ where: { id: sessionId } });
    if (!current()) return; // มี schedule() ที่ใหม่กว่า หรือถูก cancel ระหว่างรอ
    if (!session || session.status !== 'ACTIVE') {
      this.generations.delete(sessionId);
      return;
    }

    const index = session.currentQuestionIndex;
    let due: number | null = null;
    let run: (() => Promise<unknown>) | null = null;

    if (session.phase === 'QUESTION') {
      const deadline = this.questionDeadline(session);
      // countdownEndsAt มีค่าเมื่อทุกคนตอบครบแล้ว — ไม่มีคำตอบค้างระหว่างทาง ปิดตรงเวลาที่ผู้เล่นเห็นได้เลย
      // (เดิมรออีก LATE_GRACE_MS หน้าจอจึงค้างที่ 0 ประมาณครึ่งวินาทีก่อนเฉลย)
      // หมดเวลาตามปกติ → ปิดหลังเวลาที่เห็นเล็กน้อย คำตอบที่ส่งทันแต่มาถึงช้า (เวลาเดินทาง) ยังรับได้
      due = session.countdownEndsAt
        ? Math.min(session.countdownEndsAt.getTime(), deadline + TIMING.LATE_GRACE_MS)
        : deadline + TIMING.LATE_GRACE_MS;
      run = () => this.closeQuestion(sessionId, index);
    } else if (session.phase === 'RESULT') {
      due = session.phaseEndsAt?.getTime() ?? Date.now();
      run = () => this.showLeaderboard(sessionId, index);
    } else if (session.phase === 'LEADERBOARD') {
      due = session.phaseEndsAt?.getTime() ?? Date.now();
      run = () => this.nextQuestion(sessionId, index);
    }
    if (due === null || !run) return;

    const job = run;
    this.clearTimer(sessionId);
    const timer = setTimeout(
      () => {
        if (this.timers.get(sessionId) === timer) this.timers.delete(sessionId);
        if (!current()) return; // timer ของรุ่นเก่าที่หลุดมา
        job().catch((error: unknown) =>
          logApp('error', 'game transition failed', {
            sessionId,
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      },
      Math.max(0, due - Date.now()),
    );
    timer.unref?.();
    this.timers.set(sessionId, timer);
  }
}

/** ล็อกแถวห้องเกมจนจบ transaction — ใช้ทั้งตอนปิดรับคำตอบ ส่งคำตอบ และรับผู้เล่นใหม่ */
export async function lockSession(tx: Prisma.TransactionClient, sessionId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM game_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`;
  return rows.length > 0;
}

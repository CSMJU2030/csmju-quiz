// src/lib/report-store.ts
// รายงานผลเกม — backend สร้างจากคำตอบจริงเมื่อเกมจบ (/api/v1/game-reports)
// หน้าเว็บอ่านอย่างเดียว · ลบรายงาน = ลบห้องเกม (DELETE /api/v1/game-sessions/:id)

import { apiDelete, apiGet, apiList, type PageMeta } from "@/lib/api";
import type { GameReportSummaryView, GameReportView } from "@/lib/api-types";

const PAGE_LIMIT = 100;

export interface GameReportPlayer {
  playerId: string;
  nickname: string;
  avatarIndex: number | null;
  rank: number;
  score: number;
  correct: number;
  incorrect: number;
  timeout: number;
  totalAnswered: number;
  accuracy: number;
  averageResponseMs: number;
  /** เข้าด้วยบัญชี MJU (false = สแกน QR แล้วเล่นโดยไม่ล็อกอิน) */
  withAccount: boolean;
}

export interface GameReportQuestion {
  questionId: string;
  questionNumber: number;
  prompt: string;
  correctOptionId: string | null;
  timeLimit: number;
  totalAnswers: number;
  correctAnswers: number;
  incorrectAnswers: number;
  timeoutAnswers: number;
  correctRate: number;
  answerDistribution: { optionId: string; text: string; count: number }[];
}

export interface GameReportSummary {
  /** id ของรายงาน = id ของห้องเกม */
  id: string;
  sessionId: string;
  quizId: string | null;
  quizTitle: string;
  gamePin: string;
  startedAt: string | null;
  finishedAt: string;
  totalPlayers: number;
  totalQuestions: number;
  averageAccuracy: number;
  topScore: number;
}

export interface GameReport extends GameReportSummary {
  players: GameReportPlayer[];
  questions: GameReportQuestion[];
}

/** ตัวเลือกพิเศษในกราฟการตอบ แทนผู้ที่ไม่ได้ตอบทันเวลา */
export const TIMEOUT_OPTION_ID = "__timeout__";

function toSummary(view: GameReportSummaryView): GameReportSummary {
  return {
    id: view.id,
    sessionId: view.id,
    quizId: view.quizId ?? null,
    quizTitle: view.quizTitle,
    gamePin: view.gamePin,
    startedAt: view.startedAt ?? null,
    finishedAt: view.finishedAt,
    totalPlayers: view.playerCount,
    totalQuestions: view.questionCount,
    averageAccuracy: view.averageAccuracy,
    topScore: view.topScore,
  };
}

function toReport(view: GameReportView): GameReport {
  return {
    ...toSummary(view),
    players: view.players.map((p) => ({
      playerId: p.playerId,
      nickname: p.nickname,
      avatarIndex: p.avatarIndex,
      rank: p.rank,
      score: p.score,
      correct: p.correct,
      incorrect: p.incorrect,
      timeout: p.timeout,
      totalAnswered: p.correct + p.incorrect + p.timeout,
      accuracy: p.accuracy,
      averageResponseMs: p.averageResponseMs,
      withAccount: Boolean(p.coreUserId),
    })),
    questions: view.questions.map((q) => {
      const distribution = q.options.map((o) => ({
        optionId: o.optionId,
        text: o.text,
        count: o.count,
      }));
      if (q.timeoutAnswers > 0) {
        distribution.push({
          optionId: TIMEOUT_OPTION_ID,
          text: "หมดเวลา",
          count: q.timeoutAnswers,
        });
      }
      return {
        questionId: q.questionId,
        questionNumber: q.questionNumber,
        prompt: q.prompt,
        correctOptionId: q.options.find((o) => o.isCorrect)?.optionId ?? null,
        timeLimit: q.timeLimit,
        totalAnswers: q.totalAnswers,
        correctAnswers: q.correctAnswers,
        incorrectAnswers: q.incorrectAnswers,
        timeoutAnswers: q.timeoutAnswers,
        correctRate: q.correctRate,
        answerDistribution: distribution,
      };
    }),
  };
}

/** เกมที่จบแล้วที่ฉันเป็น host (ADMIN เห็นทั้งหมด) — ใหม่สุดก่อน · ส่ง quizId เพื่อกรองชุดเดียว */
export async function listReports(quizId?: string): Promise<GameReportSummary[]> {
  const out: GameReportSummary[] = [];
  const filter = quizId ? `&quizId=${encodeURIComponent(quizId)}` : "";
  for (let page = 1; ; page++) {
    const { data, meta } = await apiList<GameReportSummaryView>(
      `/api/v1/game-reports?page=${page}&limit=${PAGE_LIMIT}${filter}`,
    );
    out.push(...data.map(toSummary));
    if (page >= meta.totalPages || data.length === 0) break;
  }
  return out;
}

/** รายงานทีละหน้า — ค้นหาและเรียงที่ backend (ใหม่สุดก่อน · ui-design-system.md ข้อ 8.2) */
export async function listReportPage(query: {
  page: number;
  limit: number;
  search?: string;
}): Promise<{ data: GameReportSummary[]; meta: PageMeta }> {
  const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit) });
  if (query.search?.trim()) params.set("search", query.search.trim());
  const { data, meta } = await apiList<GameReportSummaryView>(
    `/api/v1/game-reports?${params.toString()}`,
  );
  return { data: data.map(toSummary), meta };
}

/** เกมที่จบล่าสุด (หน้าแรกของรายการ) — ใช้ในหน้าภาพรวมผู้สอน */
export async function listRecentReports(limit = 3): Promise<GameReportSummary[]> {
  const { data } = await apiList<GameReportSummaryView>(
    `/api/v1/game-reports?page=1&limit=${limit}`,
  );
  return data.map(toSummary);
}

/** ไม่พบ (404) → null */
export async function getReportById(sessionId: string): Promise<GameReport | null> {
  try {
    return toReport(await apiGet<GameReportView>(`/api/v1/game-reports/${sessionId}`));
  } catch (err) {
    if ((err as { code?: string })?.code === "NOT_FOUND") return null;
    throw err;
  }
}

/** ลบรายงาน (ลบห้องเกมที่จบแล้วพร้อมผล) */
export async function deleteReport(sessionId: string): Promise<void> {
  await apiDelete(`/api/v1/game-sessions/${sessionId}`);
}

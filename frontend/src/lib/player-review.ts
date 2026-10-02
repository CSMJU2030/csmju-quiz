// src/lib/player-review.ts
// ผลและคำตอบรายข้อของผู้เล่น — อ่านจาก backend เท่านั้น (ไม่เก็บในเบราว์เซอร์ · SEC-02)
//   GET /api/v1/game-histories            เกมที่ฉันเล่นจบแล้วด้วยบัญชี (ใหม่สุดก่อน)
//   GET /api/v1/game-histories/:id        ผลของฉัน + คำตอบรายข้อ
//   GET /api/v1/me/game-stats             สถิติรวม
//   GET /api/v1/game-reports/:id/players/:playerId   ผู้เปิดห้องดูคำตอบของผู้เล่นรายคน
// ผู้เล่นที่สแกน QR แบบไม่ล็อกอินไม่มีบัญชี จึงไม่มีประวัติ — ผลอยู่ในรายงานของผู้เปิดห้องเท่านั้น

import { apiGet, apiList, type PageMeta } from "@/lib/api";
import type {
  AnswerReviewView,
  GameHistorySummaryView,
  PlayerGameReviewView,
  PlayerStatsView,
} from "@/lib/api-types";
import type { Tone } from "@/components/shared/ui";

export type AnswerResult = AnswerReviewView["result"];

export const RESULT_INFO: Record<AnswerResult, { label: string; tone: Tone }> = {
  CORRECT: { label: "ถูกต้อง", tone: "success" },
  INCORRECT: { label: "ไม่ถูกต้อง", tone: "error" },
  TIMEOUT: { label: "หมดเวลา", tone: "warning" },
  NO_ANSWER: { label: "ไม่ได้ตอบ", tone: "neutral" },
};

export const HISTORY_PAGE_SIZE = 10;

export async function listMyGames(
  page = 1,
  limit = HISTORY_PAGE_SIZE,
): Promise<{ data: GameHistorySummaryView[]; meta: PageMeta }> {
  return apiList<GameHistorySummaryView>(`/api/v1/game-histories?page=${page}&limit=${limit}`);
}

export async function getMyStats(): Promise<PlayerStatsView> {
  return apiGet<PlayerStatsView>("/api/v1/me/game-stats");
}

async function orNull<T>(load: Promise<T>): Promise<T | null> {
  try {
    return await load;
  } catch (err) {
    if ((err as { code?: string })?.code === "NOT_FOUND") return null;
    throw err;
  }
}

/** ไม่ได้เล่นเกมนี้ / เกมถูกลบ → null */
export function getMyGame(sessionId: string): Promise<PlayerGameReviewView | null> {
  return orNull(apiGet<PlayerGameReviewView>(`/api/v1/game-histories/${sessionId}`));
}

/** host ของเกม (หรือ ADMIN) ดูผลของผู้เล่นหนึ่งคน · ไม่พบ → null */
export function getPlayerReview(
  sessionId: string,
  playerId: string,
): Promise<PlayerGameReviewView | null> {
  return orNull(
    apiGet<PlayerGameReviewView>(`/api/v1/game-reports/${sessionId}/players/${playerId}`),
  );
}

/** 2.4 วินาที · ไม่ได้ตอบ = "—" */
export function formatResponseTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  const seconds = Math.round(ms / 100) / 10;
  return `${seconds.toLocaleString("th-TH", { maximumFractionDigits: 1 })} วินาที`;
}

/** ข้อที่ควรทบทวน = ตอบผิด หมดเวลา หรือไม่ได้ตอบ */
export function questionsToReview(answers: AnswerReviewView[]): AnswerReviewView[] {
  return answers.filter((a) => a.result !== "CORRECT");
}

/** อันดับ 3 / 12 คน */
export function formatRank(rank: number, playerCount: number): string {
  return `อันดับ ${rank.toLocaleString("th-TH")} จาก ${playerCount.toLocaleString("th-TH")} คน`;
}

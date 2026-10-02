// ผลของผู้เล่นหนึ่งคนในเกมที่จบแล้ว + ทบทวนคำตอบรายข้อ — ฟังก์ชันล้วน (ไม่แตะ DB) ใช้ร่วมกัน 2 ที่
//   · รายงานของผู้เปิดห้อง: /api/v1/game-reports/:id/players/:playerId
//   · ประวัติของผู้เล่นที่เข้าด้วยบัญชี MJU: /api/v1/game-histories และ /api/v1/me/game-stats
//     (ผู้เล่นที่สแกน QR แบบไม่ล็อกอินไม่มีตัวตน จึงไม่มีประวัติ)
// คำนวณจากสำเนาแบบทดสอบในเกม (quiz_snapshot) และคำตอบที่ server บันทึกไว้เท่านั้น
import { type AwardKind, computeAwards, computePlayerStats } from '../game/podium';
import { rankPlayers } from '../game/scoring';
import { readSnapshot } from '../game/snapshot';
import type { Prisma } from '../generated/prisma/client';

export const ANSWER_RESULTS = ['CORRECT', 'INCORRECT', 'TIMEOUT', 'NO_ANSWER'] as const;
export type AnswerResult = (typeof ANSWER_RESULTS)[number];

export interface ReviewSession {
  id: string;
  quizTitle: string;
  quizSnapshot: Prisma.JsonValue;
  startedAt: Date | null;
  finishedAt: Date | null;
  updatedAt: Date;
  players: {
    id: string;
    coreUserId: string | null;
    nickname: string;
    avatarIndex: number;
    score: number;
    createdAt: Date;
  }[];
  answers: {
    playerId: string;
    questionIndex: number;
    optionId: string | null;
    isCorrect: boolean;
    isTimedOut: boolean;
    points: number;
    responseMs: number;
  }[];
}

export interface PlayerGameResult {
  id: string;
  quizTitle: string;
  startedAt: Date | null;
  finishedAt: Date;
  playerId: string;
  nickname: string;
  avatarIndex: number;
  rank: number;
  playerCount: number;
  score: number;
  questionCount: number;
  correct: number;
  incorrect: number;
  timeout: number;
  /** 0–100 ทศนิยม 2 ตำแหน่ง (ตอบถูก ÷ จำนวนข้อทั้งหมด) — สูตรเดียวกับรายงาน */
  accuracy: number;
  awards: AwardKind[];
  maxStreak: number;
  /** เวลาตอบเฉลี่ยของข้อที่ตอบ (มิลลิวินาที) */
  averageResponseMs: number;
}

export interface AnswerReview {
  questionNumber: number;
  questionId: string;
  type: string;
  prompt: string;
  imageUrl: string | null;
  timeLimit: number;
  points: number;
  options: { optionId: string; text: string; isCorrect: boolean }[];
  selectedOptionId: string | null;
  result: AnswerResult;
  earnedPoints: number;
  /** null = ไม่ได้ตอบ (หมดเวลา / เข้าห้องหลังข้อนี้) */
  responseMs: number | null;
}

export interface PlayerGameReview extends PlayerGameResult {
  answers: AnswerReview[];
}

export const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 10000) / 100 : 0);

/** ผลของผู้เล่น `playerId` ในเกมนี้ · ไม่พบผู้เล่น → null */
export function buildPlayerReview(s: ReviewSession, playerId: string): PlayerGameReview | null {
  const player = s.players.find((p) => p.id === playerId);
  if (!player) return null;

  const snapshot = readSnapshot(s.quizSnapshot);
  const total = snapshot.questions.length;
  const ranked = rankPlayers(s.players.map((p) => ({ ...p, joinedAt: p.createdAt.getTime() })));
  const rank = ranked.find((p) => p.id === playerId)?.rank ?? ranked.length;

  const stats = computePlayerStats(
    s.players.map((p) => p.id),
    s.answers,
    total,
  );
  const awards = computeAwards(stats, new Map(s.players.map((p) => [p.id, p.score])), total)
    .filter((a) => a.playerId === playerId)
    .map((a) => a.kind);

  const mine = s.answers.filter((a) => a.playerId === playerId);
  const answers: AnswerReview[] = snapshot.questions.map((q, index) => {
    const a = mine.find((x) => x.questionIndex === index);
    const result: AnswerResult = !a
      ? 'NO_ANSWER'
      : a.isTimedOut
        ? 'TIMEOUT'
        : a.isCorrect
          ? 'CORRECT'
          : 'INCORRECT';
    return {
      questionNumber: index + 1,
      questionId: q.id,
      type: q.type,
      prompt: q.prompt,
      imageUrl: q.imageUrl ?? null,
      timeLimit: q.timeLimit,
      points: q.points,
      options: q.options.map((o) => ({ optionId: o.id, text: o.text, isCorrect: o.isCorrect })),
      selectedOptionId: a && !a.isTimedOut ? a.optionId : null,
      result,
      earnedPoints: a?.points ?? 0,
      responseMs: a && !a.isTimedOut ? a.responseMs : null,
    };
  });

  const correct = answers.filter((a) => a.result === 'CORRECT').length;
  const incorrect = answers.filter((a) => a.result === 'INCORRECT').length;
  const answered = answers.filter((a) => a.responseMs !== null);

  return {
    id: s.id,
    quizTitle: s.quizTitle,
    startedAt: s.startedAt,
    finishedAt: s.finishedAt ?? s.updatedAt,
    playerId: player.id,
    nickname: player.nickname,
    avatarIndex: player.avatarIndex,
    rank,
    playerCount: s.players.length,
    score: player.score,
    questionCount: total,
    correct,
    incorrect,
    timeout: total - correct - incorrect,
    accuracy: pct(correct, total),
    awards,
    maxStreak: stats.get(playerId)?.maxStreak ?? 0,
    averageResponseMs: answered.length
      ? Math.round(answered.reduce((sum, a) => sum + (a.responseMs ?? 0), 0) / answered.length)
      : 0,
    answers,
  };
}

export interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  podiumFinishes: number;
  bestRank: number | null;
  bestScore: number;
  totalScore: number;
  averageAccuracy: number;
  totalCorrect: number;
  totalQuestions: number;
  bestStreak: number;
  awardsEarned: number;
  lastPlayedAt: Date | null;
}

/** สรุปสถิติจากผลทุกเกมของผู้เล่นคนเดียว */
export function summarizeStats(results: PlayerGameResult[]): PlayerStats {
  const n = results.length;
  return {
    gamesPlayed: n,
    wins: results.filter((r) => r.rank === 1).length,
    podiumFinishes: results.filter((r) => r.rank <= 3).length,
    bestRank: n ? Math.min(...results.map((r) => r.rank)) : null,
    bestScore: results.reduce((max, r) => Math.max(max, r.score), 0),
    totalScore: results.reduce((sum, r) => sum + r.score, 0),
    averageAccuracy: n
      ? Math.round((results.reduce((sum, r) => sum + r.accuracy, 0) / n) * 100) / 100
      : 0,
    totalCorrect: results.reduce((sum, r) => sum + r.correct, 0),
    totalQuestions: results.reduce((sum, r) => sum + r.questionCount, 0),
    bestStreak: results.reduce((max, r) => Math.max(max, r.maxStreak), 0),
    awardsEarned: results.reduce((sum, r) => sum + r.awards.length, 0),
    lastPlayedAt: n ? new Date(Math.max(...results.map((r) => r.finishedAt.getTime()))) : null,
  };
}

// สำเนาแบบทดสอบ ณ ตอนเปิดห้อง — เกมและรายงานอ่านจากสำเนานี้เท่านั้น
import { randomInt } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client';
import { displayImageUrl } from '../images/image-url';

export interface SnapshotOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface SnapshotQuestion {
  id: string;
  type: string;
  prompt: string;
  imageUrl: string | null;
  timeLimit: number;
  points: number;
  options: SnapshotOption[];
}

export interface QuizSnapshot {
  quizId: string;
  title: string;
  questions: SnapshotQuestion[];
}

export interface GameSettings {
  /** null = ใช้เวลาที่ตั้งในแต่ละข้อ */
  timeLimitOverride: number | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
}

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildSnapshot(
  quiz: {
    id: string;
    title: string;
    questions: {
      id: string;
      type: string;
      prompt: string;
      imageUrl: string | null;
      imageId?: string | null;
      timeLimit: number;
      points: number;
      options: SnapshotOption[];
    }[];
  },
  settings: GameSettings,
): QuizSnapshot {
  let questions: SnapshotQuestion[] = quiz.questions.map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    // เก็บ URL ที่ใช้แสดงไว้ในสำเนา — เกมและรายงานไม่ต้องรู้ว่ารูปมาจากไหน
    imageUrl: displayImageUrl(q),
    timeLimit: settings.timeLimitOverride ?? q.timeLimit,
    points: q.points,
    options: q.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
  }));
  if (settings.shuffleQuestions) questions = shuffle(questions);
  // ถูก/ผิด คงลำดับ "ถูก, ผิด" ไว้เสมอ แม้เลือกสุ่มตัวเลือก
  if (settings.shuffleOptions) {
    questions = questions.map((q) =>
      q.type === 'TRUE_FALSE' ? q : { ...q, options: shuffle(q.options) },
    );
  }
  return { quizId: quiz.id, title: quiz.title, questions };
}

export function readSnapshot(value: Prisma.JsonValue): QuizSnapshot {
  const v = (value ?? {}) as unknown as Partial<QuizSnapshot>;
  return {
    quizId: String(v.quizId ?? ''),
    title: String(v.title ?? ''),
    questions: Array.isArray(v.questions) ? v.questions : [],
  };
}

export function readSettings(value: Prisma.JsonValue): GameSettings {
  const v = (value ?? {}) as Partial<GameSettings>;
  return {
    timeLimitOverride: typeof v.timeLimitOverride === 'number' ? v.timeLimitOverride : null,
    shuffleQuestions: v.shuffleQuestions === true,
    shuffleOptions: v.shuffleOptions === true,
  };
}

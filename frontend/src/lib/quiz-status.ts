// src/lib/quiz-status.ts
// สถานะแบบทดสอบและสรุปตัวเลข — ใช้ร่วมกันทุกหน้า เพื่อให้ป้ายและตัวเลขตรงกัน

import type { Tone } from "@/components/shared/ui";
import { isComplete } from "@/lib/question-model";
import type { Quiz, QuizStatus } from "@/types/quiz";

export const QUIZ_STATUS: Record<QuizStatus, { label: string; tone: Tone; hint: string }> = {
  DRAFT: {
    label: "แบบร่าง",
    tone: "warning",
    hint: "ยังเปิดห้องเล่นเกมไม่ได้ เผยแพร่เมื่อคำถามครบทุกข้อ",
  },
  PUBLISHED: {
    label: "เผยแพร่แล้ว",
    tone: "success",
    hint: "พร้อมเปิดห้องเล่นเกม",
  },
  ARCHIVED: {
    label: "เก็บถาวร",
    tone: "neutral",
    hint: "ซ่อนจากรายการหลักและเปิดห้องเล่นเกมไม่ได้ กู้คืนเป็นแบบร่างได้",
  },
};

/** ผลของการลบแบบทดสอบ — ใช้ข้อความเดียวกันทุกหน้า (ui-design-system.md ข้อ 8.3) */
export const QUIZ_DELETE_CONSEQUENCE =
  "จะถูกลบถาวรพร้อมคำถามทั้งหมดในชุดนี้ และกู้คืนไม่ได้ (คำถามในคลังและรายงานเกมที่เล่นแล้วยังอยู่)";

export function quizStatus(quiz: Pick<Quiz, "status">) {
  return QUIZ_STATUS[quiz.status] ?? QUIZ_STATUS.DRAFT;
}

/** เวลาแสดงเฉลย/อันดับ/นับถอยหลังต่อข้อโดยประมาณ (วินาที) */
export const OVERHEAD_PER_QUESTION_SEC = 12;

/** เวลาเล่นโดยประมาณ (นาที) จากจำนวนข้อและเวลาตอบรวม */
export function estimateMinutes(count: number, answerSeconds: number) {
  return Math.max(1, Math.ceil((answerSeconds + count * OVERHEAD_PER_QUESTION_SEC) / 60));
}

export function quizSummary(quiz: Quiz) {
  const questions = quiz.questions ?? [];
  const answerSeconds = questions.reduce((s, q) => s + (q.timeLimit || 0), 0);
  return {
    count: questions.length,
    incomplete: questions.filter((q) => !isComplete(q)).length,
    answerSeconds,
    estimatedMinutes: estimateMinutes(questions.length, answerSeconds),
    maxBasePoints: questions.reduce((s, q) => s + (q.points || 0), 0),
  };
}

export function canPublish(quiz: Quiz) {
  const s = quizSummary(quiz);
  return Boolean(quiz.title?.trim()) && s.count > 0 && s.incomplete === 0;
}

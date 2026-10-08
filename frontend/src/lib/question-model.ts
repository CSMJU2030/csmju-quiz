// src/lib/question-model.ts
// โมเดลคำถามกลาง — ใช้ร่วมกันทั้งหน้าแก้ไขแบบทดสอบ คลังคำถาม พรีวิว และเกม
// ทุกที่สร้าง/ตรวจ/แปลงคำถามผ่านไฟล์นี้ เพื่อให้กติกาตรงกันทั้งระบบ

import { newId } from "@/lib/utils";
import type {
  Difficulty,
  Question,
  QuestionOption,
  QuestionType,
  SupportedQuestionType,
} from "@/types/quiz";

export const QUESTION_TYPES: {
  value: SupportedQuestionType;
  label: string;
  description: string;
}[] = [
  {
    value: "MULTIPLE_CHOICE",
    label: "ปรนัย",
    description: "2–4 ตัวเลือก มีคำตอบถูก 1 ข้อ",
  },
  {
    value: "TRUE_FALSE",
    label: "ถูก / ผิด",
    description: "ให้ผู้เล่นเลือกว่าข้อความถูกหรือผิด",
  },
];

export const MIN_OPTIONS = 2;
/** หน้าเกมมีสีและรูปทรงประจำตัวเลือก 4 ชุด (components/game/answer-colors.ts) */
export const MAX_OPTIONS = 4;
export const MAX_PROMPT = 300;
export const MAX_OPTION_TEXT = 120;

export const TIME_LIMIT_CHOICES = [5, 10, 20, 30, 45, 60, 90, 120];
export const POINT_CHOICES = [
  { value: 0, label: "ไม่คิดคะแนน" },
  { value: 1000, label: "ปกติ (1,000)" },
  { value: 2000, label: "สองเท่า (2,000)" },
];
export const DEFAULT_TIME_LIMIT = 20;
export const DEFAULT_POINTS = 1000;

export const DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD"];
export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  EASY: "ง่าย",
  MEDIUM: "ปานกลาง",
  HARD: "ยาก",
};

/** เนื้อหาคำถามที่ใช้ร่วมกันระหว่างแบบทดสอบและคลัง */
export interface QuestionContent {
  type: QuestionType;
  prompt: string;
  options: QuestionOption[];
  timeLimit: number;
  points: number;
  image?: string;
  /** id ของรูปที่อัปโหลด (ดู Question.imageId) */
  imageId?: string;
  tags?: string[];
  difficulty?: Difficulty;
}

export function isSupportedType(type: QuestionType): type is SupportedQuestionType {
  return type === "MULTIPLE_CHOICE" || type === "TRUE_FALSE";
}

function trueFalseOptions(correct: "TRUE" | "FALSE" = "TRUE"): QuestionOption[] {
  return [
    { id: newId(), text: "ถูก", isCorrect: correct === "TRUE" },
    { id: newId(), text: "ผิด", isCorrect: correct === "FALSE" },
  ];
}

export function blankOptions(type: SupportedQuestionType): QuestionOption[] {
  if (type === "TRUE_FALSE") return trueFalseOptions();
  return Array.from({ length: MAX_OPTIONS }, (_, i) => ({
    id: newId(),
    text: "",
    isCorrect: i === 0,
  }));
}

export function blankContent(type: SupportedQuestionType = "MULTIPLE_CHOICE"): QuestionContent {
  return {
    type,
    prompt: "",
    options: blankOptions(type),
    timeLimit: DEFAULT_TIME_LIMIT,
    points: DEFAULT_POINTS,
    tags: [],
    difficulty: "MEDIUM",
  };
}

export function createQuestion(
  quizId: string,
  order: number,
  type: SupportedQuestionType = "MULTIPLE_CHOICE",
): Question {
  return { id: newId(), quizId, order, ...blankContent(type) };
}

/** เปลี่ยนประเภทโดยเก็บโจทย์ เวลา คะแนน และแท็กไว้ */
export function changeType<T extends QuestionContent>(content: T, type: SupportedQuestionType): T {
  if (content.type === type) return content;
  if (type === "TRUE_FALSE") {
    return { ...content, type, options: trueFalseOptions() };
  }
  return { ...content, type, options: blankOptions("MULTIPLE_CHOICE") };
}

export interface QuestionIssues {
  prompt?: string;
  options?: string;
  correct?: string;
  type?: string;
  image?: string;
}

/** รับเฉพาะลิงก์ https เพื่อความปลอดภัย (ไม่รับ data:, javascript:, http:) */
export function isValidImageUrl(url: string) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/** ตรวจความครบของคำถาม — ข้อความเป็นภาษาไทยพร้อมแสดงผล */
export function validateQuestion(content: QuestionContent): QuestionIssues {
  const issues: QuestionIssues = {};
  const options = Array.isArray(content.options) ? content.options : [];

  if (!isSupportedType(content.type)) {
    issues.type = "ประเภทคำถามนี้ยังเล่นในเกมไม่ได้ กรุณาเปลี่ยนเป็นปรนัยหรือถูก/ผิด";
  }
  if (!content.prompt.trim()) {
    issues.prompt = "กรุณากรอกโจทย์คำถาม";
  } else if (content.prompt.trim().length > MAX_PROMPT) {
    issues.prompt = `โจทย์ต้องไม่เกิน ${MAX_PROMPT} ตัวอักษร`;
  }
  if (content.type === "MULTIPLE_CHOICE") {
    if (options.length < MIN_OPTIONS) {
      issues.options = `ต้องมีตัวเลือกอย่างน้อย ${MIN_OPTIONS} ตัวเลือก`;
    } else if (options.some((o) => !o.text.trim())) {
      issues.options = "กรุณากรอกตัวเลือกให้ครบ หรือลบตัวเลือกที่ไม่ใช้";
    } else {
      const texts = options.map((o) => o.text.trim().toLowerCase());
      if (new Set(texts).size !== texts.length) issues.options = "มีตัวเลือกที่ซ้ำกัน";
    }
  }
  if (!content.imageId && content.image?.trim() && !isValidImageUrl(content.image.trim())) {
    issues.image = "ลิงก์รูปภาพต้องขึ้นต้นด้วย https://";
  }
  if (options.filter((o) => o.isCorrect).length !== 1) {
    issues.correct = "กรุณาเลือกคำตอบที่ถูก 1 ข้อ";
  }
  return issues;
}

export function issueList(content: QuestionContent): string[] {
  return Object.values(validateQuestion(content)).filter(Boolean) as string[];
}

export function isComplete(content: QuestionContent): boolean {
  return issueList(content).length === 0;
}

/** ตัดช่องว่างก่อนบันทึก */
export function normalizeContent<T extends QuestionContent>(content: T): T {
  return {
    ...content,
    prompt: content.prompt.trim(),
    image: content.image?.trim() || undefined,
    imageId: content.image?.trim() ? content.imageId : undefined,
    options: content.options.map((o) => ({ ...o, text: o.text.trim() })),
    tags: (content.tags ?? []).map((t) => t.trim()).filter(Boolean),
  };
}

/** คัดลอกเนื้อหา (สร้าง id ใหม่ทั้งหมด) */
export function cloneContent(content: QuestionContent): QuestionContent {
  return {
    type: content.type,
    prompt: content.prompt,
    options: content.options.map((o) => ({ ...o, id: newId() })),
    timeLimit: content.timeLimit,
    points: content.points,
    image: content.image,
    imageId: content.imageId,
    tags: [...(content.tags ?? [])],
    difficulty: content.difficulty,
  };
}

export function formatTimeLimit(seconds: number) {
  return seconds >= 60 && seconds % 60 === 0 ? `${seconds / 60} นาที` : `${seconds} วินาที`;
}

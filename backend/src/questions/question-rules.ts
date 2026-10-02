// กติกาคำถามกลาง — ตรงกับ frontend/src/lib/question-model.ts
// แบบร่างบันทึกได้แม้ยังไม่ครบ · แต่เผยแพร่ / เก็บเข้าคลัง / เปิดเกม ต้องครบทุกข้อ

export const QUESTION_TYPES = ['MULTIPLE_CHOICE', 'TRUE_FALSE'] as const;
export type QuestionTypeName = (typeof QUESTION_TYPES)[number];

export const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;

export const MIN_OPTIONS = 2;
/** หน้าเกมมีสีและรูปทรงประจำตัวเลือก 4 ชุด */
export const MAX_OPTIONS = 4;
export const MAX_PROMPT = 300;
export const MAX_OPTION_TEXT = 120;
export const MIN_TIME_LIMIT = 5;
export const MAX_TIME_LIMIT = 300;
export const MAX_POINTS = 5000;
export const MAX_QUESTIONS_PER_QUIZ = 100;
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;

export interface OptionLike {
  text: string;
  isCorrect: boolean;
}

export interface QuestionLike {
  type: string;
  prompt: string;
  imageUrl?: string | null;
  options: OptionLike[];
}

export function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/** รายการปัญหาของคำถาม (ภาษาอังกฤษสำหรับ API · หน้าเว็บแปลเอง) — ว่าง = ครบ */
export function questionIssues(q: QuestionLike): string[] {
  const issues: string[] = [];
  const options = q.options ?? [];

  if (!(QUESTION_TYPES as readonly string[]).includes(q.type)) issues.push('type is not supported');
  if (!q.prompt?.trim()) issues.push('prompt is required');

  if (q.type === 'TRUE_FALSE' && options.length !== 2) {
    issues.push('TRUE_FALSE must have exactly 2 options');
  }
  if (q.type === 'MULTIPLE_CHOICE') {
    if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
      issues.push(`MULTIPLE_CHOICE must have ${MIN_OPTIONS}-${MAX_OPTIONS} options`);
    }
    if (options.some((o) => !o.text?.trim())) issues.push('every option must have text');
    const texts = options.map((o) => o.text.trim().toLowerCase()).filter(Boolean);
    if (new Set(texts).size !== texts.length) issues.push('options must not repeat');
  }
  if (options.filter((o) => o.isCorrect).length !== 1) {
    issues.push('exactly one option must be correct');
  }
  if (q.imageUrl && !isHttpsUrl(q.imageUrl)) issues.push('imageUrl must start with https://');
  return issues;
}

export function isComplete(q: QuestionLike) {
  return questionIssues(q).length === 0;
}

/** ถูก/ผิด ใช้ข้อความคงที่ */
export const TRUE_FALSE_TEXTS = ['ถูก', 'ผิด'] as const;

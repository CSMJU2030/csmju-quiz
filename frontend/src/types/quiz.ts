export type QuizStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type QuestionType =
  "MULTIPLE_CHOICE" | "TRUE_FALSE" | "TYPE_ANSWER" | "PUZZLE" | "POLL" | "WORD_CLOUD";

/** ประเภทที่สร้าง พรีวิว และเล่นในเกมได้จริง — ประเภทอื่นสงวนไว้สำหรับอนาคต */
export type SupportedQuestionType = Extract<QuestionType, "MULTIPLE_CHOICE" | "TRUE_FALSE">;

export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  quizId: string;
  order: number;
  type: QuestionType;
  prompt: string;
  timeLimit: number;
  points: number;
  options: QuestionOption[];
  /** ภาพประกอบคำถาม (URL สำหรับแสดง) */
  image?: string;
  /** id ของรูปที่อัปโหลดผ่าน Core Hub — มีค่า = image เป็นไฟล์ของ Core Hub (ไม่ใช่ลิงก์ที่วางเอง) */
  imageId?: string;
  tags?: string[];
  difficulty?: Difficulty;
  /** id ของคำถามในคลังที่คัดลอกมา (ถ้ามี) — ใช้แสดงที่มา ไม่ได้ผูกข้อมูลกัน */
  sourceBankItemId?: string;
}

export interface Quiz {
  id: string;
  ownerCoreUserId: string;
  title: string;
  description: string;
  status: QuizStatus;
  version: number;
  questions: Question[];
  createdAt: string;
  updatedAt: string;
}

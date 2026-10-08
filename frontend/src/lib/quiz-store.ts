// src/lib/quiz-store.ts
// แบบทดสอบ — อ่าน/เขียนผ่าน backend เท่านั้น (GET/POST/PATCH/DELETE /api/v1/quizzes)
// หน้าเว็บใช้ type Quiz ของตัวเอง (types/quiz.ts) ไฟล์นี้แปลงไป-กลับกับ type ที่ generate จาก openapi.json

"use client";

import { apiDelete, apiGet, apiList, apiPatch, apiPost } from "@/lib/api";
import type { PageMeta } from "@/lib/api";
import type { QuestionInputBody, QuestionView, QuizSummaryView, QuizView } from "@/lib/api-types";
import { newId } from "@/lib/utils";
import type { Question, Quiz, QuizStatus } from "@/types/quiz";

const PAGE_LIMIT = 100;
/** จำนวนคำขอพร้อมกันตอนโหลดรายละเอียดแบบทดสอบหลายชุด */
const CONCURRENCY = 6;

export function toQuestion(view: QuestionView): Question {
  return {
    id: view.id,
    quizId: view.quizId,
    order: view.order,
    type: view.type,
    prompt: view.prompt,
    timeLimit: view.timeLimit,
    points: view.points,
    options: view.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
    image: view.imageUrl ?? undefined,
    imageId: view.imageId ?? undefined,
    tags: view.tags,
    difficulty: view.difficulty,
    sourceBankItemId: view.sourceBankItemId ?? undefined,
  };
}

export function toQuiz(view: QuizView): Quiz {
  return {
    id: view.id,
    ownerCoreUserId: view.ownerCoreUserId,
    title: view.title,
    description: view.description,
    status: view.status,
    version: view.version,
    questions: [...view.questions].sort((a, b) => a.order - b.order).map(toQuestion),
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
  };
}

/** รูปที่อัปโหลดส่งเป็น imageId · ลิงก์ที่วางเองส่งเป็น imageUrl */
export function imageBody(q: { image?: string; imageId?: string }) {
  const url = q.image?.trim() || null;
  return q.imageId && url
    ? { imageId: q.imageId, imageUrl: null }
    : { imageId: null, imageUrl: url };
}

/** คำถามที่ส่งให้ backend — ส่งเฉพาะประเภทที่ backend รองรับ (ปรนัย · ถูก/ผิด) */
export function toQuestionInput(q: Question): QuestionInputBody {
  return {
    id: q.id || undefined,
    type: q.type === "TRUE_FALSE" ? "TRUE_FALSE" : "MULTIPLE_CHOICE",
    prompt: q.prompt,
    ...imageBody(q),
    timeLimit: q.timeLimit,
    points: q.points,
    tags: q.tags ?? [],
    difficulty: q.difficulty ?? "MEDIUM",
    sourceBankItemId: q.sourceBankItemId || null,
    options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
  };
}

/** แบบร่างใหม่ในหน้าเว็บ (ยังไม่อยู่ใน backend — id ว่างจนกว่าจะบันทึก) */
export function createDraftQuiz(): Quiz {
  const now = new Date().toISOString();
  return {
    id: "",
    title: "",
    description: "",
    status: "DRAFT",
    version: 1,
    questions: [],
    ownerCoreUserId: "",
    createdAt: now,
    updatedAt: now,
  };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/** แบบทดสอบของฉันทั้งหมด พร้อมคำถาม (ADMIN เห็นทุกชุด) */
export async function listQuizzes(): Promise<Quiz[]> {
  const ids: string[] = [];
  for (let page = 1; ; page++) {
    const { data, meta } = await apiList<{ id: string }>(
      `/api/v1/quizzes?page=${page}&limit=${PAGE_LIMIT}`,
    );
    ids.push(...data.map((q) => q.id));
    if (page >= meta.totalPages || data.length === 0) break;
  }
  const quizzes = await mapLimit(ids, CONCURRENCY, (id) =>
    apiGet<QuizView>(`/api/v1/quizzes/${id}`),
  );
  return quizzes.map(toQuiz);
}

export const getAllQuizzes = listQuizzes;

export type QuizListItem = QuizSummaryView;
export type QuizListStatus = "ACTIVE" | "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type QuizListSort = "updatedAt" | "title" | "createdAt" | "questionCount";

/** รายการแบบทดสอบทีละหน้า — กรอง ค้นหา และเรียงที่ backend (ui-design-system.md ข้อ 8.2) */
export async function listQuizPage(query: {
  page: number;
  limit: number;
  status?: QuizListStatus;
  search?: string;
  sort?: QuizListSort;
}): Promise<{ data: QuizListItem[]; meta: PageMeta }> {
  const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit) });
  if (query.status) params.set("status", query.status);
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.sort) params.set("sort", query.sort);
  return apiList<QuizListItem>(`/api/v1/quizzes?${params.toString()}`);
}

/** จำนวนแบบทดสอบตามสถานะ (ใช้แค่ meta.total) */
export async function countQuizzes(status: QuizListStatus): Promise<number> {
  const { meta } = await apiList<QuizListItem>(`/api/v1/quizzes?page=1&limit=1&status=${status}`);
  return meta.total;
}

/** ไม่พบ (404) → null · ข้อผิดพลาดอื่นส่งต่อให้หน้าจอแสดง */
export async function getQuizById(id: string): Promise<Quiz | null> {
  if (!id) return null;
  try {
    return toQuiz(await apiGet<QuizView>(`/api/v1/quizzes/${encodeURIComponent(id)}`));
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

/**
 * บันทึกแบบทดสอบ — ยังไม่มี id = สร้างใหม่ (POST) แล้วบันทึกคำถาม/สถานะ (PATCH)
 * backend แทนที่ชุดคำถามทั้งชุดตามลำดับที่ส่ง และตรวจความครบตอนเผยแพร่ (ไม่ครบ → 409)
 */
export async function saveQuiz(input: Quiz): Promise<Quiz> {
  let id = input.id;
  if (!id) {
    const created = await apiPost<QuizView>("/api/v1/quizzes", {
      title: input.title,
      description: input.description,
    });
    id = created.id;
    if (input.questions.length === 0 && input.status === "DRAFT") return toQuiz(created);
  }
  const saved = await apiPatch<QuizView>(`/api/v1/quizzes/${id}`, {
    title: input.title,
    description: input.description,
    status: input.status,
    questions: [...input.questions].sort((a, b) => a.order - b.order).map(toQuestionInput),
  });
  return toQuiz(saved);
}

/** เปลี่ยนสถานะอย่างเดียว (ไม่ส่งชุดคำถาม) — ใช้กับปุ่มบนการ์ดในหน้ารายการ */
export async function setQuizStatus(id: string, status: QuizStatus): Promise<void> {
  await apiPatch<QuizView>(`/api/v1/quizzes/${encodeURIComponent(id)}`, { status });
}

export async function deleteQuiz(id: string): Promise<void> {
  await apiDelete(`/api/v1/quizzes/${id}`);
}

/** ทำสำเนาเป็นแบบร่างใหม่ของผู้ใช้ปัจจุบัน */
export async function duplicateQuiz(id: string): Promise<Quiz | null> {
  try {
    return toQuiz(await apiPost<QuizView>(`/api/v1/quizzes/${id}/copies`, {}));
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

/** คัดลอกคำถามในหน้าแก้ไข (id ใหม่ทั้งหมด) */
export function duplicateQuestion(question: Question, newOrder: number): Question {
  return {
    ...question,
    id: newId(),
    order: newOrder,
    options: question.options.map((option) => ({ ...option, id: newId() })),
  };
}

function isNotFound(err: unknown) {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "NOT_FOUND"
  );
}

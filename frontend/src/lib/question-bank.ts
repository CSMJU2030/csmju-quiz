// src/lib/question-bank.ts
// คลังคำถามของผู้ใช้ — เก็บที่ backend (/api/v1/bank-items)
// การนำไปใช้เป็นการ "คัดลอก" เข้าแบบทดสอบ (แก้ในแบบทดสอบไม่กระทบคลัง และกลับกัน)
// จำนวนครั้งที่ใช้ (usedCount) backend นับให้เองตอนบันทึกแบบทดสอบที่มี sourceBankItemId

import { apiDelete, apiGet, apiList, apiPatch, apiPost, type PageMeta } from "@/lib/api";
import type { BankItemView, CreateBankItemBody } from "@/lib/api-types";
import {
  blankContent,
  cloneContent,
  isComplete,
  isSupportedType,
  normalizeContent,
  type QuestionContent,
} from "@/lib/question-model";
import { getAllQuizzes, imageBody } from "@/lib/quiz-store";
import { newId } from "@/lib/utils";
import type { Difficulty, Question } from "@/types/quiz";

export { DIFFICULTY_LABEL } from "@/lib/question-model";
export type { Difficulty } from "@/types/quiz";

const PAGE_LIMIT = 100;

export interface BankItem extends QuestionContent {
  /** ว่าง = ยังไม่ได้บันทึก */
  id: string;
  tags: string[];
  difficulty: Difficulty;
  /** จำนวนครั้งที่ถูกคัดลอกไปใช้ในแบบทดสอบ */
  usedCount: number;
  createdAt: string;
  updatedAt?: string;
}

function toBankItem(view: BankItemView): BankItem {
  return {
    id: view.id,
    type: view.type,
    prompt: view.prompt,
    options: view.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
    timeLimit: view.timeLimit,
    points: view.points,
    image: view.imageUrl ?? undefined,
    imageId: view.imageId ?? undefined,
    tags: view.tags,
    difficulty: view.difficulty as Difficulty,
    usedCount: view.usedCount,
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
  };
}

function toBody(content: QuestionContent): CreateBankItemBody {
  const clean = normalizeContent(content);
  return {
    type: clean.type === "TRUE_FALSE" ? "TRUE_FALSE" : "MULTIPLE_CHOICE",
    prompt: clean.prompt,
    ...imageBody(clean),
    timeLimit: clean.timeLimit,
    points: clean.points,
    tags: clean.tags ?? [],
    difficulty: clean.difficulty ?? "MEDIUM",
    options: clean.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
  };
}

/** คำถามทั้งหมดในคลังของฉัน */
export async function getBankItems(): Promise<BankItem[]> {
  const items: BankItem[] = [];
  for (let page = 1; ; page++) {
    const { data, meta } = await apiList<BankItemView>(
      `/api/v1/bank-items?page=${page}&limit=${PAGE_LIMIT}`,
    );
    items.push(...data.map(toBankItem));
    if (page >= meta.totalPages || data.length === 0) break;
  }
  return items;
}

export interface BankItemQuery {
  page: number;
  limit: number;
  search?: string;
  /** ตรงทั้งคำ (backend กรองด้วย tags has) */
  tag?: string;
  difficulty?: Difficulty | "";
}

/** query string ของ GET /api/v1/bank-items — ส่งเฉพาะตัวกรองที่มีค่า */
export function bankItemQueryString(query: BankItemQuery): string {
  const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit) });
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.tag?.trim()) params.set("tag", query.tag.trim());
  if (query.difficulty) params.set("difficulty", query.difficulty);
  return params.toString();
}

/** คำถามในคลังทีละหน้า — ค้นหา กรองแท็ก/ระดับความยาก และแบ่งหน้าที่ backend (ui-design-system.md ข้อ 8.2) */
export async function listBankItemPage(
  query: BankItemQuery,
): Promise<{ data: BankItem[]; meta: PageMeta }> {
  const { data, meta } = await apiList<BankItemView>(
    `/api/v1/bank-items?${bankItemQueryString(query)}`,
  );
  return { data: data.map(toBankItem), meta };
}

/** จำนวนคำถามในคลัง (ใช้แค่ meta.total) */
export async function countBankItems(): Promise<number> {
  const { meta } = await apiList<BankItemView>("/api/v1/bank-items?page=1&limit=1");
  return meta.total;
}

export async function getBankItem(id: string): Promise<BankItem> {
  return toBankItem(await apiGet<BankItemView>(`/api/v1/bank-items/${id}`));
}

/** item ใหม่ในหน้าเว็บ (ยังไม่บันทึก) */
export function createBankItem(partial: Partial<BankItem> = {}): BankItem {
  return {
    ...blankContent(),
    id: "",
    tags: [],
    difficulty: "MEDIUM",
    usedCount: 0,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

/** สร้าง (ไม่มี id) หรือแก้ไข — คำถามในคลังต้องครบตั้งแต่ตอนบันทึก (ไม่ครบ → 400) */
export async function upsertBankItem(item: BankItem): Promise<BankItem> {
  const body = toBody(item);
  const saved = item.id
    ? await apiPatch<BankItemView>(`/api/v1/bank-items/${item.id}`, body)
    : await apiPost<BankItemView>("/api/v1/bank-items", body);
  return toBankItem(saved);
}

export async function deleteBankItems(ids: string[]): Promise<void> {
  for (const id of ids) await apiDelete(`/api/v1/bank-items/${id}`);
}

/** บันทึกคำถามจากแบบทดสอบเข้าคลัง (คัดลอก) แล้วคืน item ที่สร้าง */
export async function saveQuestionToBank(question: QuestionContent): Promise<BankItem> {
  const content = cloneContent(question);
  return upsertBankItem(
    createBankItem({
      ...content,
      tags: content.tags ?? [],
      difficulty: content.difficulty ?? "MEDIUM",
    }),
  );
}

/** คัดลอกคำถามจากคลังเป็นคำถามของแบบทดสอบ พร้อมบันทึกที่มา */
export function bankItemsToQuestions(
  items: BankItem[],
  quizId: string,
  startOrder: number,
): Question[] {
  return items.map((item, idx) => ({
    ...cloneContent(item),
    id: newId(),
    quizId,
    order: startOrder + idx,
    sourceBankItemId: item.id,
  }));
}

/**
 * ดึงคำถามที่ครบจากทุกแบบทดสอบเข้าคลัง (ข้ามข้อที่โจทย์ซ้ำกับในคลัง และประเภทที่ยังไม่รองรับ)
 * คืนจำนวนที่เพิ่มได้
 */
export async function importFromQuizzes(): Promise<number> {
  const [quizzes, existing] = await Promise.all([getAllQuizzes(), getBankItems()]);
  const seen = new Set(existing.map((i) => i.prompt.trim().toLowerCase()));
  let added = 0;

  for (const quiz of quizzes) {
    for (const question of quiz.questions ?? []) {
      const key = String(question.prompt ?? "")
        .trim()
        .toLowerCase();
      if (!key || seen.has(key) || !isSupportedType(question.type) || !isComplete(question)) {
        continue;
      }
      seen.add(key);
      const content = cloneContent(question);
      await upsertBankItem(
        createBankItem({
          ...content,
          tags: content.tags?.length
            ? content.tags
            : [String(quiz.title ?? "").slice(0, 20)].filter(Boolean),
          difficulty: content.difficulty ?? "MEDIUM",
        }),
      );
      added++;
    }
  }
  return added;
}

/** แปลง CSV: โจทย์,ตัวเลือก1,ตัวเลือก2,ตัวเลือก3,ตัวเลือก4,เฉลย(1-4),แท็ก(คั่นด้วย |) */
export function parseCsv(text: string): BankItem[] {
  const out: BankItem[] = [];
  for (const line of text.split(/\r?\n/).filter((l) => l.trim())) {
    const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cells.length < 6 || !cells[0]) continue;
    const correct = Number(cells[5]) - 1;
    const texts = cells.slice(1, 5).filter(Boolean);
    if (texts.length < 2 || correct < 0 || correct >= texts.length) continue;
    out.push(
      createBankItem({
        prompt: cells[0],
        options: texts.map((t, i) => ({ id: newId(), text: t, isCorrect: i === correct })),
        tags: cells[6] ? cells[6].split("|").map((t) => t.trim()) : [],
      }),
    );
  }
  return out;
}

/** นำเข้า CSV เข้าคลัง — คืนจำนวนที่บันทึกได้ (แถวที่ไม่ครบถูกข้าม) */
export async function importCsv(text: string): Promise<number> {
  let added = 0;
  for (const item of parseCsv(text)) {
    if (!isComplete(item)) continue;
    await upsertBankItem(item);
    added++;
  }
  return added;
}

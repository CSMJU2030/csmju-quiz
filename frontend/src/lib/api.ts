// src/lib/api.ts
// ตัวห่อ fetch กลางของหน้าเว็บ (ui-design-system.md ข้อ 16.1 lib/api.ts)
// - แกะ envelope { success, data, meta } / { success:false, error:{ code, message, details } }
// - เรียกแบบ relative ที่ origin ของหน้าเว็บ (next.config.ts proxy ไป backend · connect-core-hub ข้อ 1)
//   เบราว์เซอร์ส่งคุกกี้ session csmju_quiz_access_token (HttpOnly) ไปเอง
//   หน้าเว็บไม่เคยเห็นหรือเก็บ token เอง (auth-contract.md ข้อ 5.1, 6 · SEC-03)
// - 401 → พาทั้งหน้าไป /auth/login?next=<หน้าเดิม> (silent re-SSO · auth-contract.md ข้อ 7)
//   โดยไม่แสดงอะไรให้ผู้ใช้เห็น ยกเว้น
//   · คำขอของผู้เล่นที่ใช้บัตรเข้าห้อง (roomPass) — 401 = บัตรหมดอายุ/ถูกนำออก ให้หน้าจอแจ้งเอง
//   · หน้าที่มีงานกรอกค้าง (setUnsavedWork) — ห้าม redirect ทับ ให้หน้านั้นแสดงปุ่ม "เข้าสู่ระบบอีกครั้ง" เอง
//   · เพิ่งพาไปไม่ถึง 30 วินาที (กันวน) — หน้าเว็บแสดงปุ่ม "เข้าสู่ระบบอีกครั้ง" แทน
// - ข้อความ error ภาษาไทย map จาก error.code ตามตาราง ui-design-system.md ข้อ 9.3

import { API_BASE_URL } from "@/lib/env";
import { isSsoRedirectRecent, markSsoRedirect } from "@/lib/player-session";

/** รายการปิดจาก standards/contracts/error-codes.json */
export const ERROR_CODES = [
  "BAD_REQUEST",
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "INTERNAL_ERROR",
  "TOO_MANY_REQUESTS",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: PageMeta;
}

interface ErrorEnvelope {
  success: false;
  error: { code: ErrorCode; message: string; details?: unknown };
}

type Envelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

export class ApiError extends Error {
  readonly code: ErrorCode | "NETWORK_ERROR";
  readonly status: number;
  readonly details?: unknown;
  /** วินาทีที่ต้องรอ (header Retry-After ของ 429) */
  readonly retryAfterSec?: number;

  constructor(
    code: ErrorCode | "NETWORK_ERROR",
    message: string,
    status: number,
    details?: unknown,
    retryAfterSec?: number,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.retryAfterSec = retryAfterSec;
  }
}

/** ข้อความมาตรฐาน (ui-design-system.md ข้อ 9.3) */
const STANDARD_MESSAGES: Record<ErrorCode | "NETWORK_ERROR", string> = {
  BAD_REQUEST: "คำขอไม่ถูกต้อง กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง",
  VALIDATION_ERROR: "ข้อมูลบางช่องไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง",
  UNAUTHORIZED: "",
  FORBIDDEN: "คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ หากคิดว่าเป็นข้อผิดพลาด กรุณาติดต่อผู้ดูแลระบบย่อยนี้",
  NOT_FOUND: "ไม่พบข้อมูลที่คุณกำลังค้นหา อาจถูกลบไปแล้วหรือลิงก์ไม่ถูกต้อง",
  CONFLICT: "ข้อมูลถูกแก้ไขโดยผู้ใช้อื่นแล้ว กรุณารีเฟรชและลองใหม่",
  INTERNAL_ERROR: "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง",
  TOO_MANY_REQUESTS: "มีการใช้งานถี่เกินไป กรุณารอสักครู่แล้วลองใหม่",
  NETWORK_ERROR: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง",
};

/**
 * ข้อความกฎธุรกิจจาก backend (ภาษาอังกฤษตาม api-conventions.md) → ภาษาไทยสำหรับผู้ใช้
 * ข้อความของห้องเกมอยู่ที่ gameErrorMessage ใน lib/game-api.ts
 */
const BUSINESS_MESSAGES: [RegExp, string][] = [
  [/needs at least one question/i, "ต้องมีคำถามอย่างน้อย 1 ข้อก่อนเผยแพร่"],
  [/incomplete question/i, "มีคำถามที่ยังกรอกไม่ครบ กรุณาแก้ไขให้ครบก่อน"],
  [/no questions/i, "แบบทดสอบนี้ยังไม่มีคำถาม"],
  [/only published quizzes/i, "เปิดห้องได้เฉพาะแบบทดสอบที่เผยแพร่แล้ว"],
];

const THAI = /[\u0E00-\u0E7F]/;

/** ข้อความที่แสดงให้ผู้ใช้เห็น — ภาษาไทยเสมอ ห้ามแสดง stack trace หรือข้อความอังกฤษดิบ (ข้อ 9.3) */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "TOO_MANY_REQUESTS" && error.retryAfterSec) {
      return `มีการใช้งานถี่เกินไป กรุณารอ ${error.retryAfterSec} วินาทีแล้วลองใหม่`;
    }
    if (error.code === "VALIDATION_ERROR" || error.code === "CONFLICT") {
      if (THAI.test(error.message)) return error.message;
      const known = BUSINESS_MESSAGES.find(([pattern]) => pattern.test(error.message));
      if (known) return known[1];
    }
    return STANDARD_MESSAGES[error.code];
  }
  return STANDARD_MESSAGES.INTERNAL_ERROR;
}

/**
 * ลิงก์เริ่ม SSO ของระบบนี้ (same-origin · proxy ไป backend) — backend สร้าง state แล้วพาไป Core Hub
 * ล็อกอินเสร็จกลับมาหน้า next (path + query ของหน้าปัจจุบันถ้าไม่ระบุ)
 */
export function loginUrl(next?: string): string {
  const path =
    next ??
    (typeof window === "undefined" ? "/" : window.location.pathname + window.location.search);
  return `/auth/login?next=${encodeURIComponent(path)}`;
}

/**
 * ที่อยู่ของฟอร์มออกจากระบบ (POST · ไม่ต้องมี token) — backend ล้างคุกกี้ session
 * แล้วพาไปออกจากระบบที่ Core Hub ต่อ (303 → {CORE_HUB_WEB_URL}/logout)
 * ต้องเป็น <form method="post"> ไม่ใช่ลิงก์ เพื่อกันการออกจากระบบโดยไม่ตั้งใจ (prefetch / ลิงก์จากเว็บอื่น)
 */
export function logoutUrl(): string {
  return "/auth/logout";
}

// ─── งานที่กรอกค้าง (auth-contract ข้อ 7: หน้าที่มีฟอร์มกรอกค้าง ห้าม redirect ทับ) ───
let unsavedWork = false;

/** หน้าที่มีงานยังไม่บันทึก (เช่น หน้าแก้ไขแบบทดสอบ) ตั้ง true ระหว่างที่มีงานค้าง และ false เมื่อบันทึก/ออกจากหน้า */
export function setUnsavedWork(on: boolean) {
  unsavedWork = on;
}

export function hasUnsavedWork(): boolean {
  return unsavedWork;
}

/**
 * พาทั้งหน้าไปล็อกอิน (silent re-SSO · auth-contract ข้อ 7) แล้วกลับมาหน้าเดิมพร้อม query
 * ยังไม่ล็อกอิน Core Hub → เห็นหน้า login ของ Core Hub ครั้งเดียว · ล็อกอินอยู่แล้ว → กลับมาเองทันที
 * เพิ่งพาไปไม่ถึง 30 วินาทีแล้วยังได้ 401 → ไม่พาไปซ้ำ (หน้าเว็บแสดงปุ่ม "เข้าสู่ระบบอีกครั้ง")
 * มีงานกรอกค้าง → ไม่พาไป (หน้านั้นแสดงปุ่มเอง) · คืน true เมื่อกำลังเปลี่ยนหน้า
 */
export function redirectToSso(): boolean {
  if (typeof window === "undefined") return false;
  if (unsavedWork || isSsoRedirectRecent()) return false;
  markSsoRedirect();
  window.location.assign(loginUrl());
  return true;
}

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && (ERROR_CODES as readonly string[]).includes(value);
}

export interface RequestOptions {
  /** คำขอของผู้เล่นที่ใช้บัตรเข้าห้อง — 401 ไม่พาไป SSO */
  roomPass?: boolean;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<SuccessEnvelope<T>> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        // FormData (อัปโหลดไฟล์) ให้เบราว์เซอร์ตั้ง multipart boundary เอง
        ...(typeof init.body === "string" ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError("NETWORK_ERROR", STANDARD_MESSAGES.NETWORK_ERROR, 0);
  }

  let body: Envelope<T> | null = null;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    body = null;
  }

  if (response.status === 401) {
    if (!options.roomPass) redirectToSso();
    throw new ApiError("UNAUTHORIZED", "", 401);
  }

  if (!body || body.success !== true) {
    const err = body && body.success === false ? body.error : undefined;
    const code: ErrorCode = err && isErrorCode(err.code) ? err.code : "INTERNAL_ERROR";
    const retry = Number(response.headers.get("Retry-After"));
    throw new ApiError(
      code,
      err?.message ?? "",
      response.status,
      err?.details,
      Number.isFinite(retry) && retry > 0 ? retry : undefined,
    );
  }

  return body;
}

export async function apiGet<T>(path: string, options?: RequestOptions): Promise<T> {
  return (await request<T>(path, {}, options)).data;
}

export async function apiList<T>(
  path: string,
  options?: RequestOptions,
): Promise<{ data: T[]; meta: PageMeta }> {
  const body = await request<T[]>(path, {}, options);
  return {
    data: body.data,
    meta: body.meta ?? { total: body.data.length, page: 1, limit: body.data.length, totalPages: 1 },
  };
}

export async function apiPost<T>(
  path: string,
  payload: unknown,
  options?: RequestOptions,
): Promise<T> {
  return (await request<T>(path, { method: "POST", body: JSON.stringify(payload) }, options)).data;
}

/** ส่งไฟล์แบบ multipart/form-data */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  return (await request<T>(path, { method: "POST", body: form })).data;
}

export async function apiPatch<T>(path: string, payload: unknown): Promise<T> {
  return (await request<T>(path, { method: "PATCH", body: JSON.stringify(payload) })).data;
}

export async function apiDelete(
  path: string,
  options?: RequestOptions,
): Promise<{ id: string; deleted: true }> {
  return (await request<{ id: string; deleted: true }>(path, { method: "DELETE" }, options)).data;
}

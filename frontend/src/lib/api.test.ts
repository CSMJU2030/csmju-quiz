import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  errorMessage,
  loginUrl,
  logoutUrl,
  redirectToSso,
  setUnsavedWork,
} from "@/lib/api";

describe("errorMessage", () => {
  it("ข้อความกฎธุรกิจภาษาอังกฤษจาก backend แสดงเป็นภาษาไทย", () => {
    expect(
      errorMessage(
        new ApiError("CONFLICT", "Quiz needs at least one question before publishing", 409),
      ),
    ).toBe("ต้องมีคำถามอย่างน้อย 1 ข้อก่อนเผยแพร่");
    expect(errorMessage(new ApiError("CONFLICT", "Quiz has incomplete questions", 409))).toBe(
      "มีคำถามที่ยังกรอกไม่ครบ กรุณาแก้ไขให้ครบก่อน",
    );
  });

  it("ข้อความที่ไม่รู้จักใช้ข้อความมาตรฐาน · ไม่มีภาษาอังกฤษหลุดไปถึงผู้ใช้", () => {
    const validation = errorMessage(
      new ApiError("VALIDATION_ERROR", "Request validation failed", 400),
    );
    expect(validation).toBe("ข้อมูลบางช่องไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง");
    const conflict = errorMessage(new ApiError("CONFLICT", "Something else", 409));
    expect(conflict).toBe("ข้อมูลถูกแก้ไขโดยผู้ใช้อื่นแล้ว กรุณารีเฟรชและลองใหม่");
    expect(errorMessage(new Error("boom"))).toBe("ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง");
  });

  it("ข้อความที่เป็นภาษาไทยอยู่แล้วส่งต่อได้", () => {
    expect(errorMessage(new ApiError("CONFLICT", "ชื่อซ้ำ", 409))).toBe("ชื่อซ้ำ");
  });

  it("429 ใช้ข้อความมาตรฐาน (ข้อ 9.3) พร้อมจำนวนวินาทีเมื่อมี Retry-After", () => {
    expect(errorMessage(new ApiError("TOO_MANY_REQUESTS", "", 429, undefined, 12))).toBe(
      "มีการใช้งานถี่เกินไป กรุณารอ 12 วินาทีแล้วลองใหม่",
    );
    expect(errorMessage(new ApiError("TOO_MANY_REQUESTS", "", 429))).toBe(
      "มีการใช้งานถี่เกินไป กรุณารอสักครู่แล้วลองใหม่",
    );
  });
});

describe("ประตูเดียว · silent re-SSO (auth-contract ข้อ 7)", () => {
  let assigned: string[];
  beforeEach(() => {
    assigned = [];
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      location: {
        pathname: "/quiz/q1/edit",
        search: "?tab=questions",
        assign: (url: string) => void assigned.push(url),
      },
    });
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });
  afterEach(() => {
    setUnsavedWork(false);
    vi.unstubAllGlobals();
  });

  it("ลิงก์ login/logout เป็น same-origin (proxy ของ next.config.ts) พร้อม next = path + query", () => {
    expect(loginUrl()).toBe("/auth/login?next=%2Fquiz%2Fq1%2Fedit%3Ftab%3Dquestions");
    expect(loginUrl("/history")).toBe("/auth/login?next=%2Fhistory");
    expect(logoutUrl()).toBe("/auth/logout");
  });

  it("401 → พาทั้งหน้าไป /auth/login ครั้งเดียว · ภายใน 30 วินาทีไม่พาซ้ำ (กันวน)", () => {
    expect(redirectToSso()).toBe(true);
    expect(assigned).toEqual(["/auth/login?next=%2Fquiz%2Fq1%2Fedit%3Ftab%3Dquestions"]);
    expect(redirectToSso()).toBe(false);
    expect(assigned).toHaveLength(1);
  });

  it("มีงานกรอกค้าง → ไม่ redirect ทับ", () => {
    setUnsavedWork(true);
    expect(redirectToSso()).toBe(false);
    expect(assigned).toEqual([]);
  });
});

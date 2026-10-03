import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import type { GameStateView } from "@/lib/api-types";
import {
  countdownValue,
  gameErrorMessage,
  isLastQuestion,
  remainingMs,
  startDelayMs,
  toQuestionOptions,
} from "@/lib/game-api";

const T0 = Date.parse("2026-09-30T10:00:00.000Z");
const at = (offsetMs: number) => new Date(T0 + offsetMs).toISOString();

function state(patch: Partial<GameStateView>): GameStateView {
  return {
    id: "g1",
    gamePin: "123456",
    status: "ACTIVE",
    phase: "QUESTION",
    viewer: "PLAYER",
    quizTitle: "Quiz",
    currentQuestionIndex: 0,
    totalQuestions: 2,
    questionStartedAt: at(0),
    phaseEndsAt: null,
    countdownEndsAt: null,
    serverTime: at(0),
    settings: { timeLimitOverride: null, shuffleQuestions: false, shuffleOptions: false },
    question: {
      id: "q1",
      index: 0,
      type: "MULTIPLE_CHOICE",
      prompt: "?",
      imageUrl: null,
      timeLimit: 20,
      points: 1000,
      options: [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
      ],
    },
    answeredCount: 0,
    playerCount: 1,
    players: [],
    distribution: null,
    me: null,
    results: null,
    startedAt: at(0),
    finishedAt: null,
    createdAt: at(0),
    ...patch,
  };
}

describe("game-api timing", () => {
  it("เวลาที่เหลือนับจากเวลาเริ่มข้อของ server", () => {
    expect(remainingMs(state({}), T0 + 5000)).toBe(15000);
    expect(remainingMs(state({}), T0 + 25000)).toBe(0);
    expect(remainingMs(state({ phase: "RESULT" }), T0)).toBe(0);
  });

  it("ปิดรับคำตอบเร็วขึ้นเมื่อ server ตั้ง countdownEndsAt", () => {
    expect(remainingMs(state({ countdownEndsAt: at(8000) }), T0 + 6000)).toBe(2000);
    expect(countdownValue(state({ countdownEndsAt: at(8000) }), T0 + 6000)).toBe(2);
    expect(countdownValue(state({ countdownEndsAt: at(8000) }), T0 + 1000)).toBeNull();
  });

  it("นับ 3-2-1 ก่อนข้อแรก", () => {
    const s = state({ questionStartedAt: at(3000) });
    expect(startDelayMs(s, T0 + 500)).toBe(2500);
    expect(startDelayMs(s, T0 + 4000)).toBe(0);
  });

  it("ข้อสุดท้าย", () => {
    expect(isLastQuestion(state({ currentQuestionIndex: 1 }))).toBe(true);
    expect(isLastQuestion(state({}))).toBe(false);
  });
});

describe("game-api helpers", () => {
  it("ตัวเลือกที่ยังไม่เฉลยถือว่าไม่ถูก", () => {
    expect(
      toQuestionOptions([
        { id: "a", text: "A" },
        { id: "b", text: "B", isCorrect: true },
      ]),
    ).toEqual([
      { id: "a", text: "A", isCorrect: false },
      { id: "b", text: "B", isCorrect: true },
    ]);
  });

  it("แปลงข้อผิดพลาดของห้องเกมเป็นภาษาไทย", () => {
    expect(
      gameErrorMessage(new ApiError("CONFLICT", "Nickname is already taken in this game", 409)),
    ).toBe("ชื่อนี้มีผู้เล่นใช้แล้ว กรุณาเปลี่ยนชื่อ");
    expect(gameErrorMessage(new ApiError("NOT_FOUND", "Game session not found", 404))).toBe(
      "ไม่พบห้องเกมนี้ อาจถูกปิดไปแล้ว",
    );
    expect(gameErrorMessage(new Error("x"))).toBe("ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง");
  });

  it("429 ของห้องเกมใช้ข้อความเฉพาะการขอเข้าห้อง", () => {
    expect(gameErrorMessage(new ApiError("TOO_MANY_REQUESTS", "", 429, undefined, 5))).toBe(
      "มีการขอเข้าห้องถี่เกินไป กรุณารอ 5 วินาทีแล้วลองใหม่",
    );
    expect(gameErrorMessage(new ApiError("TOO_MANY_REQUESTS", "", 429))).toBe(
      "มีการขอเข้าห้องถี่เกินไป กรุณารอสักครู่แล้วลองใหม่",
    );
  });
});

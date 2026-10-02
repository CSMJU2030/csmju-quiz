import { describe, expect, it } from "vitest";
import type { AnswerReviewView } from "@/lib/api-types";
import {
  RESULT_INFO,
  formatRank,
  formatResponseTime,
  questionsToReview,
} from "@/lib/player-review";

const answer = (result: AnswerReviewView["result"], n: number): AnswerReviewView => ({
  questionNumber: n,
  questionId: `q${n}`,
  type: "MULTIPLE_CHOICE",
  prompt: `ข้อ ${n}`,
  imageUrl: null,
  timeLimit: 20,
  points: 1000,
  options: [],
  selectedOptionId: null,
  result,
  earnedPoints: 0,
  responseMs: null,
});

describe("player review helpers", () => {
  it("เวลาตอบเป็นวินาที ทศนิยม 1 ตำแหน่ง", () => {
    expect(formatResponseTime(2350)).toBe("2.4 วินาที");
    expect(formatResponseTime(1000)).toBe("1 วินาที");
    expect(formatResponseTime(null)).toBe("—");
  });

  it("ข้อที่ควรทบทวนคือข้อที่ไม่ถูก", () => {
    const list = [
      answer("CORRECT", 1),
      answer("INCORRECT", 2),
      answer("TIMEOUT", 3),
      answer("NO_ANSWER", 4),
    ];
    expect(questionsToReview(list).map((a) => a.questionNumber)).toEqual([2, 3, 4]);
  });

  it("ป้ายผลลัพธ์ครบทุกค่า", () => {
    expect(Object.keys(RESULT_INFO).sort()).toEqual(
      ["CORRECT", "INCORRECT", "NO_ANSWER", "TIMEOUT"].sort(),
    );
    expect(RESULT_INFO.TIMEOUT.label).toBe("หมดเวลา");
  });

  it("อันดับ", () => {
    expect(formatRank(3, 12)).toBe("อันดับ 3 จาก 12 คน");
  });
});

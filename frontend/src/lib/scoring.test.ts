import { describe, expect, it } from "vitest";
import { calculatePoints } from "@/lib/scoring";

describe("calculatePoints", () => {
  it("ใช้คะแนนของข้อเป็นฐาน", () => {
    expect(calculatePoints({ correct: true, basePoints: 1000, speed: 1, streak: 1 })).toBe(1000);
    expect(calculatePoints({ correct: true, basePoints: 2000, speed: 1, streak: 1 })).toBe(2000);
  });

  it("ข้อไม่คิดคะแนนและตอบผิดได้ 0", () => {
    expect(calculatePoints({ correct: true, basePoints: 0, speed: 1, streak: 3 })).toBe(0);
    expect(calculatePoints({ correct: false, basePoints: 1000, speed: 1, streak: 0 })).toBe(0);
  });

  it("ตอบช้าสุดได้ครึ่งหนึ่ง และโบนัสต่อเนื่องไม่เกิน 2 เท่า", () => {
    expect(calculatePoints({ correct: true, basePoints: 1000, speed: 0, streak: 1 })).toBe(500);
    expect(calculatePoints({ correct: true, basePoints: 1000, speed: 1, streak: 3 })).toBe(1200);
    expect(calculatePoints({ correct: true, basePoints: 1000, speed: 1, streak: 50 })).toBe(2000);
  });
});

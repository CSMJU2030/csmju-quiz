import { describe, expect, it } from "vitest";
import {
  AnswerCircleIcon,
  AnswerDiamondIcon,
  AnswerSquareIcon,
  AnswerTriangleIcon,
} from "@/components/icons";
import { ANSWER_THEMES, answerTheme } from "./answer-theme";

describe("answerTheme", () => {
  it("4 ชุด · สีและรูปทรงไม่ซ้ำกัน · ลำดับ แดง-ข้าวหลามตัด น้ำเงิน-สามเหลี่ยม เหลืองทอง-สี่เหลี่ยม เขียว-วงกลม", () => {
    expect(ANSWER_THEMES).toHaveLength(4);
    expect(new Set(ANSWER_THEMES.map((t) => t.fill)).size).toBe(4);
    expect(ANSWER_THEMES.map((t) => t.Icon)).toEqual([
      AnswerDiamondIcon,
      AnswerTriangleIcon,
      AnswerSquareIcon,
      AnswerCircleIcon,
    ]);
  });

  it("วนกลับเมื่อเกิน 4 และไม่พังเมื่อติดลบ", () => {
    expect(answerTheme(4)).toBe(ANSWER_THEMES[0]);
    expect(answerTheme(-1)).toBe(ANSWER_THEMES[3]);
  });
});

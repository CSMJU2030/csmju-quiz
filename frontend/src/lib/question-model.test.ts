import { describe, expect, it } from "vitest";
import {
  MAX_OPTIONS,
  blankContent,
  changeType,
  cloneContent,
  isComplete,
  normalizeContent,
  validateQuestion,
} from "@/lib/question-model";

const filled = () => {
  const c = blankContent("MULTIPLE_CHOICE");
  return {
    ...c,
    prompt: "2 + 2 เท่ากับเท่าไร",
    options: c.options.map((o, i) => ({ ...o, text: String(i + 3) })),
  };
};

describe("question-model", () => {
  it("คำถามปรนัยว่างมี 4 ตัวเลือกและยังไม่ครบ", () => {
    const c = blankContent("MULTIPLE_CHOICE");
    expect(c.options).toHaveLength(MAX_OPTIONS);
    expect(isComplete(c)).toBe(false);
    expect(validateQuestion(c).prompt).toBeDefined();
  });

  it("ปรนัยที่กรอกครบผ่านการตรวจ", () => {
    expect(isComplete(filled())).toBe(true);
  });

  it("ตรวจพบตัวเลือกว่าง ตัวเลือกซ้ำ และไม่มีคำตอบถูก", () => {
    const c = filled();
    expect(
      validateQuestion({
        ...c,
        options: c.options.map((o, i) => (i === 1 ? { ...o, text: " " } : o)),
      }).options,
    ).toBeDefined();
    expect(
      validateQuestion({ ...c, options: c.options.map((o) => ({ ...o, text: "ซ้ำ" })) }).options,
    ).toBe("มีตัวเลือกที่ซ้ำกัน");
    expect(
      validateQuestion({ ...c, options: c.options.map((o) => ({ ...o, isCorrect: false })) })
        .correct,
    ).toBeDefined();
  });

  it("เปลี่ยนเป็นถูก/ผิดแล้วได้ 2 ตัวเลือก และเก็บโจทย์ไว้", () => {
    const tf = changeType(filled(), "TRUE_FALSE");
    expect(tf.options.map((o) => o.text)).toEqual(["ถูก", "ผิด"]);
    expect(tf.prompt).toBe("2 + 2 เท่ากับเท่าไร");
    expect(isComplete(tf)).toBe(true);
  });

  it("ประเภทที่เกมยังไม่รองรับไม่ผ่านการตรวจ", () => {
    expect(validateQuestion({ ...filled(), type: "POLL" }).type).toBeDefined();
  });

  it("คัดลอกแล้วได้ id ตัวเลือกใหม่ และ normalize ตัดช่องว่าง", () => {
    const c = filled();
    const copy = cloneContent(c);
    expect(copy.options.map((o) => o.id)).not.toEqual(c.options.map((o) => o.id));
    const n = normalizeContent({ ...c, prompt: "  ก  ", tags: [" a ", ""] });
    expect(n.prompt).toBe("ก");
    expect(n.tags).toEqual(["a"]);
  });
});

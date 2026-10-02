import { describe, expect, it } from "vitest";
import { cn, getQuestionTypeLabel, newId } from "./utils";

describe("cn", () => {
  it("รวม class ที่เป็นค่าจริง และตัดค่าว่างทิ้ง", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});

describe("getQuestionTypeLabel", () => {
  it("แปลงประเภทคำถามที่รู้จักเป็นป้ายชื่อภาษาไทย", () => {
    expect(getQuestionTypeLabel("TRUE_FALSE")).toBe("ถูก / ผิด");
  });

  it("คืนค่าเดิมเมื่อไม่รู้จักประเภท", () => {
    expect(getQuestionTypeLabel("UNKNOWN")).toBe("UNKNOWN");
  });
});

describe("newId", () => {
  it("สร้าง UUID v4 ตามสัญญา API", () => {
    expect(newId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

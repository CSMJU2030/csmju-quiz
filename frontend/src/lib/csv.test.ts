import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("csv", () => {
  it("ครอบเซลล์ที่มีจุลภาค เครื่องหมายคำพูด และขึ้นบรรทัดใหม่", () => {
    expect(
      toCsv([
        ["a", 'b"c', "d,e"],
        [1, null, "x\ny"],
      ]),
    ).toBe('a,"b""c","d,e"\r\n1,,"x\ny"');
  });
});

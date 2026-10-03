import { describe, expect, it } from "vitest";
import { formatFileStamp } from "./format";

describe("formatFileStamp", () => {
  it("formats in Asia/Bangkok regardless of the machine timezone", () => {
    // 2026-08-11 23:30 UTC = 2026-08-12 06:30 เวลาไทย
    expect(formatFileStamp("2026-08-11T23:30:00Z")).toBe("20260812-0630");
  });

  it("uses 00 for midnight (not 24)", () => {
    expect(formatFileStamp("2026-01-01T17:05:00Z")).toBe("20260102-0005");
  });

  it("returns null for an invalid date", () => {
    expect(formatFileStamp("not-a-date")).toBeNull();
  });
});

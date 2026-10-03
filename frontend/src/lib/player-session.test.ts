import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isSsoRedirectRecent, markSsoRedirect } from "./player-session";

describe("กันวนตอนพาไปล็อกอิน", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {});
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("ยังไม่เคยพาไป → redirect ได้", () => {
    expect(isSsoRedirectRecent(1_000)).toBe(false);
  });

  it("เพิ่งพาไปไม่ถึง 30 วินาที → ไม่ redirect ซ้ำ", () => {
    markSsoRedirect(1_000);
    expect(isSsoRedirectRecent(30_999)).toBe(true);
  });

  it("เกิน 30 วินาทีแล้ว → redirect ได้อีก", () => {
    markSsoRedirect(1_000);
    expect(isSsoRedirectRecent(31_000)).toBe(false);
  });
});

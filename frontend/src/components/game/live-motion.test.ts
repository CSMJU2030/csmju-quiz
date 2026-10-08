import { describe, expect, it } from "vitest";
import { tween } from "@/components/game/live-motion";

describe("tween", () => {
  it("starts at from, ends at to and eases out", () => {
    expect(tween(100, 1100, 0)).toBe(100);
    expect(tween(100, 1100, 1)).toBe(1100);
    expect(tween(100, 1100, 2)).toBe(1100);
    expect(tween(100, 1100, 0.5)).toBeGreaterThan(600);
    expect(tween(5, 2, 1)).toBe(2);
  });
});

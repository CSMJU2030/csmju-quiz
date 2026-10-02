// src/lib/play-engine.ts

export const COUNTDOWN_SECONDS = 3;
export const DEFAULT_DURATION = 20;

// สีและไอคอนประจำตัวเลือกย้ายไปที่ src/components/game/answer-colors.ts

export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

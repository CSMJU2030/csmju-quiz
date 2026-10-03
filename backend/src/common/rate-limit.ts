// จำกัดจำนวนคำขอต่อกุญแจ (เช่น IP) แบบหน้าต่างเวลาคงที่ — เก็บในหน่วยความจำของ process เดียว
// ใช้กับ endpoint ที่ไม่ต้องล็อกอินของผู้เล่น (เงื่อนไข PM 2 ต.ค. 2569: เกินแล้วตอบ 429 + Retry-After)

export interface RateLimitResult {
  allowed: boolean;
  /** วินาทีที่ต้องรอก่อนขอใหม่ (ใช้เป็น header Retry-After) */
  retryAfterSec: number;
}

export class FixedWindowRateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  hit(key: string): RateLimitResult {
    const now = this.now();
    if (this.hits.size > 10_000) this.sweep(now);
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfterSec: 0 };
    }
    entry.count += 1;
    if (entry.count <= this.limit) return { allowed: true, retryAfterSec: 0 };
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  }

  private sweep(now: number) {
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
  }
}

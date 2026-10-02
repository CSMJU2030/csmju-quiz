import { FixedWindowRateLimiter } from './rate-limit';

describe('FixedWindowRateLimiter', () => {
  it('ให้ผ่านไม่เกินเพดานต่อหน้าต่าง แล้วบอกเวลาที่ต้องรอ', () => {
    let now = 0;
    const limiter = new FixedWindowRateLimiter(2, 60_000, () => now);
    expect(limiter.hit('1.1.1.1').allowed).toBe(true);
    expect(limiter.hit('1.1.1.1').allowed).toBe(true);
    now = 15_000;
    expect(limiter.hit('1.1.1.1')).toEqual({ allowed: false, retryAfterSec: 45 });
    // กุญแจอื่นไม่โดนด้วย
    expect(limiter.hit('2.2.2.2').allowed).toBe(true);
    // ครบหน้าต่างแล้วเริ่มนับใหม่
    now = 60_000;
    expect(limiter.hit('1.1.1.1').allowed).toBe(true);
  });
});

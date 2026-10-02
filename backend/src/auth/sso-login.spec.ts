import { encodeStateCookie, matchStateCookie, newSsoState, safeNext } from './sso-login';

const FRONT = 'http://localhost:3102';

describe('safeNext', () => {
  it('รับ path ภายในระบบพร้อม query', () => {
    expect(safeNext('/game/join?pin=123456', FRONT)).toBe('/game/join?pin=123456');
    expect(safeNext('/reports/abc#top', FRONT)).toBe('/reports/abc#top');
  });

  it('ไม่รับค่าที่ผิดกฎข้อ 5.2', () => {
    for (const bad of [
      undefined,
      '',
      'game',
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '/a\nb',
      '/a\u007fb',
      '/auth',
      '/auth/login',
      `/${'a'.repeat(512)}`,
    ]) {
      expect(safeNext(bad, FRONT)).toBeNull();
    }
  });
});

describe('state cookie', () => {
  it('state สุ่ม 32 ไบต์ base64url ไม่ซ้ำกัน', () => {
    const a = newSsoState();
    expect(Buffer.from(a, 'base64url')).toHaveLength(32);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(newSsoState()).not.toBe(a);
  });

  it('state ตรง → คืน next · ไม่ตรงหรือไม่มีคุกกี้ → null', () => {
    const state = newSsoState();
    const cookie = encodeStateCookie(state, '/game/join?pin=1');
    expect(matchStateCookie(cookie, state)).toBe('/game/join?pin=1');
    expect(matchStateCookie(cookie, newSsoState())).toBeNull();
    expect(matchStateCookie(cookie, 'short')).toBeNull();
    expect(matchStateCookie(null, state)).toBeNull();
    expect(matchStateCookie('no-dot', state)).toBeNull();
  });
});

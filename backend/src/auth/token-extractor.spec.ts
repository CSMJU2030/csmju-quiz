import { extractToken } from './token-extractor';

describe('extractToken', () => {
  it('Authorization header มาก่อนคุกกี้', () => {
    expect(
      extractToken({
        headers: { authorization: 'Bearer aaa', cookie: 'csmju_quiz_access_token=bbb' },
      }),
    ).toEqual({ kind: 'token', token: 'aaa' });
  });
  it('อ่านคุกกี้ session ได้', () => {
    expect(extractToken({ headers: { cookie: 'x=1; csmju_quiz_access_token=bbb' } })).toEqual({
      kind: 'token',
      token: 'bbb',
    });
  });
  it('ไม่อ่านคุกกี้ของ Core Hub (csmju_access_token · core_hub_access_token เดิม)', () => {
    expect(
      extractToken({
        headers: {
          cookie: 'csmju_access_token=hub; csmju_refresh_token=r; core_hub_access_token=old',
        },
      }).kind,
    ).toBe('missing');
  });
  it('scheme อื่นที่ไม่ใช่ Bearer = malformed · ไม่มีอะไรเลย = missing', () => {
    expect(extractToken({ headers: { authorization: 'Basic dXNlcjpwYXNz' } }).kind).toBe(
      'malformed',
    );
    expect(extractToken({ headers: {} }).kind).toBe('missing');
  });
});

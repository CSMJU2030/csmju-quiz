// ตรวจครบ 10 ขั้นของ auth-contract.md 1.2 ข้อ 4 ด้วยคู่กุญแจชั่วคราวในเทส (ไม่ใช่กุญแจของ Core Hub)
import { exportJWK, generateKeyPair, SignJWT, type KeyLike } from 'jose';
import type { AppConfig } from '../config/app-config.service';
import { TokenRejectedError } from './auth.errors';
import { CoreHubTokenVerifier } from './core-hub-token.verifier';
import type { JwksService } from './jwks.service';

const CONFIG: Record<string, unknown> = {
  CORE_HUB_ISSUER: 'core-hub',
  CORE_HUB_AUDIENCE: 'csmju2030',
  JWT_CLOCK_TOLERANCE_SEC: 5,
  SUBSYSTEM_ID: 'csmju-quiz',
};
const now = () => Math.floor(Date.now() / 1000);

describe('CoreHubTokenVerifier', () => {
  let key: { publicKey: KeyLike; privateKey: KeyLike };
  let foreign: { publicKey: KeyLike; privateKey: KeyLike };
  let verifier: CoreHubTokenVerifier;

  const token = (
    over: {
      alg?: string;
      kid?: string | null;
      iss?: string;
      aud?: string;
      sub?: string | null;
      exp?: string | number;
      /** null = ไม่มี iat */
      iat?: number | null;
      extra?: Record<string, unknown>;
    } = {},
    signer = key.privateKey,
  ) => {
    const jwt = new SignJWT({
      email: 'staff@core.local',
      role: 'staff',
      sid: 's1',
      ...over.extra,
    }).setProtectedHeader({
      alg: over.alg ?? 'RS256',
      ...(over.kid === null ? {} : { kid: over.kid ?? 'core-hub-2026' }),
    });
    if (over.sub !== null) jwt.setSubject(over.sub ?? 'user-003');
    if (over.iat !== null) jwt.setIssuedAt(over.iat ?? now());
    return jwt
      .setIssuer(over.iss ?? 'core-hub')
      .setAudience(over.aud ?? 'csmju2030')
      .setExpirationTime(over.exp ?? (over.iat ?? now()) + 900)
      .sign(signer);
  };

  const reason = async (t: string) => {
    try {
      await verifier.verify(t);
      return 'accepted';
    } catch (e) {
      return e instanceof TokenRejectedError ? e.reason : 'other';
    }
  };

  beforeAll(async () => {
    key = await generateKeyPair('RS256');
    foreign = await generateKeyPair('RS256');
    await exportJWK(key.publicKey);
    const jwks = {
      getKey: async (kid: string) => {
        if (kid === 'core-hub-2026') return key.publicKey;
        throw new TokenRejectedError('unknown_kid', kid);
      },
    } as unknown as JwksService;
    const config = { get: (k: string) => CONFIG[k] } as unknown as AppConfig;
    verifier = new CoreHubTokenVerifier(config, jwks);
  });

  it('รับ token ที่ถูกต้องและคืน claim', async () => {
    const claims = await verifier.verify(await token());
    expect(claims).toMatchObject({ sub: 'user-003', role: 'staff', email: 'staff@core.local' });
  });

  it.each([
    ['ไม่ใช่ JWT', async () => 'not-a-token', 'malformed_token'],
    ['kid ไม่รู้จัก', async () => token({ kid: 'core-hub-1999' }), 'unknown_kid'],
    ['ไม่มี kid', async () => token({ kid: null }), 'missing_kid'],
    ['issuer ผิด', async () => token({ iss: 'evil' }), 'invalid_issuer'],
    ['audience ผิด', async () => token({ aud: 'other' }), 'invalid_audience'],
    ['หมดอายุ', async () => token({ iat: now() - 1000, exp: now() - 120 }), 'expired'],
    ['ไม่มี sub', async () => token({ sub: null }), 'invalid_claims'],
    ['sub ว่าง', async () => token({ sub: '   ' }), 'invalid_claims'],
    ['sub ยาวเกิน 64', async () => token({ sub: `user-${'9'.repeat(60)}` }), 'invalid_claims'],
    // ขั้น 9 — อายุ token
    ['ไม่มี iat', async () => token({ iat: null, exp: now() + 900 }), 'token_lifetime_exceeded'],
    [
      'อายุ 7 วัน (refresh token)',
      async () => token({ exp: now() + 7 * 86_400 }),
      'token_lifetime_exceeded',
    ],
    [
      'อายุ 961 วินาที (เกิน 900 + 60)',
      async () => token({ iat: now(), exp: now() + 961 }),
      'token_lifetime_exceeded',
    ],
    // ขั้น 10 — azp
    ['azp ของระบบอื่น', async () => token({ extra: { azp: 'csmju-equipment' } }), 'invalid_azp'],
    ['azp ไม่ใช่ string', async () => token({ extra: { azp: 42 } }), 'invalid_azp'],
  ])('ปฏิเสธ: %s', async (_name, make, expected) => {
    expect(await reason(await make())).toBe(expected);
  });

  it('sub เป็น string ทึบ (ไม่ใช่ UUID) และยาวได้ถึง 64 ตัว', async () => {
    expect(await reason(await token({ sub: 'user-6304101234' }))).toBe('accepted');
    expect(await reason(await token({ sub: `u${'x'.repeat(63)}` }))).toBe('accepted');
  });

  it('ขั้น 9: อายุ 900 + 60 วินาทีพอดียังรับ', async () => {
    const iat = now();
    expect(await reason(await token({ iat, exp: iat + 960 }))).toBe('accepted');
  });

  it('ขั้น 10: azp ตรงกับ SUBSYSTEM_ID รับ · ไม่มี azp รับ (ตรวจเมื่อมีเท่านั้น)', async () => {
    expect(await reason(await token({ extra: { azp: 'csmju-quiz' } }))).toBe('accepted');
    expect(await reason(await token())).toBe('accepted');
  });

  it('ไม่ปฏิเสธ token เพราะมี claim อื่นเพิ่มมา', async () => {
    const claims = await verifier.verify(
      await token({ extra: { faculty: 'SCI', permissions: ['x'], nested: { a: 1 } } }),
    );
    expect(claims.sub).toBe('user-003');
  });

  it('ปฏิเสธลายเซ็นจากกุญแจอื่น', async () => {
    expect(await reason(await token({}, foreign.privateKey))).toBe('invalid_signature');
  });

  it('ปฏิเสธ alg=none และ payload ที่ถูกแก้', async () => {
    const good = await token();
    const [, payload, sig] = good.split('.');
    const none = `${Buffer.from(JSON.stringify({ alg: 'none', kid: 'core-hub-2026' })).toString('base64url')}.${payload}.`;
    expect(await reason(none)).toBe('unsupported_algorithm');

    const tampered = JSON.parse(Buffer.from(payload, 'base64url').toString());
    tampered.role = 'admin';
    const forged = `${good.split('.')[0]}.${Buffer.from(JSON.stringify(tampered)).toString('base64url')}.${sig}`;
    expect(await reason(forged)).toBe('invalid_signature');
  });

  it('ปฏิเสธอัลกอริทึมอื่นที่ไม่ใช่ RS256', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS512', kid: 'core-hub-2026' })).toString(
      'base64url',
    );
    const [, payload, sig] = (await token()).split('.');
    expect(await reason(`${header}.${payload}.${sig}`)).toBe('unsupported_algorithm');
  });
});

// Core Hub ปลอมสำหรับ e2e เท่านั้น: เผยแพร่ JWKS และเซ็น token ด้วยคู่กุญแจชั่วคราว
// token มี iat/exp จริง (อายุ 900 วินาทีตามสัญญา) และใส่ azp ได้ — ใช้ทดสอบขั้น 9–10 ของ auth-contract ข้อ 4
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, SignJWT, type KeyLike } from 'jose';

export interface TokenOptions {
  /** claim azp (ไม่ใส่ = ไม่มี azp แบบ Core Hub ปัจจุบัน) */
  azp?: string;
  /** อายุ token exp − iat (วินาที) · ค่าเริ่มต้น 900 */
  lifetimeSec?: number;
  /** ไม่ใส่ iat เลย (ต้องถูกปฏิเสธที่ขั้น 9) */
  omitIat?: boolean;
}

export interface FakeCoreHub {
  url: string;
  token(
    // string อื่น = core role ที่ระบบนี้แมปไม่ได้ (ทดสอบ 403)
    role: 'student' | 'alumni' | 'staff' | 'lecturer' | 'guest' | 'admin' | (string & {}),
    sub?: string,
    options?: TokenOptions,
  ): Promise<string>;
  close(): Promise<void>;
}

export async function startFakeCoreHub(): Promise<FakeCoreHub> {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'core-hub-2026', use: 'sig', alg: 'RS256' };

  const server: Server = createServer((req, res) => {
    if (req.url === '/api/v1/.well-known/jwks.json') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;

  const subs = {
    admin: 'user-001',
    student: 'user-002',
    staff: 'user-003',
    alumni: 'user-004',
    lecturer: 'user-005',
    guest: 'user-006',
  };
  const sign = (key: KeyLike, role: string, sub: string, options: TokenOptions = {}) => {
    const iat = Math.floor(Date.now() / 1000);
    const claims: Record<string, unknown> = { email: `${role}@core.local`, role, sid: `s-${sub}` };
    if (options.azp !== undefined) claims.azp = options.azp;
    const jwt = new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: 'core-hub-2026' })
      .setSubject(sub)
      .setIssuer('core-hub')
      .setAudience('csmju2030')
      .setExpirationTime(iat + (options.lifetimeSec ?? 900));
    if (!options.omitIat) jwt.setIssuedAt(iat);
    return jwt.sign(key);
  };

  return {
    url: `http://127.0.0.1:${port}`,
    token: (role, sub, options) =>
      sign(privateKey, role, sub ?? subs[role as keyof typeof subs] ?? `user-${role}`, options),
    close: () => new Promise((r) => server.close(() => r())),
  };
}

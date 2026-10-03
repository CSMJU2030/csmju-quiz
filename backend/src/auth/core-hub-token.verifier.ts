// ตรวจ access token ของ Core Hub ครบ 10 ขั้น (auth-contract.md 1.2 ข้อ 4 · standards 1.7.0) — ห้ามข้ามขั้นแม้ใน dev
//  1 อ่าน token (ทำใน token-extractor)   2 ถอด header อ่าน alg/kid (ยังไม่เชื่อ payload)
//  3 บังคับ alg === RS256                 4 หา public key จาก JWKS ตาม kid
//  5 ตรวจลายเซ็น (allow-list ซ้ำอีกชั้น)   6 ตรวจ iss และ aud
//  7 ตรวจ exp (clock skew ≤ 60 วินาที)    8 ต้องมี sub ที่ไม่ว่าง (string ทึบ ≤ 64 ตัว · ไม่ใช่ UUID เสมอไป)
//  9 อายุ token: ต้องมี iat และ exp − iat ≤ 900 + 60 วินาที (กัน refresh token)
// 10 azp: ถ้ามี ต้องเท่ากับ SUBSYSTEM_ID (กัน token ที่ออกให้ระบบอื่น)
// claim อื่นที่ Core Hub เพิ่มมา ไม่ทำให้ปฏิเสธ (jwt-contract.json mustIgnore)
import { Injectable } from '@nestjs/common';
import { decodeProtectedHeader, errors as joseErrors, jwtVerify, type JWTPayload } from 'jose';
import { AppConfig } from '../config/app-config.service';
import { TokenRejectedError } from './auth.errors';
import type { VerifiedClaims } from './core-hub-identity';
import { JwksService } from './jwks.service';

// ค่าจาก standards/contracts/jwt-contract.json (algorithm · clockToleranceSeconds · maxTokenLifetimeSeconds)
const REQUIRED_ALG = 'RS256';
const MAX_CLOCK_SKEW_SEC = 60;
const MAX_TOKEN_LIFETIME_SEC = 900;
/** sub เป็น string ทึบยาวไม่เกิน 64 (auth-contract ข้อ 3) */
const MAX_SUB_LENGTH = 64;

@Injectable()
export class CoreHubTokenVerifier {
  constructor(
    private readonly config: AppConfig,
    private readonly jwks: JwksService,
  ) {}

  async verify(token: string): Promise<VerifiedClaims> {
    // 2 — header
    let header: { alg?: string; kid?: string };
    try {
      if (token.split('.').length !== 3) throw new Error('not a JWS');
      header = decodeProtectedHeader(token);
    } catch {
      throw new TokenRejectedError('malformed_token');
    }

    // 3 — algorithm (ปฏิเสธ none และอัลกอริทึมอื่นทั้งหมด)
    if (header.alg !== REQUIRED_ALG)
      throw new TokenRejectedError('unsupported_algorithm', header.kid ?? null);

    const kid = typeof header.kid === 'string' && header.kid ? header.kid : null;
    if (!kid) throw new TokenRejectedError('missing_kid');

    // 4 — key by kid
    const key = await this.jwks.getKey(kid);

    // 5–7 — signature · iss/aud · exp
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, key, {
        algorithms: [REQUIRED_ALG],
        issuer: this.config.get('CORE_HUB_ISSUER'),
        audience: this.config.get('CORE_HUB_AUDIENCE'),
        clockTolerance: Math.min(this.config.get('JWT_CLOCK_TOLERANCE_SEC'), MAX_CLOCK_SKEW_SEC),
        // iat ไม่อยู่ใน requiredClaims — ขาด iat ต้องได้ reason ของขั้น 9 (token_lifetime_exceeded)
        requiredClaims: ['exp', 'iss', 'aud', 'sub'],
      }));
    } catch (error) {
      throw new TokenRejectedError(this.reasonOf(error), kid);
    }

    const { sub, email, role, sid, exp, iat, azp } = payload as JWTPayload & {
      email?: unknown;
      role?: unknown;
      sid?: unknown;
      azp?: unknown;
    };

    // 8 — subject (string ทึบ ห้าม validate เป็น UUID) + claim ที่ระบบนี้ใช้
    if (typeof sub !== 'string' || !sub.trim() || sub.length > MAX_SUB_LENGTH) {
      throw new TokenRejectedError('invalid_claims', kid);
    }
    if (typeof role !== 'string' || !role) throw new TokenRejectedError('invalid_claims', kid);
    if (typeof exp !== 'number') throw new TokenRejectedError('invalid_claims', kid);

    // 9 — อายุ token (exp − iat) · ไม่มี iat ถือว่าไม่ผ่านขั้นนี้
    if (
      typeof iat !== 'number' ||
      !Number.isFinite(iat) ||
      exp - iat > MAX_TOKEN_LIFETIME_SEC + MAX_CLOCK_SKEW_SEC
    ) {
      throw new TokenRejectedError('token_lifetime_exceeded', kid);
    }

    // 10 — azp (ตรวจเมื่อมี · เวอร์ชันถัดไปจะบังคับให้ต้องมี)
    if (azp !== undefined && azp !== this.config.get('SUBSYSTEM_ID')) {
      throw new TokenRejectedError('invalid_azp', kid);
    }

    return {
      sub,
      email: typeof email === 'string' ? email : '',
      role,
      sid: typeof sid === 'string' ? sid : undefined,
      exp,
      iat,
    };
  }

  private reasonOf(error: unknown) {
    if (error instanceof joseErrors.JWTExpired) return 'expired' as const;
    if (error instanceof joseErrors.JWTClaimValidationFailed) {
      if (error.claim === 'iss') return 'invalid_issuer' as const;
      if (error.claim === 'aud') return 'invalid_audience' as const;
      return 'invalid_claims' as const;
    }
    if (error instanceof joseErrors.JOSEAlgNotAllowed) return 'unsupported_algorithm' as const;
    if (error instanceof joseErrors.JWSSignatureVerificationFailed)
      return 'invalid_signature' as const;
    if (error instanceof joseErrors.JWSInvalid || error instanceof joseErrors.JWTInvalid) {
      return 'malformed_token' as const;
    }
    return 'invalid_signature' as const;
  }
}

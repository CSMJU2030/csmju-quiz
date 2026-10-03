// เหตุผลที่ปฏิเสธ token / callback — รายการปิดจาก standards/contracts/log-events.json 1.1 (failureReasons)
export type TokenFailureReason =
  | 'missing_token'
  | 'malformed_token'
  | 'unsupported_algorithm'
  | 'missing_kid'
  | 'unknown_kid'
  | 'jwks_unavailable'
  | 'invalid_signature'
  | 'expired'
  | 'invalid_issuer'
  | 'invalid_audience'
  | 'invalid_claims'
  /** ขั้น 9 — ไม่มี iat หรือ exp − iat เกิน 900 + 60 วินาที (เช่น refresh token) */
  | 'token_lifetime_exceeded'
  /** ขั้น 10 — azp ไม่ตรงกับ SUBSYSTEM_ID */
  | 'invalid_azp';

/** callback ที่ state ไม่ผ่าน (auth-contract ข้อ 5.1) — log เป็น jwt.verification.failure ที่ path /auth/callback */
export type SsoStateFailureReason =
  'sso_restart_without_state' | 'sso_state_missing' | 'sso_state_mismatch';

export class TokenRejectedError extends Error {
  constructor(
    readonly reason: TokenFailureReason,
    readonly kid: string | null = null,
  ) {
    super(`token rejected: ${reason}`);
    this.name = 'TokenRejectedError';
  }
}

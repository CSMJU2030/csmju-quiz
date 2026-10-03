// JWKS client ของ Core Hub (auth-contract.md ข้อ 4.1)
// - แคชกุญแจ (TTL) ไม่ยิง Core Hub ทุก request
// - เลือกกุญแจจาก header.kid เสมอ · เจอ kid ไม่รู้จัก → รีเฟรช "หนึ่งครั้ง" แล้วค่อยปฏิเสธ
// - จำกัดอัตรารีเฟรช ≥ 30 วินาที · Core Hub ล่ม → ใช้กุญแจที่แคชไว้ต่อ
// - ปฏิเสธ JWK ที่มี private material (d) หรือไม่ใช่ RSA
import { Injectable } from '@nestjs/common';
import { importJWK, type JWK, type KeyLike } from 'jose';
import { AppConfig } from '../config/app-config.service';
import { logEvent } from '../common/logger';
import { TokenRejectedError } from './auth.errors';

type RefreshReason = 'startup' | 'ttl_expired' | 'unknown_kid';

@Injectable()
export class JwksService {
  private keys = new Map<string, KeyLike | Uint8Array>();
  private fetchedAt = 0;
  private lastAttemptAt = 0;
  private inFlight: Promise<void> | null = null;

  constructor(private readonly config: AppConfig) {}

  get knownKids() {
    return [...this.keys.keys()];
  }

  async getKey(kid: string): Promise<KeyLike | Uint8Array> {
    const ttl = this.config.get('JWKS_CACHE_TTL_MS');
    if (this.keys.size === 0) {
      await this.refresh('startup');
    } else if (Date.now() - this.fetchedAt > ttl) {
      await this.refresh('ttl_expired');
    }

    let key = this.keys.get(kid);
    if (key) return key;

    logEvent('jwks.unknown_kid', { kid, knownKids: this.knownKids });
    await this.refresh('unknown_kid');
    key = this.keys.get(kid);
    if (key) return key;

    throw new TokenRejectedError(this.keys.size === 0 ? 'jwks_unavailable' : 'unknown_kid', kid);
  }

  private async refresh(reason: RefreshReason) {
    const minInterval = this.config.get('JWKS_MIN_REFRESH_INTERVAL_MS');
    if (this.inFlight) return this.inFlight;
    if (this.lastAttemptAt && Date.now() - this.lastAttemptAt < minInterval) return;

    this.lastAttemptAt = Date.now();
    this.inFlight = this.load(reason).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async load(reason: RefreshReason) {
    const url = this.config.get('CORE_HUB_JWKS_URL');
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(this.config.get('JWKS_REQUEST_TIMEOUT_MS')),
        headers: { accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`status ${res.status}`);

      // RFC 7517 ดิบ: { keys: [...] } ที่ระดับบนสุด
      const body = (await res.json()) as { keys?: unknown };
      if (!body || !Array.isArray(body.keys)) throw new Error('invalid JWKS shape');

      const next = new Map<string, KeyLike | Uint8Array>();
      for (const raw of body.keys as JWK[]) {
        if (!raw || typeof raw.kid !== 'string' || !raw.kid) continue;
        if (raw.kty !== 'RSA') continue;
        if ('d' in raw || 'p' in raw || 'q' in raw) continue; // มีกุญแจส่วนตัว → ไม่รับ
        if (raw.alg && raw.alg !== 'RS256') continue;
        if (raw.use && raw.use !== 'sig') continue;
        next.set(raw.kid, await importJWK({ ...raw, alg: 'RS256' }, 'RS256'));
      }
      if (next.size === 0) throw new Error('no usable signing keys');

      this.keys = next;
      this.fetchedAt = Date.now();
      logEvent('jwks.refresh', { reason, keyCount: next.size, kids: this.knownKids });
    } catch (error) {
      logEvent('jwks.refresh.failure', {
        reason,
        cachedKeyCount: this.keys.size,
        error: error instanceof Error ? error.message : 'unknown',
      });
      // เก็บกุญแจเดิมไว้ใช้ต่อ (Core Hub ล่มชั่วคราว)
    }
  }
}

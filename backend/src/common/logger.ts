// structured log — JSON บรรทัดเดียว (standards/docs/logging.md)
// ห้าม log token, Authorization header, รหัสผ่าน หรือกุญแจ — อ้างถึง token ได้เฉพาะ kid และ sub
import { LoggerService } from '@nestjs/common';

export type AuthLogEvent =
  | 'subsystem.started'
  | 'jwks.refresh'
  | 'jwks.refresh.failure'
  | 'jwks.unknown_kid'
  | 'jwt.verification.success'
  | 'jwt.verification.failure'
  | 'authorization.role_mapping_failed'
  | 'authorization.denied';

const TOKEN_LIKE = /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*\.?[A-Za-z0-9_-]*/g;

function scrub(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(TOKEN_LIKE, '[redacted]');
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([k]) => !/^(authorization|access_?token|token|password|cookie)$/i.test(k))
        .map(([k, v]) => [k, scrub(v)]),
    );
  }
  return value;
}

function write(line: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify(scrub({ ...line, at: new Date().toISOString() }))}\n`);
}

/** event ด้าน auth จากรายการปิดใน standards/contracts/log-events.json */
export function logEvent(event: AuthLogEvent, fields: Record<string, unknown>) {
  write({ event, ...fields });
}

/** log ทั่วไปของแอป (ไม่ใช่ event ด้าน auth) */
export function logApp(
  level: 'info' | 'warn' | 'error',
  message: string,
  fields: Record<string, unknown> = {},
) {
  write({ level, message, ...fields });
}

/** ให้ log ของ NestJS เองออกเป็น JSON ด้วย */
export class JsonLogger implements LoggerService {
  log(message: unknown, context?: string) {
    write({ level: 'info', message: String(message), context });
  }
  error(message: unknown, _trace?: string, context?: string) {
    // ไม่พิมพ์ stack ลง log ของ request เพื่อไม่ให้ข้อมูลภายในรั่ว — ใช้ message พอ
    write({ level: 'error', message: String(message), context });
  }
  warn(message: unknown, context?: string) {
    write({ level: 'warn', message: String(message), context });
  }
  debug() {}
  verbose() {}
}

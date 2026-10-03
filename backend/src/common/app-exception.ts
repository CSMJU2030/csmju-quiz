import { HttpException } from '@nestjs/common';
import { HTTP_STATUS_OF, type ErrorCode, errorBody } from './envelope';

/** exception ที่ผูก error.code จากรายการปิด — ใช้แทน HttpException ตรง ๆ ในโค้ดธุรกิจ */
export class AppException extends HttpException {
  /** guard log event ด้าน auth ของ exception นี้ไปแล้ว — exception filter ไม่ต้อง log ซ้ำ */
  logged = false;

  /** วินาทีสำหรับ header Retry-After (429 · 503) — ไม่ระบุ = ค่าเริ่มต้นใน DEFAULT_RETRY_AFTER_SEC */
  retryAfterSec?: number;

  constructor(
    readonly errorCode: ErrorCode,
    message: string,
    readonly details?: string[],
  ) {
    super(errorBody(errorCode, message, details), HTTP_STATUS_OF[errorCode]);
  }
}

/** สร้าง exception ที่ log event ด้าน auth ไปแล้ว (ใช้ใน guard) */
export function loggedException(errorCode: ErrorCode, message: string) {
  const e = new AppException(errorCode, message);
  e.logged = true;
  return e;
}

export const Errors = {
  notFound: (what = 'Resource') => new AppException('NOT_FOUND', `${what} not found`),
  forbidden: (message = 'You do not have permission to perform this action') =>
    new AppException('FORBIDDEN', message),
  conflict: (message: string, details?: string[]) => new AppException('CONFLICT', message, details),
  validation: (details: string[]) =>
    new AppException('VALIDATION_ERROR', 'Request validation failed', details),
  unauthorized: (message = 'Missing or invalid token') => new AppException('UNAUTHORIZED', message),
  badRequest: (message: string) => new AppException('BAD_REQUEST', message),
  tooManyRequests: (retryAfterSec?: number) =>
    withRetryAfter(
      new AppException('TOO_MANY_REQUESTS', 'Too many requests, please try again later'),
      retryAfterSec,
    ),
  serviceUnavailable: (retryAfterSec?: number) =>
    withRetryAfter(
      new AppException(
        'SERVICE_UNAVAILABLE',
        'Service temporarily unavailable, please try again later',
      ),
      retryAfterSec,
    ),
};

function withRetryAfter(e: AppException, retryAfterSec?: number) {
  if (retryAfterSec !== undefined) e.retryAfterSec = Math.max(1, Math.ceil(retryAfterSec));
  return e;
}

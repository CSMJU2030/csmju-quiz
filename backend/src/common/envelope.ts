// response envelope มาตรฐาน (api-conventions.md ข้อ 3–4)
// { success: true, data[, meta] } · { success: false, error: { code, message[, details] } }

// รายการปิด 9 ค่าตาม standards/contracts/error-codes.json 1.1 (standards 1.7.0) — ห้ามคิดค่าใหม่
export const ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  /** 429 · ต้องมี header Retry-After (วินาที ≥ 1) */
  'TOO_MANY_REQUESTS',
  'INTERNAL_ERROR',
  /** 503 · สิ่งที่พึ่งพาไม่พร้อมชั่วคราว (เช่น DB pool เต็ม) · ต้องมี Retry-After · ห้ามใช้แทน 500 ของบั๊ก */
  'SERVICE_UNAVAILABLE',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const HTTP_STATUS_OF: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

/** code ที่ต้องมี header Retry-After และค่าเริ่มต้น (วินาที) ถ้าผู้โยนไม่ได้ระบุ */
export const DEFAULT_RETRY_AFTER_SEC: Partial<Record<ErrorCode, number>> = {
  TOO_MANY_REQUESTS: 60,
  SERVICE_UNAVAILABLE: 5,
};

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** คืนค่านี้จาก controller เมื่อเป็น collection — interceptor จะใส่ meta ให้ */
export class Paginated<T> {
  constructor(
    readonly items: T[],
    readonly meta: PageMeta,
  ) {}

  static of<T>(items: T[], total: number, page: number, limit: number) {
    return new Paginated(items, { total, page, limit, totalPages: Math.ceil(total / limit) });
  }
}

export function successBody(data: unknown, meta?: PageMeta) {
  return meta ? { success: true as const, data, meta } : { success: true as const, data };
}

export function errorBody(code: ErrorCode, message: string, details?: string[]) {
  return {
    success: false as const,
    error: details && details.length ? { code, message, details } : { code, message },
  };
}

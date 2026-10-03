import { ParseUUIDPipe } from '@nestjs/common';
import { Errors } from './app-exception';

/** path param ต้องเป็น UUID v4 — ไม่ใช่ → 400 VALIDATION_ERROR */
export const UuidParam = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => Errors.validation(['id must be a UUID v4']),
});

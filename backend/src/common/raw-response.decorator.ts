import { SetMetadata } from '@nestjs/common';
import { RAW_RESPONSE } from './envelope.interceptor';

/** route นี้ตอบเอง (SSE / redirect) ไม่ต้องห่อ envelope */
export const RawResponse = () => SetMetadata(RAW_RESPONSE, true);

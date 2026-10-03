import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'csmju:is-public';

/**
 * ใช้ได้เฉพาะ endpoint ที่ประกาศใน public_endpoints ของ subsystem.yaml:
 * GET /api/health · GET /auth/callback · endpoint ของผู้เล่นใน /api/v1/guest-games (ตรวจบัตรเข้าห้องเอง)
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);

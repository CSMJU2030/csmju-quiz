import { SetMetadata } from '@nestjs/common';
import type { PermissionName } from '../permissions';

export const REQUIRED_PERMISSIONS = 'csmju:required-permissions';

/** ต้องมี permission อย่างน้อยหนึ่งข้อ (any-of) — ownership ตรวจต่อใน service */
export const RequirePermissions = (...permissions: PermissionName[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);

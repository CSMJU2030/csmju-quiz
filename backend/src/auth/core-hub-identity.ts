import type { PermissionName } from './permissions';
import type { CoreRole, SubsystemRole } from './role-mapping';

/** ตัวตนที่ผ่านการตรวจลายเซ็นแล้ว — แหล่งเดียวที่โค้ดธุรกิจเชื่อได้ */
export interface CoreHubIdentity {
  /** ค่า sub จาก token (Global Identity) */
  coreUserId: string;
  email: string;
  coreRole: CoreRole | string;
  subsystemRole: SubsystemRole;
  permissions: PermissionName[];
  /** exp ของ token (epoch seconds) */
  exp: number;
}

export interface VerifiedClaims {
  sub: string;
  email: string;
  role: string;
  sid?: string;
  exp: number;
  iat: number;
}

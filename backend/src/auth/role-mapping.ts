// core role → subsystem role
// ⚠️ ต้องตรงกับ default_role_mapping ในทะเบียน Core Hub และ frontend/src/lib/permissions.ts
// key = core role ที่เข้าระบบนี้ได้ · core role ที่ไม่มีในตาราง = 403 (authorization.md ข้อ 3)
// core role ครบ 6 ค่าตาม standards 1.7.0 (authorization.md ข้อ 2 · vocabulary.json coreRoles)

export const CORE_ROLES = ['student', 'alumni', 'staff', 'lecturer', 'guest', 'admin'] as const;
export type CoreRole = (typeof CORE_ROLES)[number];

export const CORE_ROLE_TO_SUBSYSTEM_ROLE = {
  student: 'PLAYER',
  alumni: 'PLAYER',
  guest: 'PLAYER',
  staff: 'HOST',
  lecturer: 'HOST',
  admin: 'ADMIN',
} as const satisfies Record<CoreRole, string>;

export type SubsystemRole =
  (typeof CORE_ROLE_TO_SUBSYSTEM_ROLE)[keyof typeof CORE_ROLE_TO_SUBSYSTEM_ROLE];

export function mapCoreRole(coreRole: string): SubsystemRole | null {
  return Object.prototype.hasOwnProperty.call(CORE_ROLE_TO_SUBSYSTEM_ROLE, coreRole)
    ? CORE_ROLE_TO_SUBSYSTEM_ROLE[coreRole as keyof typeof CORE_ROLE_TO_SUBSYSTEM_ROLE]
    : null;
}

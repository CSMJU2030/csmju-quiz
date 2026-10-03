// src/lib/permissions.ts
// การแสดงผลตามสิทธิ์ Layer 2 ฝั่งหน้าจอ (ui-design-system.md ข้อ 10 · authorization.md ข้อ 4)
// หน้าเว็บใช้ตารางนี้แค่ "ซ่อนสิ่งที่ผู้ใช้ทำไม่ได้" — การบังคับสิทธิ์จริงอยู่ที่ backend เสมอ
// ตารางต้องตรงกับ backend/src/auth/permissions.ts และ default_role_mapping ในทะเบียน Core Hub

export type CoreRole = "student" | "alumni" | "staff" | "lecturer" | "guest" | "admin";

export type SubsystemRole = "PLAYER" | "HOST" | "ADMIN";

/** core role → subsystem role (key = core role ที่เข้าระบบนี้ได้ · ครบ 6 ค่าตาม standards 1.0.6) */
export const CORE_ROLE_TO_SUBSYSTEM_ROLE: Record<CoreRole, SubsystemRole> = {
  student: "PLAYER",
  alumni: "PLAYER",
  guest: "PLAYER",
  staff: "HOST",
  lecturer: "HOST",
  admin: "ADMIN",
};

export const Permission = {
  QUIZ_READ_OWN: "quiz:read:own",
  QUIZ_MANAGE_OWN: "quiz:manage:own",
  QUESTION_BANK_MANAGE_OWN: "question-bank:manage:own",
  GAME_HOST: "game:host",
  GAME_JOIN: "game:join",
  GAME_HISTORY_READ_OWN: "game-history:read:own",
  REPORT_READ_OWN: "report:read:own",
} as const;

export type PermissionName = (typeof Permission)[keyof typeof Permission];

const HOST_PERMISSIONS: PermissionName[] = [
  Permission.QUIZ_READ_OWN,
  Permission.QUIZ_MANAGE_OWN,
  Permission.QUESTION_BANK_MANAGE_OWN,
  Permission.GAME_HOST,
  Permission.GAME_JOIN,
  Permission.GAME_HISTORY_READ_OWN,
  Permission.REPORT_READ_OWN,
];

export const ROLE_PERMISSIONS: Record<SubsystemRole, PermissionName[]> = {
  PLAYER: [Permission.GAME_JOIN, Permission.GAME_HISTORY_READ_OWN],
  HOST: HOST_PERMISSIONS,
  ADMIN: HOST_PERMISSIONS,
};

/**
 * คำเรียก core role (claim role) — ui-design-system.md ข้อ 10.3 ห้ามแปลเอง
 * lecturer / guest ยังไม่อยู่ในตารางข้อ 10.3 จึงใช้คำจาก authorization.md ข้อ 2
 */
export const CORE_ROLE_LABELS: Record<CoreRole, string> = {
  student: "นักศึกษา",
  alumni: "ศิษย์เก่า",
  staff: "บุคลากร/อาจารย์",
  lecturer: "อาจารย์",
  guest: "ผู้เยี่ยมชม",
  admin: "ผู้ดูแลระบบ",
};

export function coreRoleLabel(role: string): string {
  return (CORE_ROLE_LABELS as Record<string, string>)[role] ?? role;
}

/** บทบาทในระบบนี้ (Layer 2) — แสดงต่อท้าย core role */
export const ROLE_LABELS: Record<SubsystemRole, string> = {
  PLAYER: "ผู้เล่น",
  HOST: "ผู้สอน",
  ADMIN: "ผู้ดูแลระบบ",
};

/** ยังไม่รู้ว่าเป็นใคร (กำลังโหลด / ไม่ได้ล็อกอิน) = ไม่แสดง */
export function hasPermission(role: SubsystemRole | null | undefined, permission: PermissionName) {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

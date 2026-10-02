// permission ของโดเมน CSMJU Quiz — รูปแบบ <resource>:<action>[:own|:any] (authorization.md ข้อ 4)
// guard ตรวจว่ามีอย่างน้อยหนึ่งข้อ · service ต้องตรวจ ownership กับข้อมูลจริงอีกชั้นเสมอ
// "ของตัวเอง" = record.owner_core_user_id / host_core_user_id === token.sub
import type { SubsystemRole } from './role-mapping';

export const Permission = {
  QUIZ_READ_OWN: 'quiz:read:own',
  QUIZ_READ_ANY: 'quiz:read:any',
  QUIZ_MANAGE_OWN: 'quiz:manage:own',
  QUIZ_MANAGE_ANY: 'quiz:manage:any',
  QUESTION_BANK_MANAGE_OWN: 'question-bank:manage:own',
  GAME_HOST: 'game:host',
  GAME_MANAGE_ANY: 'game:manage:any',
  GAME_JOIN: 'game:join',
  /** ประวัติการเล่นและสถิติของตัวเอง (ทุก role ที่เล่นเกมได้ · เฉพาะเกมที่เข้าด้วยบัญชี) */
  GAME_HISTORY_READ_OWN: 'game-history:read:own',
  REPORT_READ_OWN: 'report:read:own',
  REPORT_READ_ANY: 'report:read:any',
} as const;

export type PermissionName = (typeof Permission)[keyof typeof Permission];

const HOST: PermissionName[] = [
  Permission.QUIZ_READ_OWN,
  Permission.QUIZ_MANAGE_OWN,
  Permission.QUESTION_BANK_MANAGE_OWN,
  Permission.GAME_HOST,
  Permission.GAME_JOIN,
  Permission.GAME_HISTORY_READ_OWN,
  Permission.REPORT_READ_OWN,
];

/** เมทริกซ์สิทธิ์ (ที่เดียวในระบบ) */
export const ROLE_PERMISSIONS: Record<SubsystemRole, readonly PermissionName[]> = {
  PLAYER: [Permission.GAME_JOIN, Permission.GAME_HISTORY_READ_OWN],
  HOST,
  ADMIN: [
    ...HOST,
    Permission.QUIZ_READ_ANY,
    Permission.QUIZ_MANAGE_ANY,
    Permission.GAME_MANAGE_ANY,
    Permission.REPORT_READ_ANY,
  ],
};

export function permissionsOf(role: SubsystemRole): PermissionName[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function hasPermission(role: SubsystemRole, permission: PermissionName) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

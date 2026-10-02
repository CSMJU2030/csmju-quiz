import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../common/app-exception';
import { PermissionsGuard } from './guards/permissions.guard';
import { Permission, hasPermission, permissionsOf } from './permissions';
import { mapCoreRole } from './role-mapping';

function ctx(user: unknown): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user, path: '/api/v1/quizzes' }) }),
  } as unknown as ExecutionContext;
}

describe('role mapping & permissions', () => {
  it('แมป core role ครบตามทะเบียน', () => {
    expect(mapCoreRole('student')).toBe('PLAYER');
    expect(mapCoreRole('alumni')).toBe('PLAYER');
    expect(mapCoreRole('guest')).toBe('PLAYER');
    expect(mapCoreRole('staff')).toBe('HOST');
    expect(mapCoreRole('lecturer')).toBe('HOST');
    expect(mapCoreRole('admin')).toBe('ADMIN');
    expect(mapCoreRole('teacher')).toBeNull();
    expect(mapCoreRole('__proto__')).toBeNull();
  });

  it('ผู้เล่นเข้าร่วมเกมได้แต่สร้างแบบทดสอบไม่ได้', () => {
    expect(hasPermission('PLAYER', Permission.GAME_JOIN)).toBe(true);
    expect(hasPermission('PLAYER', Permission.QUIZ_MANAGE_OWN)).toBe(false);
    expect(hasPermission('ADMIN', Permission.QUIZ_MANAGE_ANY)).toBe(true);
    expect(hasPermission('HOST', Permission.QUIZ_MANAGE_ANY)).toBe(false);
  });
});

describe('PermissionsGuard', () => {
  const reflector = new Reflector();
  const guard = new PermissionsGuard(reflector);

  it('สิทธิ์ไม่พอ → 403 FORBIDDEN (ไม่ใช่ 401)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.QUIZ_MANAGE_OWN]);
    const player = {
      coreUserId: 'user-002',
      subsystemRole: 'PLAYER',
      permissions: permissionsOf('PLAYER'),
    };
    let thrown: unknown;
    try {
      guard.canActivate(ctx(player));
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(AppException);
    expect((thrown as AppException).getStatus()).toBe(403);
    expect((thrown as AppException).errorCode).toBe('FORBIDDEN');
  });

  it('มีสิทธิ์อย่างน้อยหนึ่งข้อ → ผ่าน', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Permission.QUIZ_READ_OWN, Permission.QUIZ_READ_ANY]);
    const host = {
      coreUserId: 'user-003',
      subsystemRole: 'HOST',
      permissions: permissionsOf('HOST'),
    };
    expect(guard.canActivate(ctx(host))).toBe(true);
  });
});

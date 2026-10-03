// guard ชั้นที่ 2 (global) — รู้ว่าเป็นใครแล้วแต่สิทธิ์ไม่พอ → 403 เสมอ (ไม่ใช่ 401/404)
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { loggedException } from '../../common/app-exception';
import { logEvent } from '../../common/logger';
import type { CoreHubIdentity } from '../core-hub-identity';
import { REQUIRED_PERMISSIONS } from '../decorators/require-permissions.decorator';
import type { PermissionName } from '../permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionName[] | undefined>(
      REQUIRED_PERMISSIONS,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: CoreHubIdentity }>();
    const user = req.user;
    if (!user) return true; // route public — CoreHubJwtGuard ตัดสินแล้ว

    if (required.some((p) => user.permissions.includes(p))) return true;

    logEvent('authorization.denied', {
      sub: user.coreUserId,
      subsystemRole: user.subsystemRole,
      required,
      reason: 'missing_permission',
      path: req.path,
    });
    throw loggedException('FORBIDDEN', 'You do not have permission to perform this action');
  }
}

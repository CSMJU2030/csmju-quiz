// guard ชั้นที่ 1 (global) — ไม่รู้ว่าเป็นใคร → 401 · core role ที่แมปไม่ได้ → 403
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppException, loggedException } from '../../common/app-exception';
import { logEvent } from '../../common/logger';
import { TokenRejectedError } from '../auth.errors';
import { CoreHubTokenVerifier } from '../core-hub-token.verifier';
import type { CoreHubIdentity } from '../core-hub-identity';
import { IS_PUBLIC } from '../decorators/public.decorator';
import { permissionsOf } from '../permissions';
import { mapCoreRole } from '../role-mapping';
import { extractToken } from '../token-extractor';

@Injectable()
export class CoreHubJwtGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: CoreHubTokenVerifier,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: CoreHubIdentity }>();
    req.user = await authenticate(this.verifier, req, req.path);
    return true;
  }
}

/** ใช้ร่วมกันระหว่าง guard และ SSO callback */
export async function authenticate(
  verifier: CoreHubTokenVerifier,
  req: Pick<Request, 'headers'>,
  path: string,
  tokenOverride?: string,
): Promise<CoreHubIdentity> {
  const extracted = tokenOverride
    ? { kind: 'token' as const, token: tokenOverride }
    : extractToken(req);

  if (extracted.kind !== 'token') {
    const reason = extracted.kind === 'missing' ? 'missing_token' : 'malformed_token';
    logEvent('jwt.verification.failure', { reason, kid: null, path });
    throw new AppException('UNAUTHORIZED', 'Missing or invalid token');
  }

  let claims;
  try {
    claims = await verifier.verify(extracted.token);
  } catch (error) {
    const reason = error instanceof TokenRejectedError ? error.reason : 'invalid_signature';
    const kid = error instanceof TokenRejectedError ? error.kid : null;
    logEvent('jwt.verification.failure', { reason, kid, path });
    throw new AppException('UNAUTHORIZED', 'Missing or invalid token');
  }

  const subsystemRole = mapCoreRole(claims.role);
  if (!subsystemRole) {
    logEvent('authorization.role_mapping_failed', { sub: claims.sub, coreRole: claims.role });
    throw loggedException('FORBIDDEN', 'Your role cannot use this subsystem');
  }

  logEvent('jwt.verification.success', {
    sub: claims.sub,
    coreRole: claims.role,
    subsystemRole,
  });

  return {
    coreUserId: claims.sub,
    email: claims.email,
    coreRole: claims.role,
    subsystemRole,
    permissions: permissionsOf(subsystemRole),
    exp: claims.exp,
  };
}

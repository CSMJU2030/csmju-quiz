import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { CoreHubIdentity } from '../core-hub-identity';

export interface AuthedRequest {
  user?: CoreHubIdentity;
}

/** ตัวตนที่ guard ตรวจแล้ว */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): CoreHubIdentity => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user) throw new Error('CurrentUser used on a public route');
    return req.user;
  },
);

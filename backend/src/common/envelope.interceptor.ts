import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, type Observable } from 'rxjs';
import { Paginated, successBody } from './envelope';

export const RAW_RESPONSE = 'csmju:raw-response';

/** ห่อทุก response ด้วย envelope — ยกเว้น route ที่ติด @RawResponse() (เช่น SSE, redirect) */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const raw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (raw) return next.handle();

    return next
      .handle()
      .pipe(
        map((value: unknown) =>
          value instanceof Paginated
            ? successBody(value.items, value.meta)
            : successBody(value ?? null),
        ),
      );
  }
}

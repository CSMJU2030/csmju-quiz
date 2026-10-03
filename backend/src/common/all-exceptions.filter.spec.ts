import { HttpException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { Errors, loggedException } from './app-exception';

function run(
  exception: unknown,
  user?: { coreUserId: string; subsystemRole: string },
  presetHeaders: Record<string, string> = {},
) {
  const res = {
    headersSent: false,
    statusCode: 0,
    body: undefined as unknown,
    headers: { ...presetHeaders } as Record<string, string>,
    getHeader(name: string) {
      return this.headers[name.toLowerCase()];
    },
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  const req = { path: '/api/v1/game-sessions/x/start', user };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  };
  const logs: Record<string, unknown>[] = [];
  const write = jest.spyOn(process.stdout, 'write').mockImplementation((line) => {
    logs.push(JSON.parse(String(line)) as Record<string, unknown>);
    return true;
  });
  try {
    new AllExceptionsFilter().catch(exception, host as never);
  } finally {
    write.mockRestore();
  }
  return {
    status: res.statusCode,
    body: res.body as { error: { code: string } },
    headers: res.headers,
    logs,
  };
}

describe('AllExceptionsFilter', () => {
  it('4xx ที่ไม่อยู่ในตาราง (405 · 413) → 400 BAD_REQUEST ตาม httpMapping', () => {
    for (const status of [405, 413, 418]) {
      const r = run(new HttpException('x', status));
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe('BAD_REQUEST');
    }
    // error ของ body-parser (ไม่ใช่ HttpException) เช่น body ใหญ่เกิน
    const tooLarge = Object.assign(new Error('request entity too large'), {
      status: 413,
      type: 'entity.too.large',
    });
    expect(run(tooLarge)).toMatchObject({ status: 400, body: { error: { code: 'BAD_REQUEST' } } });
    const badJson = Object.assign(new SyntaxError('Unexpected token'), { status: 400 });
    expect(run(badJson).status).toBe(400);
  });

  it('Prisma P2003 (FK ชี้แถวที่ถูกลบ) → 404 · P2002 → 409', () => {
    expect(run({ code: 'P2003', name: 'PrismaClientKnownRequestError' })).toMatchObject({
      status: 404,
      body: { error: { code: 'NOT_FOUND' } },
    });
    expect(run({ code: 'P2002' })).toMatchObject({
      status: 409,
      body: { error: { code: 'CONFLICT' } },
    });
  });

  it.each(['P1001', 'P1002', 'P2024', 'P1017', 'P2037'])(
    'Prisma %s (ฐานข้อมูลไม่พร้อม/pool เต็ม) → 503 SERVICE_UNAVAILABLE + Retry-After',
    (code) => {
      const r = run({ code, name: 'PrismaClientKnownRequestError', message: 'pool timeout' });
      expect(r.status).toBe(503);
      expect(r.body.error.code).toBe('SERVICE_UNAVAILABLE');
      expect(Number(r.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    },
  );

  it('PrismaClientInitializationError (errorCode P1001) → 503', () => {
    const e = Object.assign(new Error("Can't reach database server"), {
      name: 'PrismaClientInitializationError',
      errorCode: 'P1001',
    });
    expect(run(e)).toMatchObject({ status: 503, body: { error: { code: 'SERVICE_UNAVAILABLE' } } });
  });

  it('error อื่นที่ไม่ใช่การต่อฐานข้อมูล → 500 INTERNAL_ERROR ไม่ใช่ 503 · ไม่มี Retry-After', () => {
    const r = run(new TypeError('boom'));
    expect(r.status).toBe(500);
    expect(r.body.error.code).toBe('INTERNAL_ERROR');
    expect(r.headers['retry-after']).toBeUndefined();
  });

  it('429 / 503 มี Retry-After เสมอ — ใช้ค่าที่ผู้โยนระบุ หรือคงค่าที่ตั้งไว้แล้ว', () => {
    const limited = run(Errors.tooManyRequests(17));
    expect(limited).toMatchObject({ status: 429, body: { error: { code: 'TOO_MANY_REQUESTS' } } });
    expect(limited.headers['retry-after']).toBe('17');
    expect(run(Errors.tooManyRequests(), undefined, { 'retry-after': '9' }).headers).toMatchObject({
      'retry-after': '9',
    });
    const down = run(Errors.serviceUnavailable());
    expect(down.status).toBe(503);
    expect(Number(down.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    expect(run(new HttpException('x', 503))).toMatchObject({
      status: 503,
      body: { error: { code: 'SERVICE_UNAVAILABLE' } },
    });
  });

  it('403 จากการตรวจ ownership ใน service → log authorization.denied (reason not_owner)', () => {
    const r = run(Errors.forbidden('Only the host can control this game'), {
      coreUserId: 'host-b',
      subsystemRole: 'HOST',
    });
    expect(r.status).toBe(403);
    expect(r.logs).toEqual([
      expect.objectContaining({
        event: 'authorization.denied',
        sub: 'host-b',
        subsystemRole: 'HOST',
        required: [],
        reason: 'not_owner',
        path: '/api/v1/game-sessions/x/start',
      }),
    ]);
  });

  it('403 ที่ guard log ไปแล้ว → ไม่ log ซ้ำ', () => {
    const r = run(loggedException('FORBIDDEN', 'nope'), { coreUserId: 'u', subsystemRole: 'X' });
    expect(r.status).toBe(403);
    expect(r.logs).toEqual([]);
  });
});

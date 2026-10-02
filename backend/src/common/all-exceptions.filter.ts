// แปลงทุก exception เป็น error envelope — error.code จากรายการปิดเท่านั้น
// ห้ามรั่ว stack trace / path / ข้อความ SQL ออกไปใน response (api-conventions.md ข้อ 4)
// status ที่ตอบต้องตรงกับ code ตาม httpMapping ของ contracts/error-codes.json เสมอ
//   4xx อื่นที่ไม่อยู่ในตาราง (เช่น 405, 413) → 400 BAD_REQUEST
// 429 / 503 มี header Retry-After (วินาที ≥ 1) เสมอ · DB ต่อไม่ได้/pool เต็มชั่วคราว → 503 SERVICE_UNAVAILABLE
// log ได้แค่ request.path (ไม่มี query) — ห้ามใช้ request.url / originalUrl (logging.md 1.1 ข้อ 3)
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { CoreHubIdentity } from '../auth/core-hub-identity';
import { AppException } from './app-exception';
import { DEFAULT_RETRY_AFTER_SEC, type ErrorCode, errorBody, HTTP_STATUS_OF } from './envelope';
import { logApp, logEvent } from './logger';

const CODE_OF_STATUS: Record<number, ErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

/**
 * error ของ Prisma ที่หมายถึง "ฐานข้อมูลไม่พร้อมชั่วคราว" → 503 + Retry-After (ไม่ใช่บั๊ก)
 *   P1001 ต่อ server ไม่ได้ · P1002 ต่อแล้วหมดเวลา · P1008 socket timeout · P1017 server ปิด connection
 *   P2024 รอ connection จาก pool เกินเวลา · P2037 connection เต็ม (too many connections)
 */
const PRISMA_UNAVAILABLE = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024', 'P2037']);
const DB_RETRY_AFTER_SEC = 5;

const DEFAULT_MESSAGE: Record<ErrorCode, string> = {
  BAD_REQUEST: 'Bad request',
  VALIDATION_ERROR: 'Request validation failed',
  UNAUTHORIZED: 'Missing or invalid token',
  FORBIDDEN: 'You do not have permission to perform this action',
  NOT_FOUND: 'Resource not found',
  CONFLICT: 'Request conflicts with the current state',
  TOO_MANY_REQUESTS: 'Too many requests, please try again later',
  INTERNAL_ERROR: 'Internal server error',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable, please try again later',
};

interface PrismaLikeError {
  code?: unknown;
  /** PrismaClientInitializationError ใช้ errorCode แทน code */
  errorCode?: unknown;
  name?: unknown;
}

function prismaCode(error: unknown): string | undefined {
  const e = error as PrismaLikeError;
  for (const c of [e?.code, e?.errorCode]) {
    if (typeof c === 'string' && /^P\d{4}$/.test(c)) return c;
  }
  return undefined;
}

type FilterResult = {
  status: number;
  body: ReturnType<typeof errorBody>;
  retryAfterSec?: number;
};

/** error ของ middleware ฝั่ง express (เช่น body-parser: 413 entity.too.large) มี status เป็นตัวเลข */
function middlewareStatus(error: unknown): number | undefined {
  const e = error as { status?: unknown; statusCode?: unknown };
  const status = typeof e?.status === 'number' ? e.status : e?.statusCode;
  return typeof status === 'number' && status >= 400 && status < 600 ? status : undefined;
}

function codeOfStatus(status: number): ErrorCode {
  return CODE_OF_STATUS[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (res.headersSent) return; // เช่น SSE ที่เริ่มส่งไปแล้ว

    const { status, body, retryAfterSec } = this.toResponse(exception);
    if (body.error.code === 'FORBIDDEN') this.logDenied(exception, host);
    const defaultRetry = DEFAULT_RETRY_AFTER_SEC[body.error.code];
    if (defaultRetry !== undefined && !res.getHeader('Retry-After')) {
      res.setHeader('Retry-After', String(retryAfterSec ?? defaultRetry));
    }
    res.status(status).json(body);
  }

  /**
   * 403 จากการตรวจ ownership ใน service (เช่น host B สั่งเกมของ host A) → authorization.denied
   * 403 ที่ guard log ไปแล้ว (missing_permission / role_mapping_failed) ไม่ log ซ้ำ
   */
  private logDenied(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof AppException && exception.logged) return;
    const req = host.switchToHttp().getRequest<Request & { user?: CoreHubIdentity }>();
    logEvent('authorization.denied', {
      sub: req.user?.coreUserId ?? null,
      subsystemRole: req.user?.subsystemRole ?? null,
      required: [],
      reason: 'not_owner',
      path: req.path,
    });
  }

  private toResponse(exception: unknown): FilterResult {
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        body: errorBody(exception.errorCode, exception.message, exception.details),
        retryAfterSec: exception.retryAfterSec,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = codeOfStatus(status);
      // ข้อความจาก Nest เอง (เช่น "Cannot GET /x") อาจมี path — ใช้ข้อความมาตรฐานแทน
      const message = status === 404 ? 'Route or resource not found' : DEFAULT_MESSAGE[code];
      return { status: HTTP_STATUS_OF[code], body: errorBody(code, message) };
    }

    const pc = prismaCode(exception);
    if (pc && PRISMA_UNAVAILABLE.has(pc)) {
      logApp('warn', 'database temporarily unavailable', { prismaCode: pc });
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        body: errorBody('SERVICE_UNAVAILABLE', DEFAULT_MESSAGE.SERVICE_UNAVAILABLE),
        retryAfterSec: DB_RETRY_AFTER_SEC,
      };
    }
    if (pc === 'P2002') {
      return { status: HttpStatus.CONFLICT, body: errorBody('CONFLICT', 'Value already exists') };
    }
    // P2025 = ไม่พบแถว · P2003 = foreign key ชี้ไปแถวที่ถูกลบไปแล้ว (เช่น เข้าห้องพร้อมกับที่ห้องถูกลบ)
    if (pc === 'P2025' || pc === 'P2003') {
      return { status: HttpStatus.NOT_FOUND, body: errorBody('NOT_FOUND', 'Resource not found') };
    }

    const ms = pc ? undefined : middlewareStatus(exception);
    if (ms !== undefined && ms < 500) {
      const code = codeOfStatus(ms);
      return {
        status: HTTP_STATUS_OF[code],
        body: errorBody(code, ms === 404 ? 'Route or resource not found' : DEFAULT_MESSAGE[code]),
      };
    }

    // ข้อความของ Prisma อาจมีค่าที่ผู้ใช้ส่งมา — log แค่ชื่อ error · code · ข้อความแบบตัดสั้น
    const message = exception instanceof Error ? exception.message : String(exception);
    logApp('error', 'unhandled exception', {
      name: (exception as PrismaLikeError)?.name,
      prismaCode: pc,
      message: message.slice(0, 300),
    });
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: errorBody('INTERNAL_ERROR', DEFAULT_MESSAGE.INTERNAL_ERROR),
    };
  }
}

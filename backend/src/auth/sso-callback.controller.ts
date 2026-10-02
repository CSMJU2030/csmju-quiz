// endpoint SSO ของระบบย่อย (auth-contract.md 1.2 ข้อ 5 · standards 1.7.0) — public · อยู่นอก prefix /api
// เบราว์เซอร์เข้าผ่าน frontend (FRONTEND_URL) ซึ่ง proxy /auth/* มาที่นี่ (connect-core-hub ข้อ 0–1)
//
// GET /auth/login  — เริ่ม SSO พร้อม state และหน้าที่จะกลับไป (sso-login.ts) · ห้ามส่ง callback_url
// GET /auth/callback — ต้องตรงกับ callback_url ในทะเบียน (http://localhost:3102/auth/callback ตอน dev) · ข้อ 5.1
//   ไม่มี access_token                  → 400
//   ไม่มี state (กดจาก sidebar)         → ทิ้ง token · ไม่ตั้งคุกกี้ใด ๆ · 302 /auth/login
//   state ไม่มีคุกกี้ / ไม่ตรง           → 401 + หน้า "เข้าสู่ระบบอีกครั้ง" (text/html) · ไม่ redirect
//   token ไม่ผ่าน 10 ขั้น               → 401
//   role ที่ระบบไม่รับ                   → 403
//   ผ่าน                                 → คุกกี้ csmju_quiz_access_token → 302 ไปหน้า next (ตรวจซ้ำ)
//   คุกกี้ state ถูกเผาก่อนตรวจเสมอเมื่อมี state · ไม่สำเร็จ = ไม่มี Set-Cookie ของ session
// POST /auth/logout — ลบคุกกี้ของตัวเองทั้งสอง แล้ว 303 ไป {CORE_HUB_WEB_URL}/logout
//   ไม่ต้องมี token (token หมดอายุแล้วก็ต้องออกจากระบบได้)
// ทุกคำตอบ Cache-Control: no-store · callback มี Referrer-Policy: no-referrer (URL มี token)
// ห้าม log URL เต็ม/query ของ callback และห้าม log header Cookie
import { Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AppException } from '../common/app-exception';
import { errorBody } from '../common/envelope';
import { logEvent } from '../common/logger';
import { AppConfig } from '../config/app-config.service';
import { RawResponse } from '../common/raw-response.decorator';
import type { SsoStateFailureReason } from './auth.errors';
import { CoreHubTokenVerifier } from './core-hub-token.verifier';
import { Public } from './decorators/public.decorator';
import { authenticate } from './guards/core-hub-jwt.guard';
import {
  clearStateCookie,
  encodeStateCookie,
  matchStateCookie,
  newSsoState,
  safeNext,
  setStateCookie,
  SSO_STATE_COOKIE,
} from './sso-login';
import { sendSsoError, SSO_PAGES } from './sso-error-page';
import { clearSessionCookie, setSessionCookie } from './sso-session';
import { readCookie } from './token-extractor';

const SSO_LOGIN_PATH = '/auth/login';
const CALLBACK_PATH = '/auth/callback';

/** query ของ callback อาจซ้ำชื่อ (?state=a&state=b) จึงไม่ใช่ string เสมอ */
interface CallbackQuery {
  access_token?: unknown;
  state?: unknown;
}

@ApiExcludeController()
@Controller('auth')
export class SsoCallbackController {
  constructor(
    private readonly verifier: CoreHubTokenVerifier,
    private readonly config: AppConfig,
  ) {}

  @Public()
  @RawResponse()
  @Get('login')
  login(@Res() res: Response, @Query('next') next?: string) {
    const secure = this.config.isProduction;
    const target = safeNext(next, this.config.get('FRONTEND_URL')) ?? '/';
    const state = newSsoState();
    setStateCookie(res, encodeStateCookie(state, target), secure);

    const authorize = new URL('/sso/authorize', this.config.get('CORE_HUB_WEB_URL'));
    authorize.searchParams.set('subsystem', this.config.get('SUBSYSTEM_ID'));
    authorize.searchParams.set('state', state);
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, authorize.toString());
  }

  @Public()
  @RawResponse()
  @Post('logout')
  logout(@Res() res: Response) {
    const secure = this.config.isProduction;
    clearSessionCookie(res, secure);
    clearStateCookie(res, secure);
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(303, new URL('/logout', this.config.get('CORE_HUB_WEB_URL')).toString());
  }

  @Public()
  @RawResponse()
  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response, @Query() query: CallbackQuery) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const secure = this.config.isProduction;
    const { access_token: accessToken, state } = query;
    const hasState = state !== undefined && state !== '';

    // มี state: เผาคุกกี้ state ก่อนตรวจอย่างอื่น (ใช้ได้ครั้งเดียว) · ไม่มี state ห้ามแตะ (แท็บอื่นอาจรออยู่)
    if (hasState) clearStateCookie(res, secure);

    if (typeof accessToken !== 'string' || !accessToken) {
      res
        .status(400)
        .json(
          errorBody('VALIDATION_ERROR', 'access_token is required', ['access_token is required']),
        );
      return;
    }

    // ไม่มี state (เริ่มจาก sidebar ของ Core Hub) → ทิ้ง token · ไม่ตั้งคุกกี้ใด ๆ · เริ่ม SSO ใหม่จากระบบนี้
    if (!hasState) {
      logStateFailure('sso_restart_without_state');
      res.redirect(302, new URL(SSO_LOGIN_PATH, this.config.get('FRONTEND_URL')).toString());
      return;
    }

    // มี state แต่ไม่มีคุกกี้ state หรือไม่ตรง → 401 · ห้าม redirect ซ้ำ
    const stateCookie = readCookie(req.headers.cookie, SSO_STATE_COOKIE);
    const next = typeof state === 'string' ? matchStateCookie(stateCookie, state) : null;
    if (next === null) {
      logStateFailure(stateCookie ? 'sso_state_mismatch' : 'sso_state_missing');
      sendSsoError(req, res, 401, 'UNAUTHORIZED', SSO_PAGES.stateFailed);
      return;
    }

    // ตรวจ token ครบ 10 ขั้น + แมป role (authenticate log event ให้เอง)
    let identity;
    try {
      identity = await authenticate(this.verifier, req, CALLBACK_PATH, accessToken);
    } catch (error) {
      const forbidden = error instanceof AppException && error.getStatus() === 403;
      if (forbidden) sendSsoError(req, res, 403, 'FORBIDDEN', SSO_PAGES.roleRejected);
      else sendSsoError(req, res, 401, 'UNAUTHORIZED', SSO_PAGES.tokenRejected);
      return;
    }

    setSessionCookie(res, accessToken, identity.exp, secure);

    // พากลับหน้าเว็บของระบบนี้ (FRONTEND_URL = ประตูเดียวของระบบ) เท่านั้น
    // next ผ่านกฎอีกครั้งเพราะกลับมาจากคุกกี้ (กัน open redirect)
    const frontend = this.config.get('FRONTEND_URL');
    const path = safeNext(next, frontend) ?? '/';
    res.redirect(302, new URL(path, frontend).toString());
  }
}

/** callback ที่ state ไม่ผ่าน → jwt.verification.failure (logging.md 1.1 ข้อ 2) · log แค่ path ไม่มี query */
function logStateFailure(reason: SsoStateFailureReason) {
  logEvent('jwt.verification.failure', { reason, kid: null, path: CALLBACK_PATH });
}

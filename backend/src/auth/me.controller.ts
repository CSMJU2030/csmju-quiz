import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { CoreHubIdentity } from './core-hub-identity';
import { CurrentUser } from './decorators/current-user.decorator';
import { MeDto } from './me.dto';
import { SESSION_COOKIE } from './token-extractor';

@ApiTags('me')
@ApiBearerAuth()
@ApiCookieAuth(SESSION_COOKIE)
@Controller('v1/me')
export class MeController {
  /** ผู้ใช้ปัจจุบัน — id คือค่า sub ของ token · session.expiresAt จาก exp (auth-contract ข้อ 5) */
  @Get()
  @ApiOperation({ summary: 'Current user from the verified Core Hub token' })
  @ApiOkResponse({ type: MeDto })
  me(@CurrentUser() user: CoreHubIdentity): MeDto {
    return {
      id: user.coreUserId,
      coreUserId: user.coreUserId,
      email: user.email,
      coreRole: user.coreRole,
      subsystemRole: user.subsystemRole,
      permissions: user.permissions,
      session: { expiresAt: new Date(user.exp * 1000).toISOString() },
    };
  }
}

import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { CoreHubIdentity } from '../auth/core-hub-identity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { PlayerStatsView } from './history.dto';
import { GameHistoryService } from './history.service';
import { SESSION_COOKIE } from '../auth/token-extractor';

/** sub-resource ของผู้ใช้ปัจจุบัน — /api/v1/me/game-stats */
@ApiTags('me')
@ApiBearerAuth()
@ApiCookieAuth(SESSION_COOKIE)
@RequirePermissions(Permission.GAME_HISTORY_READ_OWN)
@Controller('v1/me')
export class GameStatsController {
  constructor(private readonly history: GameHistoryService) {}

  @Get('game-stats')
  @ApiOperation({ summary: 'My overall stats across finished games' })
  @ApiOkResponse({ type: PlayerStatsView })
  stats(@CurrentUser() user: CoreHubIdentity) {
    return this.history.stats(user);
  }
}

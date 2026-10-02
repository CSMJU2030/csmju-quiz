import { Controller, Get, Param, Query } from '@nestjs/common';
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
import { PaginationQueryDto } from '../common/pagination.dto';
import { UuidParam } from '../common/uuid.pipe';
import { PlayerGameResultView, PlayerGameReviewView } from '../reports/player-review.dto';
import { GameHistoryService } from './history.service';
import { SESSION_COOKIE } from '../auth/token-extractor';

@ApiTags('game-histories')
@ApiBearerAuth()
@ApiCookieAuth(SESSION_COOKIE)
@RequirePermissions(Permission.GAME_HISTORY_READ_OWN)
@Controller('v1/game-histories')
export class GameHistoriesController {
  constructor(private readonly history: GameHistoryService) {}

  @Get()
  @ApiOperation({ summary: 'Finished games I played with my account (newest first)' })
  @ApiOkResponse({ type: [PlayerGameResultView] })
  list(@CurrentUser() user: CoreHubIdentity, @Query() query: PaginationQueryDto) {
    return this.history.list(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'My result in one finished game with per-question review' })
  @ApiOkResponse({ type: PlayerGameReviewView })
  findOne(@CurrentUser() user: CoreHubIdentity, @Param('id', UuidParam) id: string) {
    return this.history.findOne(user, id);
  }
}

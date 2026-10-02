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
import { UuidParam } from '../common/uuid.pipe';
import { PlayerGameReviewView } from './player-review.dto';
import { GameReportQueryDto, GameReportSummaryView, GameReportView } from './game-report.dto';
import { GameReportsService } from './game-reports.service';
import { SESSION_COOKIE } from '../auth/token-extractor';

@ApiTags('game-reports')
@ApiBearerAuth()
@ApiCookieAuth(SESSION_COOKIE)
@RequirePermissions(Permission.REPORT_READ_OWN, Permission.REPORT_READ_ANY)
@Controller('v1/game-reports')
export class GameReportsController {
  constructor(private readonly reports: GameReportsService) {}

  @Get()
  @ApiOperation({ summary: 'Finished games I hosted (ADMIN: all)' })
  @ApiOkResponse({ type: [GameReportSummaryView] })
  list(@CurrentUser() user: CoreHubIdentity, @Query() query: GameReportQueryDto) {
    return this.reports.list(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Report of one finished game (players + per-question stats)' })
  @ApiOkResponse({ type: GameReportView })
  findOne(@CurrentUser() user: CoreHubIdentity, @Param('id', UuidParam) id: string) {
    return this.reports.findOne(user, id);
  }

  @Get(':id/players/:playerId')
  @ApiOperation({
    summary: 'One player in a finished game I hosted: result + per-question answers',
  })
  @ApiOkResponse({ type: PlayerGameReviewView })
  findPlayer(
    @CurrentUser() user: CoreHubIdentity,
    @Param('id', UuidParam) id: string,
    @Param('playerId', UuidParam) playerId: string,
  ) {
    return this.reports.findPlayer(user, id, playerId);
  }
}

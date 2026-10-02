import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  type MessageEvent,
  Param,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import type { Observable } from 'rxjs';
import type { CoreHubIdentity } from '../auth/core-hub-identity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { RawResponse } from '../common/raw-response.decorator';
import { UuidParam } from '../common/uuid.pipe';
import {
  AnswerReceiptView,
  CreateGameSessionDto,
  GameJoinView,
  GameLobbyView,
  GameSessionQueryDto,
  GameSessionSummaryView,
  GameStateView,
  JoinGameDto,
  SubmitAnswerDto,
} from './game.dto';
import { GameSessionsService } from './game-sessions.service';
import { GameStateFeed, liveStream } from './game-state-feed';
import { SESSION_COOKIE } from '../auth/token-extractor';

const HEARTBEAT_MS = 15_000;

@ApiTags('game-sessions')
@ApiExtraModels(GameLobbyView, GameSessionSummaryView)
@ApiBearerAuth()
@ApiCookieAuth(SESSION_COOKIE)
@Controller('v1/game-sessions')
export class GameSessionsController {
  constructor(
    private readonly games: GameSessionsService,
    private readonly feed: GameStateFeed,
  ) {}

  @Post()
  @RequirePermissions(Permission.GAME_HOST)
  @ApiOperation({ summary: 'Open a game room from a published quiz' })
  @ApiCreatedResponse({ type: GameStateView })
  create(@CurrentUser() user: CoreHubIdentity, @Body() dto: CreateGameSessionDto) {
    return this.games.create(user, dto);
  }

  @Get()
  @RequirePermissions(Permission.GAME_HOST, Permission.GAME_JOIN)
  @ApiOperation({
    summary: 'Host: my game rooms · Player: find a joinable room with ?gamePin=',
  })
  @ApiOkResponse({
    description: 'มี ?gamePin= → GameLobbyView[] (0–1 ห้อง) · ไม่มี → GameSessionSummaryView[]',
    schema: {
      type: 'array',
      items: {
        oneOf: [
          { $ref: getSchemaPath(GameLobbyView) },
          { $ref: getSchemaPath(GameSessionSummaryView) },
        ],
      },
    },
  })
  list(@CurrentUser() user: CoreHubIdentity, @Query() query: GameSessionQueryDto) {
    return this.games.list(user, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.GAME_HOST, Permission.GAME_JOIN)
  @ApiOperation({ summary: 'Current game state (host or joined player view)' })
  @ApiOkResponse({ type: GameStateView })
  findOne(@CurrentUser() user: CoreHubIdentity, @Param('id', UuidParam) id: string) {
    return this.games.findOne(user, id);
  }

  @Delete(':id')
  @RequirePermissions(Permission.GAME_HOST)
  @ApiOperation({ summary: 'Close and delete a game room (its report is deleted too)' })
  remove(@CurrentUser() user: CoreHubIdentity, @Param('id', UuidParam) id: string) {
    return this.games.remove(user, id);
  }

  @Post(':id/start')
  @HttpCode(200)
  @RequirePermissions(Permission.GAME_HOST)
  @ApiOperation({ summary: 'Host starts the game (3-2-1 countdown, then question 1)' })
  @ApiOkResponse({ type: GameStateView })
  start(@CurrentUser() user: CoreHubIdentity, @Param('id', UuidParam) id: string) {
    return this.games.start(user, id);
  }

  @Post(':id/advance')
  @HttpCode(200)
  @RequirePermissions(Permission.GAME_HOST)
  @ApiOperation({ summary: 'Host skips ahead: close answers now → leaderboard → next question' })
  @ApiOkResponse({ type: GameStateView })
  advance(@CurrentUser() user: CoreHubIdentity, @Param('id', UuidParam) id: string) {
    return this.games.advance(user, id);
  }

  @Post(':id/players')
  @RequirePermissions(Permission.GAME_JOIN)
  @ApiOperation({ summary: 'Join a room in the lobby (re-joining returns the same player)' })
  @ApiCreatedResponse({ type: GameJoinView })
  join(
    @CurrentUser() user: CoreHubIdentity,
    @Param('id', UuidParam) id: string,
    @Body() dto: JoinGameDto,
  ) {
    return this.games.join(user, id, dto);
  }

  @Delete(':id/players/:playerId')
  @RequirePermissions(Permission.GAME_JOIN, Permission.GAME_HOST)
  @ApiOperation({ summary: 'Leave the lobby (player) or remove a player (host)' })
  removePlayer(
    @CurrentUser() user: CoreHubIdentity,
    @Param('id', UuidParam) id: string,
    @Param('playerId', UuidParam) playerId: string,
  ) {
    return this.games.removePlayer(user, id, playerId);
  }

  @Post(':id/answers')
  @RequirePermissions(Permission.GAME_JOIN)
  @ApiOperation({ summary: 'Submit an answer to the current question (once per question)' })
  @ApiCreatedResponse({ type: AnswerReceiptView })
  answer(
    @CurrentUser() user: CoreHubIdentity,
    @Param('id', UuidParam) id: string,
    @Body() dto: SubmitAnswerDto,
  ) {
    return this.games.answer(user, id, dto);
  }

  /**
   * Server-Sent Events: event "state" ทุกครั้งที่ห้องเปลี่ยน + "ping" ทุก 15 วินาที
   * ใช้ EventSource(url, { withCredentials: true }) — คุกกี้ session ผ่าน guard ตามปกติ
   * ตรวจสิทธิ์ทุกครั้งที่ส่ง: ถูกเตะ / ห้องถูกลบ → ส่ง "closed" แล้วจบ stream
   */
  @Sse(':id/events')
  @RawResponse()
  @RequirePermissions(Permission.GAME_HOST, Permission.GAME_JOIN)
  @ApiOperation({ summary: 'Live game state stream (text/event-stream)' })
  @ApiProduces('text/event-stream')
  async events(
    @CurrentUser() user: CoreHubIdentity,
    @Param('id', UuidParam) id: string,
  ): Promise<Observable<MessageEvent>> {
    // ตรวจสิทธิ์ก่อนเปิด stream → ไม่มีสิทธิ์ได้ 403/404 เป็น JSON ตามปกติ
    const first = await this.games.loadFull(id);
    this.games.assertCanView(first, user);

    return liveStream({
      id,
      first,
      changes: this.feed.changes(id),
      canView: (s) => this.games.canView(s, user),
      view: (s) => this.games.viewFor(s, user),
      recheck: () => this.games.loadFull(id),
      heartbeatMs: HEARTBEAT_MS,
    });
  }
}

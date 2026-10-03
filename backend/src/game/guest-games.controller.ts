// endpoint ของผู้เล่นที่ไม่ล็อกอิน — ตรวจ "บัตรเข้าห้อง" แทน token ของ Core Hub (PM อนุมัติ 2 ต.ค. 2569)
//   ประกาศทุกตัวใน public_endpoints ของ subsystem.yaml · endpoint อื่นทั้งหมดยังอยู่หลัง CoreHubJwtGuard
//   บัตรทำได้แค่: เข้าร่วมห้องที่ออกให้ · ส่งคำตอบ · ดูสถานะห้องและคะแนนของตัวเอง · ออกจากห้องก่อนเริ่ม
//   ห้าม log ค่าบัตรหรือ header Cookie
import {
  Body,
  Controller,
  Delete,
  Get,
  type MessageEvent,
  Param,
  Post,
  Query,
  Req,
  Res,
  Sse,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { Public } from '../auth/decorators/public.decorator';
import { Errors } from '../common/app-exception';
import { FixedWindowRateLimiter } from '../common/rate-limit';
import { RawResponse } from '../common/raw-response.decorator';
import { UuidParam } from '../common/uuid.pipe';
import { AppConfig } from '../config/app-config.service';
import {
  AnswerReceiptView,
  GameJoinView,
  GameLobbyView,
  GameSessionQueryDto,
  GameStateView,
  JoinGameDto,
  SubmitAnswerDto,
} from './game.dto';
import { GameSessionsService } from './game-sessions.service';
import { GameStateFeed, liveStream } from './game-state-feed';
import { readRoomPass, ROOM_PASS_COOKIE, roomPassPath } from './room-pass';

const HEARTBEAT_MS = 15_000;
const RATE_WINDOW_MS = 60_000;

@ApiTags('guest-games')
@ApiExtraModels(GameLobbyView)
@ApiCookieAuth(ROOM_PASS_COOKIE)
@Public()
@Controller('v1/guest-games')
export class GuestGamesController {
  private readonly limiter: FixedWindowRateLimiter;

  constructor(
    private readonly games: GameSessionsService,
    private readonly feed: GameStateFeed,
    private readonly config: AppConfig,
  ) {
    this.limiter = new FixedWindowRateLimiter(
      this.config.get('GUEST_JOIN_RATE_LIMIT'),
      RATE_WINDOW_MS,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Guest: find the room waiting for players with ?gamePin=' })
  @ApiOkResponse({
    description: 'GameLobbyView[] (0–1 ห้อง)',
    schema: { type: 'array', items: { $ref: getSchemaPath(GameLobbyView) } },
  })
  lobby(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Query() query: GameSessionQueryDto,
  ) {
    this.guard(req, res);
    return this.games.findLobbyForGuest(query);
  }

  @Post(':id/players')
  @ApiOperation({
    summary: 'Guest: join a room in the lobby — sets the room pass cookie (HttpOnly)',
  })
  @ApiCreatedResponse({ type: GameJoinView })
  async join(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('id', UuidParam) id: string,
    @Body() dto: JoinGameDto,
  ): Promise<GameJoinView> {
    this.guard(req, res);
    const { join, pass } = await this.games.joinAsGuest(id, dto, readRoomPass(req.headers.cookie));
    if (pass) {
      res.cookie(ROOM_PASS_COOKIE, pass.value, {
        httpOnly: true,
        sameSite: 'lax',
        secure: this.config.isProduction,
        path: roomPassPath(id),
        maxAge: pass.expiresAt.getTime() - Date.now(),
      });
    }
    return join;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Guest: current game state (room pass required)' })
  @ApiOkResponse({ type: GameStateView })
  async findOne(@Req() req: Request, @Param('id', UuidParam) id: string) {
    this.assertEnabled();
    const player = await this.games.guestPlayer(id, readRoomPass(req.headers.cookie));
    return this.games.viewForGuest(await this.games.loadFull(id), player.id);
  }

  @Post(':id/answers')
  @ApiOperation({ summary: 'Guest: submit an answer to the current question' })
  @ApiCreatedResponse({ type: AnswerReceiptView })
  async answer(
    @Req() req: Request,
    @Param('id', UuidParam) id: string,
    @Body() dto: SubmitAnswerDto,
  ) {
    this.assertEnabled();
    const player = await this.games.guestPlayer(id, readRoomPass(req.headers.cookie));
    return this.games.answerAsGuest(id, player.id, dto);
  }

  @Delete(':id/players/:playerId')
  @ApiOperation({ summary: 'Guest: leave the lobby (own player only)' })
  async leave(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('id', UuidParam) id: string,
    @Param('playerId', UuidParam) playerId: string,
  ) {
    this.assertEnabled();
    const player = await this.games.guestPlayer(id, readRoomPass(req.headers.cookie));
    const result = await this.games.leaveAsGuest(id, playerId, player.id);
    res.clearCookie(ROOM_PASS_COOKIE, { path: roomPassPath(id) });
    return result;
  }

  /**
   * Server-Sent Events แบบเดียวกับผู้เล่นที่ล็อกอิน — ส่ง "closed" แล้วจบ stream เมื่อ
   * ห้องถูกปิด · ผู้เล่นถูกเตะ · หรือบัตรครบ 4 ชั่วโมง
   */
  @Sse(':id/events')
  @RawResponse()
  @ApiOperation({ summary: 'Guest: live game state stream (text/event-stream)' })
  @ApiProduces('text/event-stream')
  async events(
    @Req() req: Request,
    @Param('id', UuidParam) id: string,
  ): Promise<Observable<MessageEvent>> {
    this.assertEnabled();
    const player = await this.games.guestPlayer(id, readRoomPass(req.headers.cookie));
    const expiresAt = player.roomPassExpiresAt?.getTime() ?? 0;

    return liveStream({
      id,
      first: await this.games.loadFull(id),
      changes: this.feed.changes(id),
      canView: (s) => Date.now() < expiresAt && s.players.some((p) => p.id === player.id),
      view: (s) => this.games.viewForGuest(s, player.id),
      recheck: () => this.games.loadFull(id),
      heartbeatMs: HEARTBEAT_MS,
      expiresAt,
    });
  }

  /** ปิดโหมดนี้ด้วย GUEST_PLAY_ENABLED=false → ทุก endpoint ตอบ 404 */
  private assertEnabled() {
    if (!this.config.get('GUEST_PLAY_ENABLED')) throw Errors.notFound('Route');
  }

  /** ค้นห้องและเข้าร่วม: จำกัดต่อ IP · เกิน → 429 + Retry-After */
  private guard(req: Request, res: Response) {
    this.assertEnabled();
    const result = this.limiter.hit(req.ip ?? 'unknown');
    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfterSec));
      throw Errors.tooManyRequests(result.retryAfterSec);
    }
  }
}

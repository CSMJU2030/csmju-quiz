import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../common/pagination.dto';
import { MAX_TIME_LIMIT, MIN_TIME_LIMIT } from '../questions/question-rules';
import { AWARD_KINDS } from './podium';

export const GAME_STATUSES = ['LOBBY', 'ACTIVE', 'FINISHED', 'CANCELLED'] as const;
export const GAME_PHASES = ['LOBBY', 'QUESTION', 'RESULT', 'LEADERBOARD', 'PODIUM'] as const;
export const MAX_AVATAR_INDEX = 47;

/* ─────────── requests ─────────── */

export class CreateGameSessionDto {
  @ApiProperty({ format: 'uuid', description: 'แบบทดสอบที่เผยแพร่แล้ว และคำถามครบทุกข้อ' })
  @IsUUID('4')
  quizId: string;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: MIN_TIME_LIMIT,
    maximum: MAX_TIME_LIMIT,
    description: 'ตั้งเวลาเท่ากันทุกข้อ (วินาที) · null = ใช้เวลาที่ตั้งในแต่ละข้อ',
  })
  @IsOptional()
  @IsInt()
  @Min(MIN_TIME_LIMIT)
  @Max(MAX_TIME_LIMIT)
  timeLimitOverride?: number | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  shuffleOptions?: boolean;
}

export class GameSessionQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    pattern: '^\\d{6}$',
    description:
      'ค้นห้องที่เปิดรอผู้เล่นด้วยรหัสเกม (ผู้เล่นใช้ค่านี้) · ไม่ส่ง = ห้องของฉัน (host)',
  })
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'gamePin must be 6 digits' })
  gamePin?: string;

  @ApiPropertyOptional({ enum: GAME_STATUSES })
  @IsOptional()
  @IsIn(GAME_STATUSES)
  status?: (typeof GAME_STATUSES)[number];
}

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class JoinGameDto {
  @ApiProperty({ minLength: 1, maxLength: 20 })
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'nickname is required' })
  @MaxLength(20)
  nickname: string;

  @ApiPropertyOptional({ minimum: 0, maximum: MAX_AVATAR_INDEX, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_AVATAR_INDEX)
  avatarIndex?: number;
}

export class SubmitAnswerDto {
  @ApiProperty({ format: 'uuid', description: 'ตัวเลือกของคำถามข้อปัจจุบัน' })
  @IsUUID('4')
  optionId: string;
}

/* ─────────── views ─────────── */

export class GameOptionView {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() text: string;
  @ApiPropertyOptional({
    description: 'ผู้เล่นเห็นเฉพาะหลังเฉลย (RESULT ขึ้นไป) · host เห็นตลอด',
  })
  isCorrect?: boolean;
}

export class GameQuestionView {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ description: 'ลำดับเริ่มที่ 0' }) index: number;
  @ApiProperty({ enum: ['MULTIPLE_CHOICE', 'TRUE_FALSE'] }) type: string;
  @ApiProperty() prompt: string;
  @ApiPropertyOptional({ type: String, nullable: true }) imageUrl: string | null;
  @ApiProperty() timeLimit: number;
  @ApiProperty() points: number;
  @ApiProperty({ type: [GameOptionView] }) options: GameOptionView[];
}

export class GamePlayerView {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() nickname: string;
  @ApiProperty() avatarIndex: number;
  @ApiProperty() score: number;
  @ApiProperty({ description: 'ตอบถูกติดกันตอนนี้' }) streak: number;
  @ApiProperty() rank: number;
  @ApiProperty({ description: 'ตอบข้อปัจจุบันแล้ว' }) hasAnswered: boolean;
}

export class GameMyAnswerView {
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) optionId: string | null;
  @ApiPropertyOptional({ description: 'หลังเฉลยเท่านั้น' }) isCorrect?: boolean;
  @ApiPropertyOptional({ description: 'หลังเฉลยเท่านั้น' }) points?: number;
  @ApiProperty() isTimedOut: boolean;
}

export class GameMeView {
  @ApiProperty({ format: 'uuid' }) playerId: string;
  @ApiProperty() nickname: string;
  @ApiProperty() avatarIndex: number;
  @ApiProperty() score: number;
  @ApiProperty() streak: number;
  @ApiProperty() rank: number;
  @ApiPropertyOptional({ type: GameMyAnswerView, nullable: true }) answer: GameMyAnswerView | null;
}

export class GameSettingsView {
  @ApiPropertyOptional({ type: Number, nullable: true }) timeLimitOverride: number | null;
  @ApiProperty() shuffleQuestions: boolean;
  @ApiProperty() shuffleOptions: boolean;
}

export class PodiumPlayerStatsView {
  @ApiProperty({ format: 'uuid' }) playerId: string;
  @ApiProperty() correct: number;
  @ApiProperty({ description: 'ข้อที่ตอบจริง (ไม่นับหมดเวลา)' }) answered: number;
  @ApiProperty({ description: 'ตอบถูกติดกันยาวที่สุด' }) maxStreak: number;
  @ApiProperty({ description: 'จำนวนข้อที่ตอบถูกเร็วที่สุดในห้อง' }) firstCorrect: number;
}

export class PodiumAwardView {
  @ApiProperty({ enum: AWARD_KINDS }) kind: string;
  @ApiProperty({ format: 'uuid' }) playerId: string;
  @ApiProperty({ description: 'จำนวนข้อ (fastest/streak) หรือเปอร์เซ็นต์ (accuracy)' })
  value: number;
}

export class PodiumResultsView {
  @ApiProperty({ type: [PodiumPlayerStatsView] }) players: PodiumPlayerStatsView[];
  @ApiProperty({ type: [PodiumAwardView] }) awards: PodiumAwardView[];
}

export class GameStateView {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() gamePin: string;
  @ApiProperty({ enum: GAME_STATUSES }) status: string;
  @ApiProperty({ enum: GAME_PHASES }) phase: string;
  @ApiProperty({ enum: ['HOST', 'PLAYER'] }) viewer: 'HOST' | 'PLAYER';
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) quizId: string | null;
  @ApiProperty() quizTitle: string;
  @ApiProperty() currentQuestionIndex: number;
  @ApiProperty() totalQuestions: number;
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'เวลาเริ่มนับเวลาตอบ (อาจอยู่ในอนาคตระหว่างนับ 3-2-1 ก่อนข้อแรก)',
  })
  questionStartedAt: string | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true }) phaseEndsAt:
    string | null;
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'นับถอยหลังเต็มจอ: ปิดรับคำตอบ (QUESTION) หรือ ข้อถัดไป/ประกาศผล (LEADERBOARD)',
  })
  countdownEndsAt: string | null;
  @ApiProperty({ format: 'date-time', description: 'เวลาของ server ใช้ชดเชยนาฬิกาเครื่องผู้ใช้' })
  serverTime: string;
  @ApiProperty({ type: GameSettingsView }) settings: GameSettingsView;
  @ApiPropertyOptional({ type: GameQuestionView, nullable: true })
  question: GameQuestionView | null;
  @ApiProperty() answeredCount: number;
  @ApiProperty() playerCount: number;
  @ApiProperty({ type: [GamePlayerView], description: 'เรียงตามอันดับ' }) players: GamePlayerView[];
  @ApiPropertyOptional({
    description: 'จำนวนคนที่เลือกแต่ละตัวเลือก { optionId: count } — ผู้เล่นเห็นหลังเฉลย',
    nullable: true,
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  distribution: Record<string, number> | null;
  @ApiPropertyOptional({ type: GameMeView, nullable: true }) me: GameMeView | null;
  @ApiPropertyOptional({
    type: PodiumResultsView,
    nullable: true,
    description: 'สถิติและรางวัลพิเศษ — มีเฉพาะเมื่อ phase = PODIUM',
  })
  results: PodiumResultsView | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true }) startedAt:
    string | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true }) finishedAt:
    string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

export class GameLobbyView {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() gamePin: string;
  @ApiProperty() quizTitle: string;
  @ApiProperty({ enum: GAME_STATUSES }) status: string;
  @ApiProperty() playerCount: number;
  @ApiProperty() totalQuestions: number;
  @ApiProperty({ description: 'ผู้เรียกเข้าห้องนี้แล้ว' }) joined: boolean;
}

export class GameSessionSummaryView {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() gamePin: string;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) quizId: string | null;
  @ApiProperty() quizTitle: string;
  @ApiProperty({ enum: GAME_STATUSES }) status: string;
  @ApiProperty({ enum: GAME_PHASES }) phase: string;
  @ApiProperty() playerCount: number;
  @ApiProperty() totalQuestions: number;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true }) startedAt:
    string | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true }) finishedAt:
    string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

export class GameJoinView {
  @ApiProperty({ format: 'uuid' }) gameSessionId: string;
  @ApiProperty({ format: 'uuid' }) playerId: string;
  @ApiProperty() nickname: string;
  @ApiProperty() avatarIndex: number;
}

export class AnswerReceiptView {
  @ApiProperty() questionIndex: number;
  @ApiProperty({ format: 'uuid' }) optionId: string;
  @ApiProperty({ description: 'ผลถูก/ผิดเปิดเผยตอนเฉลย ผ่าน state' }) accepted: boolean;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AWARD_KINDS, type AwardKind } from '../game/podium';
import { ANSWER_RESULTS, type AnswerResult } from './player-review';

/** ผลของผู้เล่นหนึ่งคนในเกม */
export class PlayerGameResultView {
  @ApiProperty({ format: 'uuid', description: 'id ของห้องเกม' }) id: string;
  @ApiProperty() quizTitle: string;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true }) startedAt:
    string | null;
  @ApiProperty({ format: 'date-time' }) finishedAt: string;
  @ApiProperty({ format: 'uuid' }) playerId: string;
  @ApiProperty() nickname: string;
  @ApiProperty() avatarIndex: number;
  @ApiProperty({ description: 'อันดับในห้อง (คะแนนเท่ากันได้อันดับเดียวกัน)' }) rank: number;
  @ApiProperty() playerCount: number;
  @ApiProperty() score: number;
  @ApiProperty() questionCount: number;
  @ApiProperty() correct: number;
  @ApiProperty() incorrect: number;
  @ApiProperty({ description: 'หมดเวลา หรือไม่ได้ตอบ' }) timeout: number;
  @ApiProperty({ description: '0–100' }) accuracy: number;
  @ApiProperty({ enum: AWARD_KINDS, isArray: true, description: 'รางวัลพิเศษที่ได้ในเกมนี้' })
  awards: AwardKind[];
}

export class AnswerReviewOptionView {
  @ApiProperty({ format: 'uuid' }) optionId: string;
  @ApiProperty() text: string;
  @ApiProperty() isCorrect: boolean;
}

export class AnswerReviewView {
  @ApiProperty({ description: 'ลำดับเริ่มที่ 1' }) questionNumber: number;
  @ApiProperty({ format: 'uuid' }) questionId: string;
  @ApiProperty() type: string;
  @ApiProperty() prompt: string;
  @ApiPropertyOptional({ type: String, nullable: true }) imageUrl: string | null;
  @ApiProperty({ description: 'วินาที' }) timeLimit: number;
  @ApiProperty({ description: 'คะแนนเต็มของข้อ' }) points: number;
  @ApiProperty({ type: [AnswerReviewOptionView] }) options: AnswerReviewOptionView[];
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  selectedOptionId: string | null;
  @ApiProperty({ enum: ANSWER_RESULTS }) result: AnswerResult;
  @ApiProperty() earnedPoints: number;
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'มิลลิวินาที · null = ไม่ได้ตอบ',
  })
  responseMs: number | null;
}

/** ผลของผู้เล่นในเกมหนึ่ง + ทบทวนคำตอบรายข้อ */
export class PlayerGameReviewView extends PlayerGameResultView {
  @ApiProperty({ description: 'ตอบถูกติดกันยาวที่สุด' }) maxStreak: number;
  @ApiProperty({ description: 'เวลาตอบเฉลี่ยของข้อที่ตอบ (มิลลิวินาที)' })
  averageResponseMs: number;
  @ApiProperty({ type: [AnswerReviewView] }) answers: AnswerReviewView[];
}

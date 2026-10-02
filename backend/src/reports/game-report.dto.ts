import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../common/pagination.dto';

export class GameReportQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'เฉพาะเกมของแบบทดสอบนี้' })
  @IsOptional()
  @IsUUID('4')
  quizId?: string;

  @ApiPropertyOptional({ maxLength: 100, description: 'ค้นในชื่อแบบทดสอบ' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class GameReportSummaryView {
  @ApiProperty({ format: 'uuid', description: 'id ของห้องเกม' }) id: string;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) quizId: string | null;
  @ApiProperty() quizTitle: string;
  @ApiProperty() gamePin: string;
  @ApiProperty() playerCount: number;
  @ApiProperty() questionCount: number;
  @ApiProperty({ description: 'เปอร์เซ็นต์ตอบถูกเฉลี่ย 0–100' }) averageAccuracy: number;
  @ApiProperty() topScore: number;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true }) startedAt:
    string | null;
  @ApiProperty({ format: 'date-time' }) finishedAt: string;
}

export class ReportPlayerView {
  @ApiProperty() rank: number;
  @ApiProperty({ format: 'uuid' }) playerId: string;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'null = ผู้เล่นที่เข้าด้วยบัตรเข้าห้อง (ไม่ได้ล็อกอิน)',
  })
  coreUserId: string | null;
  @ApiProperty() nickname: string;
  @ApiProperty({ description: 'รูปโปรไฟล์ที่ผู้เล่นเลือก' }) avatarIndex: number;
  @ApiProperty() score: number;
  @ApiProperty() correct: number;
  @ApiProperty() incorrect: number;
  @ApiProperty() timeout: number;
  @ApiProperty({ description: '0–100' }) accuracy: number;
  @ApiProperty({ description: 'เวลาตอบเฉลี่ยของข้อที่ตอบ (มิลลิวินาที)' })
  averageResponseMs: number;
}

export class ReportOptionView {
  @ApiProperty({ format: 'uuid' }) optionId: string;
  @ApiProperty() text: string;
  @ApiProperty() isCorrect: boolean;
  @ApiProperty() count: number;
}

export class ReportQuestionView {
  @ApiProperty({ description: 'ลำดับเริ่มที่ 1' }) questionNumber: number;
  @ApiProperty({ format: 'uuid' }) questionId: string;
  @ApiProperty() type: string;
  @ApiProperty() prompt: string;
  @ApiProperty() timeLimit: number;
  @ApiProperty() totalAnswers: number;
  @ApiProperty() correctAnswers: number;
  @ApiProperty() incorrectAnswers: number;
  @ApiProperty() timeoutAnswers: number;
  @ApiProperty({ description: '0–100' }) correctRate: number;
  @ApiProperty({ type: [ReportOptionView] }) options: ReportOptionView[];
}

export class GameReportView extends GameReportSummaryView {
  @ApiProperty({ type: [ReportPlayerView] }) players: ReportPlayerView[];
  @ApiProperty({ type: [ReportQuestionView] }) questions: ReportQuestionView[];
}

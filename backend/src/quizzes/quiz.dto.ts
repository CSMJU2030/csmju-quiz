import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../common/pagination.dto';
import { QuestionInputDto } from '../questions/question-input.dto';
import { MAX_QUESTIONS_PER_QUIZ } from '../questions/question-rules';
import { QuestionView } from '../questions/question.view';

export const QUIZ_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type QuizStatusName = (typeof QUIZ_STATUSES)[number];

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateQuizDto {
  @ApiProperty({ minLength: 1, maxLength: 150 })
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'title is required' })
  @MaxLength(150)
  title: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateQuizDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 150 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'title is required' })
  @MaxLength(150)
  title?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    enum: QUIZ_STATUSES,
    description: 'PUBLISHED ได้เมื่อมีคำถามอย่างน้อย 1 ข้อและครบทุกข้อ (ไม่ครบ → 409)',
  })
  @IsOptional()
  @IsIn(QUIZ_STATUSES)
  status?: QuizStatusName;

  @ApiPropertyOptional({
    type: [QuestionInputDto],
    description: 'ชุดคำถามทั้งหมดตามลำดับ (แทนที่ของเดิมทั้งชุด)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_QUESTIONS_PER_QUIZ)
  @ValidateNested({ each: true })
  @Type(() => QuestionInputDto)
  questions?: QuestionInputDto[];
}

export const QUIZ_SORTS = ['updatedAt', 'title', 'createdAt', 'questionCount'] as const;

/** ตัวกรองสถานะของรายการ — ACTIVE = แบบร่าง + เผยแพร่แล้ว (ไม่รวมเก็บถาวร) */
export const QUIZ_STATUS_FILTERS = [...QUIZ_STATUSES, 'ACTIVE'] as const;

export class QuizQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: QUIZ_STATUS_FILTERS,
    description: 'ACTIVE = แบบร่างและเผยแพร่แล้ว (ไม่รวมเก็บถาวร)',
  })
  @IsOptional()
  @IsIn(QUIZ_STATUS_FILTERS)
  status?: (typeof QUIZ_STATUS_FILTERS)[number];

  @ApiPropertyOptional({ maxLength: 100, description: 'ค้นในชื่อและรายละเอียด' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: QUIZ_SORTS, default: 'updatedAt' })
  @IsOptional()
  @IsIn(QUIZ_SORTS)
  sort?: (typeof QUIZ_SORTS)[number];
}

export class QuizSummaryView {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() ownerCoreUserId: string;
  @ApiProperty() title: string;
  @ApiProperty() description: string;
  @ApiProperty({ enum: QUIZ_STATUSES }) status: string;
  @ApiProperty() version: number;
  @ApiProperty() questionCount: number;
  @ApiProperty({ description: 'จำนวนข้อที่ยังไม่ครบ' }) incompleteCount: number;
  @ApiProperty({ description: 'เวลาตอบรวมทุกข้อ (วินาที)' }) totalTimeLimit: number;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ format: 'date-time' }) updatedAt: string;
}

export class QuizView extends QuizSummaryView {
  @ApiProperty({ type: [QuestionView] }) questions: QuestionView[];
}

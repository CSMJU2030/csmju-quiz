// DTO คำถามที่ใช้ร่วมกันระหว่างแบบทดสอบและคลังคำถาม
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
  ValidateNested,
} from 'class-validator';
import {
  DIFFICULTIES,
  MAX_OPTION_TEXT,
  MAX_OPTIONS,
  MAX_POINTS,
  MAX_PROMPT,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  MAX_TIME_LIMIT,
  MIN_OPTIONS,
  MIN_TIME_LIMIT,
  QUESTION_TYPES,
} from './question-rules';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class OptionInputDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'id เดิม (ถ้ามี) — ไม่ส่ง = ตัวเลือกใหม่' })
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @ApiProperty({ maxLength: MAX_OPTION_TEXT })
  @Transform(trim)
  @IsString()
  @MaxLength(MAX_OPTION_TEXT)
  text: string;

  @ApiProperty()
  @IsBoolean()
  isCorrect: boolean;
}

export class QuestionContentDto {
  @ApiProperty({ enum: QUESTION_TYPES })
  @IsIn(QUESTION_TYPES)
  type: (typeof QUESTION_TYPES)[number];

  @ApiProperty({ maxLength: MAX_PROMPT, description: 'แบบร่างเว้นว่างได้ แต่เผยแพร่ต้องมี' })
  @Transform(trim)
  @IsString()
  @MaxLength(MAX_PROMPT)
  prompt: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'ลิงก์รูปภาพ https:// เท่านั้น',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsString()
  @MaxLength(2048)
  @Matches(/^https:\/\//, { message: 'imageUrl must start with https://' })
  imageUrl?: string | null;

  @ApiProperty({ minimum: MIN_TIME_LIMIT, maximum: MAX_TIME_LIMIT, description: 'วินาที' })
  @IsInt()
  @Min(MIN_TIME_LIMIT)
  @Max(MAX_TIME_LIMIT)
  timeLimit: number;

  @ApiProperty({ minimum: 0, maximum: MAX_POINTS, description: '0 = ไม่คิดคะแนน' })
  @IsInt()
  @Min(0)
  @Max(MAX_POINTS)
  points: number;

  @ApiPropertyOptional({ type: [String], maxItems: MAX_TAGS })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TAGS)
  @IsString({ each: true })
  @MaxLength(MAX_TAG_LENGTH, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ enum: DIFFICULTIES, default: 'MEDIUM' })
  @IsOptional()
  @IsIn(DIFFICULTIES)
  difficulty?: (typeof DIFFICULTIES)[number];

  @ApiProperty({ type: [OptionInputDto], minItems: MIN_OPTIONS, maxItems: MAX_OPTIONS })
  @IsArray()
  @ArrayMinSize(MIN_OPTIONS)
  @ArrayMaxSize(MAX_OPTIONS)
  @ValidateNested({ each: true })
  @Type(() => OptionInputDto)
  options: OptionInputDto[];
}

export class QuestionInputDto extends QuestionContentDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'id เดิม (ถ้ามี) — ไม่ส่ง = คำถามใหม่' })
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'คัดลอกมาจากคำถามในคลังข้อไหน',
  })
  @IsOptional()
  @IsUUID('4')
  sourceBankItemId?: string | null;
}

export function normalizeTags(tags: string[] | undefined) {
  return Array.from(new Set((tags ?? []).map((t) => t.trim()).filter(Boolean)));
}

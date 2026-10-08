import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../common/pagination.dto';
import { QuestionContentDto } from '../questions/question-input.dto';
import { DIFFICULTIES } from '../questions/question-rules';
import { OptionView } from '../questions/question.view';

/** คำถามในคลังต้องครบตั้งแต่ตอนบันทึก (ไม่ครบ → 400 VALIDATION_ERROR) */
export class CreateBankItemDto extends QuestionContentDto {}

export class UpdateBankItemDto extends PartialType(CreateBankItemDto) {}

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class BankItemQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ maxLength: 30 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  tag?: string;

  @ApiPropertyOptional({ enum: DIFFICULTIES })
  @IsOptional()
  @IsIn(DIFFICULTIES)
  difficulty?: (typeof DIFFICULTIES)[number];
}

export class BankItemView {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() ownerCoreUserId: string;
  @ApiProperty({ enum: ['MULTIPLE_CHOICE', 'TRUE_FALSE'] }) type: string;
  @ApiProperty() prompt: string;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'URL สำหรับแสดงรูป (รูปที่อัปโหลด = ไฟล์จาก Core Hub)',
  })
  imageUrl: string | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) imageId: string | null;
  @ApiProperty() timeLimit: number;
  @ApiProperty() points: number;
  @ApiProperty({ type: [String] }) tags: string[];
  @ApiProperty({ enum: DIFFICULTIES }) difficulty: string;
  @ApiProperty({ description: 'จำนวนครั้งที่ถูกคัดลอกไปใช้ในแบบทดสอบ' }) usedCount: number;
  @ApiProperty({ type: [OptionView] }) options: OptionView[];
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ format: 'date-time' }) updatedAt: string;
}

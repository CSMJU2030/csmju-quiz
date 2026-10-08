import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OptionView {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() text: string;
  @ApiProperty() isCorrect: boolean;
}

export class QuestionView {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) quizId: string;
  @ApiProperty({ description: 'ลำดับเริ่มที่ 1' }) order: number;
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
  @ApiProperty({ enum: ['EASY', 'MEDIUM', 'HARD'] }) difficulty: string;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) sourceBankItemId:
    string | null;
  @ApiProperty({ type: [OptionView] }) options: OptionView[];
  @ApiProperty({ type: [String], description: 'ปัญหาที่ต้องแก้ก่อนเผยแพร่ (ว่าง = ครบ)' })
  issues: string[];
}

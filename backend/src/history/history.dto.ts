import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** สถิติรวมของฉันจากทุกเกมที่เล่นจบ (เฉพาะผู้เล่นที่เข้าด้วยบัญชี) */
export class PlayerStatsView {
  @ApiProperty() gamesPlayed: number;
  @ApiProperty({ description: 'จำนวนครั้งที่ได้อันดับ 1' }) wins: number;
  @ApiProperty({ description: 'จำนวนครั้งที่ติด 3 อันดับแรก' }) podiumFinishes: number;
  @ApiPropertyOptional({ type: Number, nullable: true }) bestRank: number | null;
  @ApiProperty() bestScore: number;
  @ApiProperty() totalScore: number;
  @ApiProperty({ description: 'ความแม่นยำเฉลี่ยต่อเกม 0–100' }) averageAccuracy: number;
  @ApiProperty() totalCorrect: number;
  @ApiProperty() totalQuestions: number;
  @ApiProperty({ description: 'ตอบถูกติดกันยาวที่สุดในเกมเดียว' }) bestStreak: number;
  @ApiProperty() awardsEarned: number;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  lastPlayedAt: string | null;
}

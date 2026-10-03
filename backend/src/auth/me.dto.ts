import { ApiProperty } from '@nestjs/swagger';

export class MeSessionDto {
  @ApiProperty({
    description:
      'เวลาหมดอายุของ token/คุกกี้ session (ISO 8601 จาก exp) — frontend ใช้ต่ออายุล่วงหน้าผ่าน /auth/login',
    example: '2026-10-03T09:15:00.000Z',
  })
  expiresAt: string;
}

export class MeDto {
  @ApiProperty({ description: 'Core Hub user id (token sub)' })
  id: string;
  @ApiProperty({ description: 'same as id — Global Identity' })
  coreUserId: string;
  @ApiProperty()
  email: string;
  @ApiProperty({ enum: ['student', 'alumni', 'staff', 'lecturer', 'guest', 'admin'] })
  coreRole: string;
  @ApiProperty({ enum: ['PLAYER', 'HOST', 'ADMIN'] })
  subsystemRole: string;
  @ApiProperty({ type: [String] })
  permissions: string[];
  @ApiProperty({ type: MeSessionDto })
  session: MeSessionDto;
}

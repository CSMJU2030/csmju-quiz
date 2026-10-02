import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { AppConfig } from '../config/app-config.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly config: AppConfig) {}

  /** GET /api/health — public · data.service ต้องตรงกับ name ใน subsystem.yaml */
  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check (public)' })
  health() {
    return { status: 'ok', service: this.config.get('SUBSYSTEM_ID') };
  }
}

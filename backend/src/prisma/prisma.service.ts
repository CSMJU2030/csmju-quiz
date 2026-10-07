// Prisma 7 + driver adapter (PrismaPg) ตาม reference implementation
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { AppConfig } from '../config/app-config.service';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: AppConfig) {
    // จำกัด connection ต่อระบบ (deployment.md ข้อ 4.1) — ฐานกลางบน server ใช้ร่วมกันหลายระบบ
    super({
      adapter: new PrismaPg({
        connectionString: config.get('DATABASE_URL'),
        max: config.get('DATABASE_POOL_MAX'),
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

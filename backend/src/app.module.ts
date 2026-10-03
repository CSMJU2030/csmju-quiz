import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BankItemsModule } from './bank-items/bank-items.module';
import { AppConfigModule } from './config/config.module';
import { GameModule } from './game/game.module';
import { HealthController } from './health/health.controller';
import { HistoryModule } from './history/history.module';
import { PrismaModule } from './prisma/prisma.module';
import { QuizzesModule } from './quizzes/quizzes.module';
import { GameReportsModule } from './reports/game-reports.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AuthModule,
    QuizzesModule,
    BankItemsModule,
    GameModule,
    GameReportsModule,
    HistoryModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

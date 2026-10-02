import { Module } from '@nestjs/common';
import { GameHistoriesController } from './game-histories.controller';
import { GameStatsController } from './game-stats.controller';
import { GameHistoryService } from './history.service';

@Module({
  controllers: [GameHistoriesController, GameStatsController],
  providers: [GameHistoryService],
})
export class HistoryModule {}

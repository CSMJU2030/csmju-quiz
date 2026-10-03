import { Module } from '@nestjs/common';
import { GameReportsController } from './game-reports.controller';
import { GameReportsService } from './game-reports.service';

@Module({ controllers: [GameReportsController], providers: [GameReportsService] })
export class GameReportsModule {}

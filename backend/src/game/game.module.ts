import { Module } from '@nestjs/common';
import { QuizzesModule } from '../quizzes/quizzes.module';
import { GameEngine } from './game-engine.service';
import { GameHub } from './game-hub';
import { GameSessionsController } from './game-sessions.controller';
import { GameSessionsService } from './game-sessions.service';
import { GameStateFeed } from './game-state-feed';
import { GuestGamesController } from './guest-games.controller';

@Module({
  imports: [QuizzesModule],
  controllers: [GameSessionsController, GuestGamesController],
  providers: [GameHub, GameEngine, GameSessionsService, GameStateFeed],
  exports: [GameSessionsService],
})
export class GameModule {}

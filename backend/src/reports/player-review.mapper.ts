import { iso } from '../common/iso';
import type { PlayerGameResultView, PlayerGameReviewView } from './player-review.dto';
import type { PlayerGameResult, PlayerGameReview } from './player-review';

export function toResultView(r: PlayerGameResult): PlayerGameResultView {
  return {
    id: r.id,
    quizTitle: r.quizTitle,
    startedAt: iso(r.startedAt),
    finishedAt: iso(r.finishedAt)!,
    playerId: r.playerId,
    nickname: r.nickname,
    avatarIndex: r.avatarIndex,
    rank: r.rank,
    playerCount: r.playerCount,
    score: r.score,
    questionCount: r.questionCount,
    correct: r.correct,
    incorrect: r.incorrect,
    timeout: r.timeout,
    accuracy: r.accuracy,
    awards: r.awards,
  };
}

export function toReviewView(r: PlayerGameReview): PlayerGameReviewView {
  return {
    ...toResultView(r),
    maxStreak: r.maxStreak,
    averageResponseMs: r.averageResponseMs,
    answers: r.answers,
  };
}

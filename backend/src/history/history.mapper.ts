import { iso } from '../common/iso';
import type { PlayerStats } from '../reports/player-review';
import type { PlayerStatsView } from './history.dto';

export function toStatsView(s: PlayerStats): PlayerStatsView {
  return { ...s, lastPlayedAt: iso(s.lastPlayedAt) };
}

import type { GameSession } from '../models/game';
import type { TeamState } from '../models/team';

export function getWinningTeams(session: GameSession): TeamState[] {
  const highestScore = Math.max(...session.teams.map((team) => team.score));
  return session.teams.filter((team) => team.score === highestScore);
}

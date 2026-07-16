import type { GameSession } from '../models/game';
import type { TeamState } from '../models/team';
import { GameRuleError } from './errors';

export function getTeam(session: GameSession, teamId: string): TeamState {
  const team = session.teams.find((candidate) => candidate.id === teamId);
  if (!team) {
    throw new GameRuleError('INVALID_TEAM', `Unknown team ID "${teamId}"`);
  }

  return team;
}

export function replaceTeam(
  session: GameSession,
  teamId: string,
  update: (team: TeamState) => TeamState,
): GameSession {
  const [first, second] = session.teams;

  if (first.id === teamId) {
    return { ...session, teams: [update(first), second] };
  }
  if (second.id === teamId) {
    return { ...session, teams: [first, update(second)] };
  }

  throw new GameRuleError('INVALID_TEAM', `Unknown team ID "${teamId}"`);
}

export function getOpposingTeamId(session: GameSession, teamId: string): string {
  const [first, second] = session.teams;

  if (first.id === teamId) return second.id;
  if (second.id === teamId) return first.id;

  throw new GameRuleError('INVALID_TEAM', `Unknown team ID "${teamId}"`);
}

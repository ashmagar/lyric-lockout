import type { GameSession } from '../domain';
import type { CompletedGameSummary } from '../schemas';

export type ActiveSessionLoadResult =
  | { status: 'EMPTY' }
  | {
      status: 'VALID';
      session: GameSession;
      savedAt: string;
      raw: string;
    }
  | {
      status: 'CORRUPT' | 'UNSUPPORTED';
      message: string;
      raw: string;
    };

export interface GameSessionRepository {
  loadActiveSession(): ActiveSessionLoadResult;
  saveActiveSession(session: GameSession): void;
  clearActiveSession(): void;
  loadCompletedSummaries(): CompletedGameSummary[];
  saveCompletedSummary(summary: CompletedGameSummary): void;
}

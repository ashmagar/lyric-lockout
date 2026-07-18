import type { GameSession } from '../domain';
import {
  ACTIVE_GAME_ENVELOPE_VERSION,
  activeGameEnvelopeSchema,
  COMPLETED_GAME_SUMMARIES_ENVELOPE_VERSION,
  completedGameSummariesEnvelopeSchema,
  type CompletedGameSummary,
} from '../schemas';
import type { ActiveSessionLoadResult, GameSessionRepository } from './gameSessionRepository';

export const LEGACY_ACTIVE_GAME_STORAGE_KEY = 'lyric-lockout.active-game';
export const LEGACY_COMPLETED_GAMES_STORAGE_KEY = 'lyric-lockout.completed-games';
export const ACTIVE_GAME_STORAGE_KEY = 'lyric-lockout.v2.active-game';
export const COMPLETED_GAMES_STORAGE_KEY = 'lyric-lockout.v2.completed-games';

function readEnvelopeVersion(value: unknown): number | undefined {
  if (
    typeof value === 'object' &&
    value !== null &&
    'schemaVersion' in value &&
    typeof value.schemaVersion === 'number'
  ) {
    return value.schemaVersion;
  }

  return undefined;
}

export class LocalStorageGameSessionRepository implements GameSessionRepository {
  constructor(
    private readonly storage: Storage,
    private readonly now: () => Date = () => new Date(),
  ) {}

  loadActiveSession(): ActiveSessionLoadResult {
    this.clearLegacyStorage();
    const raw = this.storage.getItem(ACTIVE_GAME_STORAGE_KEY);
    if (raw === null) {
      return { status: 'EMPTY' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        status: 'CORRUPT',
        message: 'The saved game is not valid JSON.',
        raw,
      };
    }

    const version = readEnvelopeVersion(parsed);
    if (version !== ACTIVE_GAME_ENVELOPE_VERSION) {
      return {
        status: 'UNSUPPORTED',
        message:
          version === undefined
            ? 'The saved game has no recognized schema version.'
            : `Saved game schema version ${version} is not supported.`,
        raw,
      };
    }

    const result = activeGameEnvelopeSchema.safeParse(parsed);
    if (!result.success) {
      return {
        status: 'CORRUPT',
        message: 'The saved game failed validation and was not changed.',
        raw,
      };
    }

    return {
      status: 'VALID',
      session: result.data.session,
      savedAt: result.data.savedAt,
      raw,
    };
  }

  saveActiveSession(session: GameSession): void {
    this.clearLegacyStorage();
    const envelope = activeGameEnvelopeSchema.parse({
      schemaVersion: ACTIVE_GAME_ENVELOPE_VERSION,
      type: 'GAME_SESSION',
      savedAt: this.now().toISOString(),
      session,
    });

    this.storage.setItem(ACTIVE_GAME_STORAGE_KEY, JSON.stringify(envelope));
  }

  clearActiveSession(): void {
    this.clearLegacyStorage();
    this.storage.removeItem(ACTIVE_GAME_STORAGE_KEY);
  }

  loadCompletedSummaries(): CompletedGameSummary[] {
    this.clearLegacyStorage();
    const raw = this.storage.getItem(COMPLETED_GAMES_STORAGE_KEY);
    if (raw === null) {
      return [];
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      if (readEnvelopeVersion(parsed) !== COMPLETED_GAME_SUMMARIES_ENVELOPE_VERSION) {
        return [];
      }

      const result = completedGameSummariesEnvelopeSchema.safeParse(parsed);
      return result.success ? result.data.summaries : [];
    } catch {
      return [];
    }
  }

  saveCompletedSummary(summary: CompletedGameSummary): void {
    this.clearLegacyStorage();
    const existing = this.loadCompletedSummaries();
    const summaries = [
      summary,
      ...existing.filter((candidate) => candidate.gameId !== summary.gameId),
    ];
    const envelope = completedGameSummariesEnvelopeSchema.parse({
      schemaVersion: COMPLETED_GAME_SUMMARIES_ENVELOPE_VERSION,
      type: 'COMPLETED_GAME_SUMMARIES',
      savedAt: this.now().toISOString(),
      summaries,
    });

    this.storage.setItem(COMPLETED_GAMES_STORAGE_KEY, JSON.stringify(envelope));
  }

  private clearLegacyStorage(): void {
    this.storage.removeItem(LEGACY_ACTIVE_GAME_STORAGE_KEY);
    this.storage.removeItem(LEGACY_COMPLETED_GAMES_STORAGE_KEY);
  }
}

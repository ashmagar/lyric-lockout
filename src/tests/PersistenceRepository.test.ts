import { describe, expect, it } from 'vitest';

import { createGame } from '../domain';
import { ACTIVE_GAME_STORAGE_KEY, LocalStorageGameSessionRepository } from '../repositories';
import { GAMEPLAY_ROUND_CONFIG } from '../features/game/gameplayCatalog';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  failWrites = false;

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    if (this.failWrites) throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
    this.values.set(key, value);
  }
}

function game(id = 'game-one') {
  return createGame({
    id,
    createdAt: '2026-07-16T18:00:00.000Z',
    teams: [
      { id: 'team-a', name: 'Alpha' },
      { id: 'team-b', name: 'Beta' },
    ],
    roundConfig: GAMEPLAY_ROUND_CONFIG,
  });
}

describe('LocalStorageGameSessionRepository', () => {
  it('round-trips a validated, versioned active game envelope', () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageGameSessionRepository(
      storage,
      () => new Date('2026-07-16T18:05:00.000Z'),
    );

    repository.saveActiveSession(game());

    expect(repository.loadActiveSession()).toMatchObject({
      status: 'VALID',
      savedAt: '2026-07-16T18:05:00.000Z',
      session: { id: 'game-one', phase: 'GAME_SETUP' },
    });
    expect(JSON.parse(storage.getItem(ACTIVE_GAME_STORAGE_KEY) ?? '{}')).toMatchObject({
      schemaVersion: 1,
      type: 'GAME_SESSION',
    });
  });

  it('preserves and reports corrupt and unsupported active data', () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageGameSessionRepository(storage);

    storage.setItem(ACTIVE_GAME_STORAGE_KEY, '{not-json');
    expect(repository.loadActiveSession()).toMatchObject({
      status: 'CORRUPT',
      raw: '{not-json',
    });
    expect(storage.getItem(ACTIVE_GAME_STORAGE_KEY)).toBe('{not-json');

    const unsupported = JSON.stringify({ schemaVersion: 99, type: 'GAME_SESSION' });
    storage.setItem(ACTIVE_GAME_STORAGE_KEY, unsupported);
    expect(repository.loadActiveSession()).toMatchObject({
      status: 'UNSUPPORTED',
      raw: unsupported,
    });
    expect(storage.getItem(ACTIVE_GAME_STORAGE_KEY)).toBe(unsupported);
  });

  it('leaves the previous valid save intact when a write fails', () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageGameSessionRepository(storage);
    repository.saveActiveSession(game('stable-game'));
    const original = storage.getItem(ACTIVE_GAME_STORAGE_KEY);

    storage.failWrites = true;

    expect(() => repository.saveActiveSession(game('replacement-game'))).toThrow(
      'Storage quota exceeded',
    );
    expect(storage.getItem(ACTIVE_GAME_STORAGE_KEY)).toBe(original);
  });

  it('stores completed summaries separately and de-duplicates by game id', () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageGameSessionRepository(storage);
    const summary = {
      schemaVersion: 1 as const,
      gameId: 'game-one',
      completedAt: '2026-07-16T19:00:00.000Z',
      teams: [
        { id: 'team-a', name: 'Alpha', score: 100 },
        { id: 'team-b', name: 'Beta', score: 50 },
      ],
      winnerTeamIds: ['team-a'],
    };

    repository.saveCompletedSummary(summary);
    repository.saveCompletedSummary({
      ...summary,
      teams: [
        { id: 'team-a', name: 'Alpha', score: 125 },
        { id: 'team-b', name: 'Beta', score: 50 },
      ],
    });

    expect(repository.loadCompletedSummaries()).toEqual([
      expect.objectContaining({
        gameId: 'game-one',
        teams: [expect.objectContaining({ score: 125 }), expect.anything()],
      }),
    ]);
  });
});

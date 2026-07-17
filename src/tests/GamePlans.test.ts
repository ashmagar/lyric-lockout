import { beforeEach, describe, expect, it } from 'vitest';

import {
  DIFFICULTY_LEVELS,
  createGamePlan,
  duplicateGamePlan,
  startGameFromPlan,
  validateGamePlan,
  type GamePlan,
} from '../domain';
import { getCatalogCandidates } from '../domain/catalog';
import { GAMEPLAY_CATALOG_INDEX } from '../features/game/gameplayCatalog';
import { GAME_PLANS_STORAGE_KEY, LocalStorageGamePlanRepository } from '../repositories';
import { configureGamePlanRepository, useGamePlanStore } from '../store/gamePlanStore';

const TIMESTAMP = '2026-07-16T20:00:00.000Z';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
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
    this.values.set(key, value);
  }
}

function plan(): GamePlan {
  return createGamePlan({
    id: 'plan-one',
    name: 'Friday Party',
    createdAt: TIMESTAMP,
    catalog: GAMEPLAY_CATALOG_INDEX,
  });
}

function curatedPools() {
  return GAMEPLAY_CATALOG_INDEX.snapshot.categories.map((category) => ({
    categoryId: category.id,
    approvedChallengeIdsByDifficulty: Object.fromEntries(
      DIFFICULTY_LEVELS.map((difficulty) => [
        difficulty,
        getCatalogCandidates(GAMEPLAY_CATALOG_INDEX, category.id, difficulty).map(
          (candidate) => candidate.challenge.id,
        ),
      ]),
    ),
  }));
}

function start(source: GamePlan, gameId: string, acceptWarnings = false) {
  return startGameFromPlan({
    plan: source,
    catalog: GAMEPLAY_CATALOG_INDEX,
    random: () => 0,
    validatedAt: TIMESTAMP,
    gameId,
    teams: [
      { id: 'team-a', name: 'Alpha' },
      { id: 'team-b', name: 'Beta' },
    ],
    acceptWarnings,
  });
}

describe('Saved Game Plan domain lifecycle', () => {
  it('reuses one plan for multiple independent sessions', () => {
    const source = validateGamePlan({
      plan: plan(),
      catalog: GAMEPLAY_CATALOG_INDEX,
      random: () => 0,
      validatedAt: TIMESTAMP,
    });

    const first = start(source, 'game-one');
    const second = start(source, 'game-two');

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error('Expected valid plan starts');
    expect(first.session.id).not.toBe(second.session.id);
    first.session.roundConfig.selectedCategoryIds.pop();
    first.session.gameConfig.answerSecondsByDifficulty[1] = 999;
    expect(second.session.roundConfig.selectedCategoryIds).toHaveLength(10);
    expect(second.session.gameConfig.answerSecondsByDifficulty[1]).toBe(30);
    expect(source.roundConfig.selectedCategoryIds).toHaveLength(10);
  });

  it('editing a plan cannot mutate a game already created from it', () => {
    const source = plan();
    source.revealSongBeforePlayback = false;
    const result = start(source, 'active-game');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected valid plan start');

    source.name = 'Edited after start';
    source.roundConfig.selectedCategoryIds.reverse();
    source.gameConfig.fullPointsByDifficulty[1] = 777;

    expect(result.session.gameConfig.fullPointsByDifficulty[1]).toBe(100);
    expect(result.session.gameConfig.revealSongBeforePlayback).toBe(false);
    expect(result.session.roundConfig.selectedCategoryIds[0]).toBe('90s-bollywood');
  });

  it('blocks invalid plans from starting', () => {
    const invalid = plan();
    invalid.roundConfig.selectedCategoryIds.pop();

    const result = start(invalid, 'invalid-game');

    expect(result).toMatchObject({
      ok: false,
      code: 'INVALID_PLAN',
      plan: { status: 'INVALID' },
    });
  });

  it('requires explicit acceptance before a warning plan starts', () => {
    const warningPlan = plan();
    warningPlan.roundConfig.manualChallengePools = curatedPools();

    const blocked = start(warningPlan, 'warning-game');
    const accepted = start(warningPlan, 'accepted-game', true);

    expect(blocked).toMatchObject({
      ok: false,
      code: 'WARNING_ACCEPTANCE_REQUIRED',
      plan: { status: 'READY_WITH_WARNINGS' },
    });
    expect(accepted).toMatchObject({
      ok: true,
      plan: { status: 'READY_WITH_WARNINGS' },
    });
  });

  it('duplicates with a new identity while preserving curated pools', () => {
    const source = plan();
    source.roundConfig.songSelectionMode = 'CURATED_POOL';
    source.roundConfig.manualChallengePools = curatedPools();

    const duplicate = duplicateGamePlan(source, 'plan-copy', TIMESTAMP);

    expect(duplicate.id).toBe('plan-copy');
    expect(duplicate.id).not.toBe(source.id);
    expect(duplicate.status).toBe('DRAFT');
    expect(duplicate.roundConfig.manualChallengePools).toEqual(
      source.roundConfig.manualChallengePools,
    );
    duplicate.roundConfig.manualChallengePools[0]?.approvedChallengeIdsByDifficulty[1]?.pop();
    expect(
      source.roundConfig.manualChallengePools[0]?.approvedChallengeIdsByDifficulty[1],
    ).toHaveLength(2);
  });
});

describe('Saved Game Plan repository and store', () => {
  let storage: MemoryStorage;
  let repository: LocalStorageGamePlanRepository;

  beforeEach(() => {
    storage = new MemoryStorage();
    repository = new LocalStorageGamePlanRepository(storage, () => new Date(TIMESTAMP));
    configureGamePlanRepository(repository);
    useGamePlanStore.setState({
      status: 'UNINITIALIZED',
      plans: [],
      storageIssue: undefined,
      error: undefined,
    });
  });

  it('round-trips multiple plans and preserves curated pools as detached data', () => {
    const curated = plan();
    curated.roundConfig.songSelectionMode = 'CURATED_POOL';
    curated.roundConfig.manualChallengePools = curatedPools();
    repository.savePlan(curated);
    repository.savePlan({ ...plan(), id: 'plan-two', name: 'Second Plan' });
    repository.savePlan({ ...plan(), id: 'plan-three', name: 'Third Plan' });

    const loaded = repository.loadPlans();

    expect(loaded.status).toBe('VALID');
    expect(loaded.plans).toHaveLength(3);
    const loadedCurated = loaded.plans.find((candidate) => candidate.id === curated.id);
    expect(loadedCurated?.roundConfig.manualChallengePools).toEqual(
      curated.roundConfig.manualChallengePools,
    );
    loadedCurated?.roundConfig.manualChallengePools[0]?.approvedChallengeIdsByDifficulty[1]?.pop();
    expect(
      repository.loadPlans().plans.find((candidate) => candidate.id === curated.id)?.roundConfig
        .manualChallengePools[0]?.approvedChallengeIdsByDifficulty[1],
    ).toHaveLength(2);
  });

  it('store duplication persists a new plan ID', () => {
    repository.savePlan(plan());
    useGamePlanStore.getState().initialize();

    const duplicate = useGamePlanStore.getState().duplicatePlan('plan-one');

    expect(duplicate?.id).not.toBe('plan-one');
    expect(repository.loadPlans().plans.map((candidate) => candidate.id)).toContain(duplicate?.id);
  });

  it('store rename and delete operations persist their result', () => {
    repository.savePlan(plan());
    useGamePlanStore.getState().initialize();

    expect(useGamePlanStore.getState().renamePlan('plan-one', 'Renamed Plan')).toBe(true);
    expect(repository.loadPlans().plans[0]?.name).toBe('Renamed Plan');
    expect(useGamePlanStore.getState().deletePlan('plan-one')).toBe(true);
    expect(repository.loadPlans().plans).toEqual([]);
  });

  it('preserves corrupt storage instead of overwriting it', () => {
    storage.setItem(GAME_PLANS_STORAGE_KEY, '{bad-json');

    useGamePlanStore.getState().initialize();

    expect(useGamePlanStore.getState().storageIssue).toMatchObject({ kind: 'CORRUPT' });
    expect(storage.getItem(GAME_PLANS_STORAGE_KEY)).toBe('{bad-json');
  });
});

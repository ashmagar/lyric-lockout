import { beforeEach, describe, expect, it } from 'vitest';

import { createGamePlan, DIFFICULTY_LEVELS, startGameFromPlan } from '../domain';
import { getCatalogCandidates } from '../domain/catalog';
import { GAMEPLAY_CATALOG_INDEX, GAMEPLAY_CATEGORIES } from '../features/game/gameplayCatalog';
import {
  getRuntimeCatalogIndex,
  resetRuntimeCatalog,
  updateRuntimeCatalog,
} from '../features/game/runtimeCatalog';
import { configureGameplayRepository, useGameplayStore } from '../store/gameplayStore';

describe('gameplay application store', () => {
  beforeEach(() => {
    localStorage.clear();
    configureGameplayRepository(undefined);
    resetRuntimeCatalog();
    useGameplayStore.getState().reset();
    useGameplayStore.setState({ completedSummaries: [] });
  });

  it('creates two teams and advances through round validation by dispatching commands', () => {
    const store = useGameplayStore.getState();
    store.startSetup('Alpha', 'Beta');

    expect(useGameplayStore.getState().session).toMatchObject({
      phase: 'ROUND_BUILDING',
      teams: [{ name: 'Alpha' }, { name: 'Beta' }],
    });

    useGameplayStore.getState().send({ type: 'VALIDATE_ROUND' });
    expect(useGameplayStore.getState().session?.phase).toBe('ROUND_VALIDATION');

    useGameplayStore.getState().send({ type: 'START_GAME' });
    expect(useGameplayStore.getState().session?.phase).toBe('LEVEL_INTRO');
  });

  it('preserves random category selection mode when starting setup', () => {
    useGameplayStore.getState().startSetup(
      'Alpha',
      'Beta',
      GAMEPLAY_CATEGORIES.map((category) => category.id),
      'RANDOM',
    );

    expect(useGameplayStore.getState().session?.roundConfig.categorySelectionMode).toBe('RANDOM');
  });

  it('lets the host choose the first team without exposing trivia phases', () => {
    useGameplayStore.getState().startSetup('Alpha', 'Beta');
    useGameplayStore.getState().send({ type: 'VALIDATE_ROUND' });
    useGameplayStore.getState().send({ type: 'START_GAME' });

    useGameplayStore.getState().chooseFirstTeam('team-b');

    expect(useGameplayStore.getState().session).toMatchObject({
      phase: 'CATEGORY_ASSIGNMENT',
      activeTurn: {
        primaryTeamId: 'team-b',
        opposingTeamId: 'team-a',
      },
    });
  });

  it('automatically finishes when no selected category has an eligible challenge', () => {
    updateRuntimeCatalog(GAMEPLAY_CATEGORIES, []);
    const store = useGameplayStore.getState();
    store.startSetup('Alpha', 'Beta');
    useGameplayStore.getState().send({ type: 'VALIDATE_ROUND' });
    useGameplayStore.getState().send({ type: 'START_GAME' });

    useGameplayStore.getState().chooseFirstTeam('team-a');

    expect(useGameplayStore.getState().session).toMatchObject({
      phase: 'GAME_SUMMARY',
      status: 'COMPLETED',
    });
    expect(useGameplayStore.getState().completedSummaries).toHaveLength(1);
    expect(useGameplayStore.getState().failure).toBeUndefined();
  });

  it('replaces demo content with the authored runtime catalog', () => {
    const sourceCategory = GAMEPLAY_CATEGORIES[0]!;
    const sourceSong = GAMEPLAY_CATALOG_INDEX.songById.get('song-90s-bollywood');
    if (!sourceSong) throw new Error('Expected a bundled source song');
    const authoredCategory = {
      ...sourceCategory,
      id: 'category-authored-runtime',
      name: 'Authored Runtime Category',
    };
    const authoredSong = {
      ...sourceSong,
      id: 'song-authored-runtime',
      title: 'Authored Runtime Song',
      categoryIds: [authoredCategory.id],
      challenges: sourceSong.challenges.map((challenge) => ({
        ...challenge,
        id: `authored-${challenge.id}`,
      })),
    };

    const index = updateRuntimeCatalog([authoredCategory], [authoredSong]);

    expect(index.snapshot.categories.map((category) => category.id)).toEqual([authoredCategory.id]);
    expect(index.snapshot.songs.map((song) => song.id)).toEqual([authoredSong.id]);
    expect(getCatalogCandidates(index, authoredCategory.id, 1)[0]?.song.title).toBe(
      'Authored Runtime Song',
    );
    expect(index.songById.has('song-90s-bollywood')).toBe(false);
  });

  it('selects a replacement challenge while preserving the assigned category', () => {
    const store = useGameplayStore.getState();
    store.startSetup('Alpha', 'Beta');
    useGameplayStore.getState().send({ type: 'VALIDATE_ROUND' });
    useGameplayStore.getState().send({ type: 'START_GAME' });
    useGameplayStore.getState().send({ type: 'BEGIN_TRIVIA' });
    useGameplayStore.getState().send({ type: 'RECORD_TRIVIA_WINNER', teamId: 'team-a' });
    useGameplayStore.getState().confirmTurnOrder('team-a');
    useGameplayStore.getState().assignCategory('90s-bollywood', 'SELF_SELECTED');
    useGameplayStore.getState().selectChallenge();

    const first = useGameplayStore.getState().session?.activeChallenge?.challenge.id;
    useGameplayStore.getState().send({ type: 'REROLL_CHALLENGE' });
    useGameplayStore.getState().selectChallenge();
    const replacement = useGameplayStore.getState().session?.activeChallenge?.challenge.id;

    expect(first).toBe('challenge-90s-bollywood-1-1');
    expect(replacement).toBe('challenge-90s-bollywood-1-2');
    expect(useGameplayStore.getState().session?.activeTurn?.categoryId).toBe('90s-bollywood');
  });

  it('uses the active plan snapshot to restrict curated challenge selection', () => {
    const createdAt = new Date().toISOString();
    const plan = createGamePlan({
      id: 'curated-plan',
      name: 'Curated Party',
      createdAt,
      catalog: GAMEPLAY_CATALOG_INDEX,
    });
    plan.roundConfig.songSelectionMode = 'CURATED_POOL';
    plan.roundConfig.manualChallengePools = GAMEPLAY_CATALOG_INDEX.snapshot.categories.map(
      (category) => ({
        categoryId: category.id,
        approvedChallengeIdsByDifficulty: Object.fromEntries(
          DIFFICULTY_LEVELS.map((difficulty) => [
            difficulty,
            [
              getCatalogCandidates(GAMEPLAY_CATALOG_INDEX, category.id, difficulty)[1]!.challenge
                .id,
            ],
          ]),
        ),
      }),
    );
    const start = startGameFromPlan({
      plan,
      catalog: GAMEPLAY_CATALOG_INDEX,
      random: () => 0,
      validatedAt: createdAt,
      gameId: 'curated-game',
      teams: [
        { id: 'team-a', name: 'Alpha' },
        { id: 'team-b', name: 'Beta' },
      ],
      acceptWarnings: false,
    });
    expect(start.ok).toBe(true);
    if (!start.ok) throw new Error(start.message);

    useGameplayStore.getState().startSession(start.session);
    useGameplayStore.getState().send({ type: 'VALIDATE_ROUND' });
    useGameplayStore.getState().send({ type: 'START_GAME' });
    useGameplayStore.getState().send({ type: 'BEGIN_TRIVIA' });
    useGameplayStore.getState().send({ type: 'RECORD_TRIVIA_WINNER', teamId: 'team-a' });
    useGameplayStore.getState().confirmTurnOrder('team-a');
    useGameplayStore.getState().assignCategory('90s-bollywood', 'SELF_SELECTED');
    useGameplayStore.getState().selectChallenge();

    expect(useGameplayStore.getState().session?.activeChallenge?.challenge.id).toBe(
      'challenge-90s-bollywood-1-2',
    );
  });

  it('finishes when an assigned category has no challenge left to play', () => {
    const sourceSong = GAMEPLAY_CATALOG_INDEX.songById.get('song-90s-bollywood');
    const romanticSong = GAMEPLAY_CATALOG_INDEX.songById.get('song-romantic');
    if (!sourceSong || !romanticSong) throw new Error('Expected bundled test songs');

    const sharedSong = {
      ...sourceSong,
      id: 'song-shared-across-categories',
      categoryIds: ['90s-bollywood', 'romantic'],
      challenges: sourceSong.challenges.map((challenge) => ({
        ...challenge,
        id: `shared-${challenge.id}`,
      })),
    };
    updateRuntimeCatalog(GAMEPLAY_CATEGORIES, [
      sharedSong,
      {
        ...romanticSong,
        enabled: false,
      },
    ]);

    const store = useGameplayStore.getState();
    store.startSetup('Alpha', 'Beta');
    useGameplayStore.getState().send({ type: 'VALIDATE_ROUND' });
    useGameplayStore.getState().send({ type: 'START_GAME' });
    useGameplayStore.getState().send({ type: 'BEGIN_TRIVIA' });
    useGameplayStore.getState().send({ type: 'RECORD_TRIVIA_WINNER', teamId: 'team-a' });
    useGameplayStore.getState().confirmTurnOrder('team-a');
    useGameplayStore.getState().assignCategory('romantic', 'SELF_SELECTED');

    const session = useGameplayStore.getState().session;
    if (!session) throw new Error('Expected an active gameplay session');
    useGameplayStore.setState({
      session: {
        ...session,
        playedSongIds: [sharedSong.id],
      },
    });

    useGameplayStore.getState().selectChallenge();

    expect(useGameplayStore.getState().session?.activeChallenge).toBeUndefined();
    expect(useGameplayStore.getState().session).toMatchObject({
      phase: 'GAME_SUMMARY',
      status: 'COMPLETED',
    });
    expect(useGameplayStore.getState().failure).toBeUndefined();
  });

  it('keeps an active challenge detached from later Admin catalog edits', () => {
    const store = useGameplayStore.getState();
    store.startSetup('Alpha', 'Beta');
    useGameplayStore.getState().send({ type: 'VALIDATE_ROUND' });
    useGameplayStore.getState().send({ type: 'START_GAME' });
    useGameplayStore.getState().send({ type: 'BEGIN_TRIVIA' });
    useGameplayStore.getState().send({ type: 'RECORD_TRIVIA_WINNER', teamId: 'team-a' });
    useGameplayStore.getState().confirmTurnOrder('team-a');
    useGameplayStore.getState().assignCategory('90s-bollywood', 'SELF_SELECTED');
    useGameplayStore.getState().selectChallenge();

    const activeSong = useGameplayStore.getState().session?.activeChallenge?.song;
    expect(activeSong).toBeDefined();
    if (!activeSong) throw new Error('Expected an active song.');

    const originalTitle = activeSong.title;
    updateRuntimeCatalog(GAMEPLAY_CATEGORIES, [
      {
        ...activeSong,
        title: 'Edited after the game started',
      },
    ]);

    expect(getRuntimeCatalogIndex().songById.get(activeSong.id)?.title).toBe(
      'Edited after the game started',
    );
    expect(useGameplayStore.getState().session?.activeChallenge?.song.title).toBe(originalTitle);
  });
});

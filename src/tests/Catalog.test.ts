import { describe, expect, it } from 'vitest';

import categoriesData from '../../data/categories.json';
import { loadCatalog } from '../application/catalog';
import { SCHEMA_VERSIONS } from '../domain/constants';
import {
  analyzeCatalogCoverage,
  buildRoundConfig,
  getCatalogCandidates,
  selectChallenge,
  validateRoundConfig,
  type CatalogIndex,
  type RoundBuildRequest,
} from '../domain/catalog';
import { DIFFICULTY_LEVELS, type DifficultyLevel } from '../domain/enums';
import type { CatalogData, Category, Challenge, Song } from '../domain/models/catalog';
import type { ChallengeSelectionRequest } from '../domain/models/game';
import type { ManualChallengePool } from '../domain/models/round';
import {
  createBundledCatalogRepository,
  InMemoryCatalogRepository,
  StaticJsonCatalogRepository,
} from '../repositories';

const TIMESTAMP = '2026-07-16T12:00:00.000Z';

function makeCategory(id: string, displayOrder = 1): Category {
  return {
    id,
    schemaVersion: SCHEMA_VERSIONS.category,
    name: `Category ${id}`,
    displayOrder,
    enabled: true,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

function makeChallenge(id: string, difficulty: DifficultyLevel): Challenge {
  return {
    id,
    difficulty,
    playbackStartSeconds: 10,
    pauseAtSeconds: 20,
    verifyFromSeconds: 18,
    verifyToSeconds: 28,
    expectedLyrics: `Expected lyrics ${id}`,
    missingWordCount: difficulty + 2,
    hintText: `Hint ${id}`,
    enabled: true,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

function makeSong(id: string, categoryIds: string[], challenges: Challenge[]): Song {
  return {
    id,
    schemaVersion: SCHEMA_VERSIONS.song,
    title: `Song ${id}`,
    artist: 'Catalog Test Artist',
    youtubeVideoId: `video-${id}`,
    videoType: 'LYRIC',
    categoryIds,
    enabled: true,
    challenges,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

function makeCompleteCatalog(categoryCount = 12, challengeDepth = 1): CatalogData {
  const categories = Array.from({ length: categoryCount }, (_, index) =>
    makeCategory(`category-${index + 1}`, index + 1),
  );
  const songs = categories.flatMap((category) =>
    DIFFICULTY_LEVELS.map((difficulty) =>
      makeSong(
        `song-${category.id}-${difficulty}`,
        [category.id],
        Array.from({ length: challengeDepth }, (_, index) =>
          makeChallenge(`challenge-${category.id}-${difficulty}-${index + 1}`, difficulty),
        ),
      ),
    ),
  );
  return { categories, songs };
}

async function loadIndex(catalog: CatalogData): Promise<CatalogIndex> {
  return (await loadCatalog(new InMemoryCatalogRepository(catalog))).index;
}

function createCuratedPools(index: CatalogIndex): ManualChallengePool[] {
  return index.snapshot.categories.map((category) => ({
    categoryId: category.id,
    approvedChallengeIdsByDifficulty: Object.fromEntries(
      DIFFICULTY_LEVELS.map((difficulty) => [
        difficulty,
        getCatalogCandidates(index, category.id, difficulty).map(
          (candidate) => candidate.challenge.id,
        ),
      ]),
    ),
  }));
}

function selectionRequest(
  values: Partial<ChallengeSelectionRequest> = {},
): ChallengeSelectionRequest {
  return {
    categoryId: 'category-1',
    difficulty: 1,
    songSelectionMode: 'FULL_CATALOG',
    excludedChallengeIds: [],
    excludedSongIds: [],
    allowSongReuseFallback: false,
    ...values,
  };
}

describe('catalog repositories and partial loading', () => {
  it('loads valid content while excluding structural, referential, and duplicate songs', async () => {
    const category = makeCategory('category-1');
    const validSong = makeSong('valid-song', [category.id], [makeChallenge('valid-challenge', 1)]);
    const invalidSemanticSong = makeSong(
      'invalid-semantic',
      [category.id],
      [{ ...makeChallenge('invalid-time', 1), pauseAtSeconds: 5 }],
    );
    const unknownCategorySong = makeSong(
      'unknown-category',
      ['missing-category'],
      [makeChallenge('unknown-category-challenge', 1)],
    );
    const duplicateSong = makeSong(
      'valid-song',
      [category.id],
      [makeChallenge('different-challenge', 1)],
    );
    const duplicateChallengeSong = makeSong(
      'duplicate-challenge-song',
      [category.id],
      [makeChallenge('valid-challenge', 2)],
    );
    const repository = new StaticJsonCatalogRepository({
      categories: {
        source: 'categories.json',
        value: [category, { ...category }],
      },
      songs: [
        { source: 'valid.json', value: validSong },
        { source: 'invalid-semantic.json', value: invalidSemanticSong },
        { source: 'unknown-category.json', value: unknownCategorySong },
        { source: 'duplicate-song.json', value: duplicateSong },
        { source: 'duplicate-challenge.json', value: duplicateChallengeSong },
      ],
    });

    const result = await loadCatalog(repository);

    expect(result.snapshot.categories.map((item) => item.id)).toEqual(['category-1']);
    expect(result.snapshot.songs.map((song) => song.id)).toEqual(['valid-song']);
    expect(result.excludedSongSources).toEqual([
      'invalid-semantic.json',
      'unknown-category.json',
      'duplicate-song.json',
      'duplicate-challenge.json',
    ]);
    expect(result.issues.map((catalogIssue) => catalogIssue.code)).toEqual(
      expect.arrayContaining([
        'DUPLICATE_CATEGORY_ID',
        'INVALID_SONG',
        'UNKNOWN_CATEGORY_REFERENCE',
        'DUPLICATE_SONG_ID',
        'DUPLICATE_CHALLENGE_ID',
      ]),
    );
    expect(result.index.challengeById.has('valid-challenge')).toBe(true);
    expect(result.index.challengeById.has('invalid-time')).toBe(false);
  });

  it('loads the bundled static JSON catalog through repository interfaces', async () => {
    const result = await loadCatalog(createBundledCatalogRepository());

    expect(result.snapshot.categories).toHaveLength(categoriesData.length);
    expect(result.snapshot.categories.length).toBeGreaterThanOrEqual(10);
    expect(result.snapshot.songs).toHaveLength(2);
    expect(result.issues).toEqual([]);
  });

  it('creates a detached snapshot that is not changed by later source edits', async () => {
    const catalog = makeCompleteCatalog(1);
    const result = await loadCatalog(new InMemoryCatalogRepository(catalog));
    catalog.categories[0]!.name = 'Changed after load';
    catalog.songs[0]!.title = 'Changed after load';

    expect(result.snapshot.categories[0]?.name).toBe('Category category-1');
    expect(result.snapshot.songs[0]?.title).toBe('Song song-category-1-1');
  });
});

describe('indexing and coverage', () => {
  it('reports exact enabled challenge counts for every category and level', async () => {
    const catalog = makeCompleteCatalog(1, 3);
    catalog.songs.push(
      {
        ...makeSong('disabled-song', ['category-1'], [makeChallenge('disabled-song-challenge', 1)]),
        enabled: false,
      },
      makeSong(
        'partially-disabled',
        ['category-1'],
        [{ ...makeChallenge('disabled-challenge', 1), enabled: false }],
      ),
    );
    const index = await loadIndex(catalog);
    const coverage = analyzeCatalogCoverage(index);
    const category = coverage.categories[0];

    expect(category?.isReady).toBe(true);
    expect(category?.hasRecommendedDepth).toBe(true);
    for (const difficulty of DIFFICULTY_LEVELS) {
      expect(category?.byDifficulty[difficulty].challengeCount).toBe(3);
    }
    expect(coverage.readyCategoryCount).toBe(1);
  });
});

describe('round validation and building', () => {
  it.each([
    ['MANUAL', 'FULL_CATALOG'],
    ['MANUAL', 'CURATED_POOL'],
    ['RANDOM', 'FULL_CATALOG'],
    ['RANDOM', 'CURATED_POOL'],
  ] as const)('builds %s categories with %s song selection', async (categoryMode, songMode) => {
    const index = await loadIndex(makeCompleteCatalog());
    const pools = createCuratedPools(index);
    const request: RoundBuildRequest = {
      categorySelectionMode: categoryMode,
      songSelectionMode: songMode,
      manualCategoryIds: index.snapshot.categories.slice(0, 10).map((category) => category.id),
      manualChallengePools: songMode === 'CURATED_POOL' ? pools : [],
      preventChallengeReuse: true,
      preventSongReuse: true,
      allowRuntimeReroll: true,
      randomSeed: 'deterministic-test',
    };

    const result = buildRoundConfig(request, index, () => 0);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.diagnostics.map((item) => item.message).join('\n'));
    expect(result.config.selectedCategoryIds).toHaveLength(10);
    expect(new Set(result.config.selectedCategoryIds).size).toBe(10);
    expect(result.config.selectedCategoryIds).toEqual(
      index.snapshot.categories.slice(0, 10).map((category) => category.id),
    );
    expect(validateRoundConfig(result.config, index).valid).toBe(true);
  });

  it('returns structured round diagnostics for missing coverage and unknown pool entries', async () => {
    const index = await loadIndex(makeCompleteCatalog(10));
    const pools = createCuratedPools(index);
    pools[0]!.approvedChallengeIdsByDifficulty[1] = ['missing-challenge'];
    const result = buildRoundConfig(
      {
        categorySelectionMode: 'MANUAL',
        songSelectionMode: 'CURATED_POOL',
        manualCategoryIds: index.snapshot.categories.map((category) => category.id),
        manualChallengePools: pools,
        preventChallengeReuse: true,
        preventSongReuse: true,
        allowRuntimeReroll: true,
      },
      index,
      () => 0,
    );

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining(['UNKNOWN_CURATED_CHALLENGE', 'MISSING_CURATED_COVERAGE']),
    );
  });
});

describe('eligible challenge selection', () => {
  it('restricts curated selection to approved challenge IDs', async () => {
    const index = await loadIndex(makeCompleteCatalog(1, 3));
    const candidates = getCatalogCandidates(index, 'category-1', 1);
    const approvedId = candidates[1]!.challenge.id;

    const result = selectChallenge(
      index,
      selectionRequest({
        songSelectionMode: 'CURATED_POOL',
        approvedChallengeIds: [approvedId],
      }),
      () => 0.99,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected curated selection');
    expect(result.candidate.challenge.id).toBe(approvedId);
    expect(result.counts.approved).toBe(1);
  });

  it('never returns played or rejected challenges', async () => {
    const index = await loadIndex(makeCompleteCatalog(1, 3));
    const candidates = getCatalogCandidates(index, 'category-1', 1);
    const playedChallengeId = candidates[0]!.challenge.id;
    const rejectedChallengeId = candidates[1]!.challenge.id;
    const remainingChallengeId = candidates[2]!.challenge.id;

    const selected = selectChallenge(
      index,
      selectionRequest({ excludedChallengeIds: [playedChallengeId, rejectedChallengeId] }),
      () => 0,
    );
    expect(selected.ok).toBe(true);
    if (!selected.ok) throw new Error('Expected remaining challenge');
    expect(selected.candidate.challenge.id).toBe(remainingChallengeId);

    const exhausted = selectChallenge(
      index,
      selectionRequest({
        excludedChallengeIds: [playedChallengeId, rejectedChallengeId, remainingChallengeId],
      }),
      () => 0,
    );
    expect(exhausted.ok).toBe(false);
    expect(exhausted.diagnostics[0]?.code).toBe('ALL_CHALLENGES_EXCLUDED');
  });

  it('flags song reuse fallback while still preventing challenge reuse', async () => {
    const index = await loadIndex(makeCompleteCatalog(1, 2));
    const candidates = getCatalogCandidates(index, 'category-1', 1);
    const playedChallengeId = candidates[0]!.challenge.id;
    const remainingChallengeId = candidates[1]!.challenge.id;
    const playedSongId = candidates[0]!.song.id;

    const result = selectChallenge(
      index,
      selectionRequest({
        excludedChallengeIds: [playedChallengeId],
        excludedSongIds: [playedSongId],
        allowSongReuseFallback: true,
      }),
      () => 0,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected song reuse fallback');
    expect(result.candidate.challenge.id).toBe(remainingChallengeId);
    expect(result.usedSongReuseFallback).toBe(true);
    expect(result.diagnostics[0]?.code).toBe('SONG_REUSE_FALLBACK_USED');
  });

  it('returns structured diagnostics instead of throwing when no challenge is valid', async () => {
    const index = await loadIndex(makeCompleteCatalog(1));
    const result = selectChallenge(
      index,
      selectionRequest({
        songSelectionMode: 'CURATED_POOL',
        approvedChallengeIds: ['not-in-catalog'],
      }),
      () => 0,
    );

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({
      code: 'NO_APPROVED_CHALLENGES',
      severity: 'ERROR',
      kind: 'AVAILABILITY',
    });
  });
});

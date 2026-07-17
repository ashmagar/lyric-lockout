import { GameRuleError, selectRandomItem, type RandomSource } from '../engine';
import { DIFFICULTY_LEVELS } from '../enums';
import type { SelectionMode, SongSelectionMode } from '../enums';
import type { ManualChallengePool, RoundCreationConfig } from '../models/round';
import { getCatalogCandidates } from './indexing';
import type { CatalogIndex, ValidationDiagnostic } from './types';

const REQUIRED_CATEGORY_COUNT = 10;

export interface RoundValidationResult {
  valid: boolean;
  issues: ValidationDiagnostic[];
}

export interface RoundBuildRequest {
  categorySelectionMode: SelectionMode;
  songSelectionMode: SongSelectionMode;
  manualCategoryIds: readonly string[];
  manualChallengePools: readonly ManualChallengePool[];
  preventChallengeReuse: boolean;
  preventSongReuse: boolean;
  allowRuntimeReroll: boolean;
  randomSeed?: string | undefined;
}

export interface RoundBuildSuccess {
  ok: true;
  config: RoundCreationConfig;
  diagnostics: ValidationDiagnostic[];
}

export interface RoundBuildFailure {
  ok: false;
  diagnostics: ValidationDiagnostic[];
}

export type RoundBuildResult = RoundBuildSuccess | RoundBuildFailure;

function diagnostic(
  code: string,
  message: string,
  values: Partial<ValidationDiagnostic> = {},
): ValidationDiagnostic {
  return {
    code,
    message,
    severity: 'ERROR',
    kind: 'SEMANTIC',
    ...values,
  };
}

function clonePools(pools: readonly ManualChallengePool[]): ManualChallengePool[] {
  return pools.map((pool) => ({
    categoryId: pool.categoryId,
    approvedChallengeIdsByDifficulty: Object.fromEntries(
      Object.entries(pool.approvedChallengeIdsByDifficulty).map(([difficulty, ids]) => [
        difficulty,
        ids ? [...ids] : ids,
      ]),
    ),
  }));
}

function poolsByCategory(
  pools: readonly ManualChallengePool[],
): ReadonlyMap<string, ManualChallengePool> {
  const result = new Map<string, ManualChallengePool>();
  pools.forEach((pool) => {
    if (!result.has(pool.categoryId)) result.set(pool.categoryId, pool);
  });
  return result;
}

function eligibleCuratedChallengeIds(
  index: CatalogIndex,
  pool: ManualChallengePool | undefined,
  categoryId: string,
  difficulty: (typeof DIFFICULTY_LEVELS)[number],
): string[] {
  const approved = new Set(pool?.approvedChallengeIdsByDifficulty[difficulty] ?? []);
  return getCatalogCandidates(index, categoryId, difficulty)
    .filter((candidate) => approved.has(candidate.challenge.id))
    .map((candidate) => candidate.challenge.id);
}

function categorySupportsRound(
  index: CatalogIndex,
  categoryId: string,
  songSelectionMode: SongSelectionMode,
  pool: ManualChallengePool | undefined,
): boolean {
  return DIFFICULTY_LEVELS.every((difficulty) =>
    songSelectionMode === 'FULL_CATALOG'
      ? getCatalogCandidates(index, categoryId, difficulty).length > 0
      : eligibleCuratedChallengeIds(index, pool, categoryId, difficulty).length > 0,
  );
}

export function validateRoundConfig(
  config: RoundCreationConfig,
  index: CatalogIndex,
): RoundValidationResult {
  const issues: ValidationDiagnostic[] = [];
  const selectedCategoryIds = new Set(config.selectedCategoryIds);

  if (config.selectedCategoryIds.length !== REQUIRED_CATEGORY_COUNT) {
    issues.push(
      diagnostic(
        'INVALID_SELECTED_CATEGORY_COUNT',
        `A round requires exactly ${REQUIRED_CATEGORY_COUNT} selected categories`,
        { path: 'selectedCategoryIds' },
      ),
    );
  }
  if (selectedCategoryIds.size !== config.selectedCategoryIds.length) {
    issues.push(
      diagnostic('DUPLICATE_SELECTED_CATEGORY', 'Selected categories must be unique', {
        kind: 'DUPLICATE',
        path: 'selectedCategoryIds',
      }),
    );
  }

  const poolMap = new Map<string, ManualChallengePool>();
  for (const pool of config.manualChallengePools) {
    if (poolMap.has(pool.categoryId)) {
      issues.push(
        diagnostic('DUPLICATE_CURATED_POOL', `Category "${pool.categoryId}" has multiple pools`, {
          kind: 'DUPLICATE',
          entityId: pool.categoryId,
          path: 'manualChallengePools',
        }),
      );
      continue;
    }
    poolMap.set(pool.categoryId, pool);
    if (!index.categoryById.has(pool.categoryId)) {
      issues.push(
        diagnostic(
          'UNKNOWN_POOL_CATEGORY',
          `Curated pool references unknown category "${pool.categoryId}"`,
          {
            kind: 'REFERENTIAL',
            entityId: pool.categoryId,
            path: 'manualChallengePools',
          },
        ),
      );
    }

    for (const difficulty of DIFFICULTY_LEVELS) {
      const approvedIds = pool.approvedChallengeIdsByDifficulty[difficulty] ?? [];
      if (new Set(approvedIds).size !== approvedIds.length) {
        issues.push(
          diagnostic(
            'DUPLICATE_APPROVED_CHALLENGE',
            `Curated pool repeats a Level ${difficulty} challenge for "${pool.categoryId}"`,
            {
              kind: 'DUPLICATE',
              entityId: pool.categoryId,
              path: `manualChallengePools.${pool.categoryId}.${difficulty}`,
            },
          ),
        );
      }
      for (const challengeId of approvedIds) {
        const challenge = index.challengeById.get(challengeId);
        if (!challenge) {
          issues.push(
            diagnostic(
              'UNKNOWN_CURATED_CHALLENGE',
              `Curated pool references unknown challenge "${challengeId}"`,
              {
                kind: 'REFERENTIAL',
                entityId: challengeId,
                path: `manualChallengePools.${pool.categoryId}.${difficulty}`,
              },
            ),
          );
          continue;
        }
        const isEligible = getCatalogCandidates(index, pool.categoryId, difficulty).some(
          (candidate) => candidate.challenge.id === challengeId,
        );
        if (!isEligible) {
          issues.push(
            diagnostic(
              'INELIGIBLE_CURATED_CHALLENGE',
              `Challenge "${challengeId}" does not match category "${pool.categoryId}" and Level ${difficulty}`,
              {
                kind: 'REFERENTIAL',
                entityId: challengeId,
                path: `manualChallengePools.${pool.categoryId}.${difficulty}`,
              },
            ),
          );
        }
      }
    }
  }

  if (config.songSelectionMode === 'FULL_CATALOG' && config.manualChallengePools.length > 0) {
    issues.push({
      code: 'UNUSED_CURATED_POOLS',
      severity: 'WARNING',
      kind: 'SEMANTIC',
      message: 'Curated pools are ignored in full-catalog mode',
      path: 'manualChallengePools',
    });
  }

  for (const categoryId of config.selectedCategoryIds) {
    const category = index.categoryById.get(categoryId);
    if (!category) {
      issues.push(
        diagnostic('UNKNOWN_SELECTED_CATEGORY', `Unknown selected category "${categoryId}"`, {
          kind: 'REFERENTIAL',
          entityId: categoryId,
          path: 'selectedCategoryIds',
        }),
      );
      continue;
    }
    if (!category.enabled) {
      issues.push(
        diagnostic('DISABLED_SELECTED_CATEGORY', `Selected category "${categoryId}" is disabled`, {
          kind: 'AVAILABILITY',
          entityId: categoryId,
          path: 'selectedCategoryIds',
        }),
      );
    }

    for (const difficulty of DIFFICULTY_LEVELS) {
      const candidateCount =
        config.songSelectionMode === 'FULL_CATALOG'
          ? getCatalogCandidates(index, categoryId, difficulty).length
          : eligibleCuratedChallengeIds(index, poolMap.get(categoryId), categoryId, difficulty)
              .length;
      if (candidateCount === 0) {
        issues.push(
          diagnostic(
            config.songSelectionMode === 'FULL_CATALOG'
              ? 'MISSING_CATALOG_COVERAGE'
              : 'MISSING_CURATED_COVERAGE',
            `Category "${categoryId}" has no ${config.songSelectionMode === 'FULL_CATALOG' ? 'catalog' : 'approved'} challenge at Level ${difficulty}`,
            {
              kind: 'AVAILABILITY',
              entityId: categoryId,
              path: `selectedCategoryIds.${categoryId}.${difficulty}`,
            },
          ),
        );
      }
    }
  }

  return {
    valid: !issues.some((validationIssue) => validationIssue.severity === 'ERROR'),
    issues,
  };
}

export function buildRoundConfig(
  request: RoundBuildRequest,
  index: CatalogIndex,
  random: RandomSource,
): RoundBuildResult {
  const poolMap = poolsByCategory(request.manualChallengePools);
  let selectedCategoryIds: string[];

  if (request.categorySelectionMode === 'MANUAL') {
    selectedCategoryIds = [...request.manualCategoryIds];
  } else {
    const eligibleCategories = index.snapshot.categories
      .filter(
        (category) =>
          category.enabled &&
          categorySupportsRound(
            index,
            category.id,
            request.songSelectionMode,
            poolMap.get(category.id),
          ),
      )
      .sort(
        (left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id),
      );

    if (eligibleCategories.length < REQUIRED_CATEGORY_COUNT) {
      return {
        ok: false,
        diagnostics: [
          diagnostic(
            'INSUFFICIENT_ELIGIBLE_CATEGORIES',
            `Only ${eligibleCategories.length} categories have complete ${request.songSelectionMode === 'FULL_CATALOG' ? 'catalog' : 'curated'} coverage; ${REQUIRED_CATEGORY_COUNT} are required`,
            { kind: 'AVAILABILITY' },
          ),
        ],
      };
    }

    const available = [...eligibleCategories];
    selectedCategoryIds = [];
    try {
      while (selectedCategoryIds.length < REQUIRED_CATEGORY_COUNT) {
        const selected = selectRandomItem(available, random);
        selectedCategoryIds.push(selected.id);
        available.splice(available.indexOf(selected), 1);
      }
    } catch (error) {
      if (error instanceof GameRuleError && error.code === 'INVALID_RANDOM_VALUE') {
        return {
          ok: false,
          diagnostics: [diagnostic('INVALID_RANDOM_VALUE', error.message)],
        };
      }
      throw error;
    }
  }

  const config: RoundCreationConfig = {
    categorySelectionMode: request.categorySelectionMode,
    songSelectionMode: request.songSelectionMode,
    categoryCount: 10,
    difficultyLevels: [1, 2, 3, 4, 5],
    selectedCategoryIds,
    manualChallengePools: clonePools(request.manualChallengePools),
    preventChallengeReuse: request.preventChallengeReuse,
    preventSongReuse: request.preventSongReuse,
    allowRuntimeReroll: request.allowRuntimeReroll,
    randomSeed: request.randomSeed,
  };
  const validation = validateRoundConfig(config, index);
  if (!validation.valid) return { ok: false, diagnostics: validation.issues };
  return { ok: true, config, diagnostics: validation.issues };
}

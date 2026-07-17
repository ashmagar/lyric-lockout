import { DIFFICULTY_LEVELS } from '../enums';
import type { DifficultyLevel } from '../enums';
import { getCatalogCandidates } from './indexing';
import type { CatalogCoverage, CatalogIndex, CoverageCell } from './types';

const RECOMMENDED_CHALLENGE_DEPTH = 3;

export function analyzeCatalogCoverage(index: CatalogIndex): CatalogCoverage {
  const categories = index.snapshot.categories.map((category) => {
    const byDifficulty = Object.fromEntries(
      DIFFICULTY_LEVELS.map((difficulty) => {
        const challengeCount = getCatalogCandidates(index, category.id, difficulty).length;
        const cell: CoverageCell = {
          categoryId: category.id,
          difficulty,
          challengeCount,
          hasMinimum: challengeCount >= 1,
          hasRecommendedDepth: challengeCount >= RECOMMENDED_CHALLENGE_DEPTH,
        };
        return [difficulty, cell];
      }),
    ) as Record<DifficultyLevel, CoverageCell>;

    return {
      categoryId: category.id,
      categoryName: category.name,
      enabled: category.enabled,
      byDifficulty,
      isReady:
        category.enabled && DIFFICULTY_LEVELS.every((level) => byDifficulty[level].hasMinimum),
      hasRecommendedDepth:
        category.enabled &&
        DIFFICULTY_LEVELS.every((level) => byDifficulty[level].hasRecommendedDepth),
    };
  });

  return {
    categories,
    readyCategoryCount: categories.filter((category) => category.isReady).length,
  };
}

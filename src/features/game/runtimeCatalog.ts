import { buildCatalogIndex, createCatalogSnapshot, type CatalogIndex } from '../../domain/catalog';
import type { Category, Song } from '../../domain/models/catalog';
import type { ChallengeSelectionRequest, GameSession } from '../../domain/models/game';
import { GAMEPLAY_CATALOG_INDEX } from './gameplayCatalog';

let runtimeCatalogIndex = GAMEPLAY_CATALOG_INDEX;

export function getRuntimeCatalogIndex(): CatalogIndex {
  return runtimeCatalogIndex;
}

export function buildRuntimeChallengeSelectionRequest(
  session: GameSession,
  categoryId: string,
): ChallengeSelectionRequest {
  return {
    categoryId,
    difficulty: session.currentDifficulty,
    songSelectionMode: session.roundConfig.songSelectionMode,
    approvedChallengeIds: session.roundConfig.manualChallengePools.find(
      (pool) => pool.categoryId === categoryId,
    )?.approvedChallengeIdsByDifficulty[session.currentDifficulty],
    excludedChallengeIds: [
      ...new Set([...session.playedChallengeIds, ...session.rejectedChallengeIds]),
    ],
    excludedSongIds: session.playedSongIds,
    allowSongReuseFallback: !session.roundConfig.preventSongReuse,
  };
}

export function updateRuntimeCatalog(
  categories: readonly Category[],
  authoredSongs: readonly Song[],
): CatalogIndex {
  if (categories.length === 0 && authoredSongs.length === 0) {
    return resetRuntimeCatalog();
  }

  const runtimeCategories = [...categories].sort(
    (left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id),
  );
  runtimeCatalogIndex = buildCatalogIndex(
    createCatalogSnapshot(runtimeCategories, authoredSongs),
  );
  return runtimeCatalogIndex;
}

export function resetRuntimeCatalog(): CatalogIndex {
  runtimeCatalogIndex = GAMEPLAY_CATALOG_INDEX;
  return runtimeCatalogIndex;
}

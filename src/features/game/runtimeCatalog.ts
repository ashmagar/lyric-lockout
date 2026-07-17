import { buildCatalogIndex, createCatalogSnapshot, type CatalogIndex } from '../../domain/catalog';
import type { Category, Song } from '../../domain/models/catalog';
import { GAMEPLAY_CATALOG_INDEX, GAMEPLAY_CATEGORIES } from './gameplayCatalog';

let runtimeCatalogIndex = GAMEPLAY_CATALOG_INDEX;

export function getRuntimeCatalogIndex(): CatalogIndex {
  return runtimeCatalogIndex;
}

export function updateRuntimeCatalog(
  categories: readonly Category[],
  authoredSongs: readonly Song[],
): CatalogIndex {
  const enabledCategoryIds = new Set(
    categories.filter((category) => category.enabled).map((item) => item.id),
  );
  const runtimeCategories = GAMEPLAY_CATEGORIES.map((category) => ({
    ...category,
    enabled: enabledCategoryIds.size === 0 || enabledCategoryIds.has(category.id),
  }));
  const authoredIds = new Set(authoredSongs.map((song) => song.id));
  const bundledSongs = GAMEPLAY_CATALOG_INDEX.snapshot.songs.filter(
    (song) => !authoredIds.has(song.id),
  );
  runtimeCatalogIndex = buildCatalogIndex(
    createCatalogSnapshot(runtimeCategories, [...bundledSongs, ...authoredSongs]),
  );
  return runtimeCatalogIndex;
}

export function resetRuntimeCatalog(): void {
  runtimeCatalogIndex = GAMEPLAY_CATALOG_INDEX;
}

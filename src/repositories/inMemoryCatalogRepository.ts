import type { CatalogData } from '../domain/models/catalog';
import type { CatalogDocument, CatalogRepository } from './catalogRepository';

export class InMemoryCatalogRepository implements CatalogRepository {
  readonly #catalog: CatalogData;

  constructor(catalog: CatalogData) {
    this.#catalog = catalog;
  }

  async loadCategories(): Promise<CatalogDocument> {
    return Promise.resolve({ source: 'memory:categories', value: this.#catalog.categories });
  }

  async loadSongs(): Promise<readonly CatalogDocument[]> {
    return Promise.resolve(
      this.#catalog.songs.map((song) => ({
        source: `memory:songs/${song.id}`,
        value: song,
      })),
    );
  }
}

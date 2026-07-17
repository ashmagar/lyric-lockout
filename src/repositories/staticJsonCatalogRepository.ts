import type { CatalogDocument, CatalogRepository } from './catalogRepository';

export interface StaticJsonCatalogSource {
  categories: CatalogDocument;
  songs: readonly CatalogDocument[];
}

export class StaticJsonCatalogRepository implements CatalogRepository {
  readonly #source: StaticJsonCatalogSource;

  constructor(source: StaticJsonCatalogSource) {
    this.#source = source;
  }

  async loadCategories(): Promise<CatalogDocument> {
    return Promise.resolve(this.#source.categories);
  }

  async loadSongs(): Promise<readonly CatalogDocument[]> {
    return Promise.resolve(this.#source.songs);
  }
}

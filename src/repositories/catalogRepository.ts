export interface CatalogDocument {
  source: string;
  value: unknown;
}

export interface CatalogRepository {
  loadCategories(): Promise<CatalogDocument>;
  loadSongs(): Promise<readonly CatalogDocument[]>;
}

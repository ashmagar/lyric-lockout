import categories from '../../data/categories.json';
import starlightParade from '../../data/songs/starlight-parade.json';
import summerRadio from '../../data/songs/summer-radio.json';
import { StaticJsonCatalogRepository } from './staticJsonCatalogRepository';

export function createBundledCatalogRepository(): StaticJsonCatalogRepository {
  return new StaticJsonCatalogRepository({
    categories: { source: 'data/categories.json', value: categories },
    songs: [
      { source: 'data/songs/starlight-parade.json', value: starlightParade },
      { source: 'data/songs/summer-radio.json', value: summerRadio },
    ],
  });
}

import path from 'node:path';

import { createAdminServer } from './adminServer.js';
import { CatalogFileStore } from './catalogFileStore.js';

const port = Number(process.env.ADMIN_PORT ?? 3001);
const dataDirectory = path.resolve(process.env.LYRIC_LOCKOUT_DATA_DIR ?? 'data');
const store = new CatalogFileStore({ dataDirectory });
await store.initialize();
const server = createAdminServer(store);
server.listen(port, '127.0.0.1', () => {
  console.log(`Lyric Lockout Admin API listening at http://127.0.0.1:${port}`);
  console.log(`Catalog data: ${dataDirectory}`);
});

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { CatalogFileStore, CatalogWriteError } from './catalogFileStore.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type',
};

function send(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, JSON_HEADERS);
  response.end(JSON.stringify(value));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk as Uint8Array));
  if (chunks.length === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

async function handleRequest(
  store: CatalogFileStore,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, JSON_HEADERS);
    response.end();
    return;
  }
  const url = new URL(request.url ?? '/', 'http://localhost');
  try {
    if (request.method === 'GET' && url.pathname === '/api/health') {
      send(response, 200, { ok: true, service: 'lyric-lockout-admin' });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/categories') {
      const catalog = await store.loadCatalog();
      send(response, 200, { categories: catalog.categories, issues: catalog.issues });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/songs') {
      const catalog = await store.loadCatalog();
      send(response, 200, { songs: catalog.songs, issues: catalog.issues });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/game-plans') {
      send(response, 200, { plans: await store.loadGamePlans() });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/validation') {
      const catalog = await store.loadCatalog();
      send(response, 200, { issues: catalog.issues });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/export') {
      const catalog = await store.loadCatalog();
      const songId = url.searchParams.get('songId');
      if (songId) {
        const song = catalog.songs.find((candidate) => candidate.id === songId);
        if (!song) throw new CatalogWriteError(404, `Song "${songId}" was not found.`);
        send(response, 200, song);
      } else {
        send(response, 200, catalog);
      }
      return;
    }
    if ((request.method === 'POST' || request.method === 'PUT') && url.pathname === '/api/songs') {
      send(response, 200, await store.saveSong(await readJson(request)));
      return;
    }
    if (request.method === 'DELETE' && url.pathname.startsWith('/api/songs/')) {
      const songId = decodeURIComponent(url.pathname.slice('/api/songs/'.length));
      send(response, 200, await store.deleteSong(songId));
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/import') {
      const body = (await readJson(request)) as
        { songs?: unknown; mode?: 'MERGE' | 'REPLACE' } | undefined;
      send(
        response,
        200,
        await store.importSongs(body?.songs, body?.mode === 'REPLACE' ? 'REPLACE' : 'MERGE'),
      );
      return;
    }
    send(response, 404, { error: { category: 'ADMIN_API', message: 'Endpoint not found.' } });
  } catch (error) {
    if (error instanceof CatalogWriteError) {
      send(response, error.statusCode, {
        error: {
          category: 'VALIDATION',
          message: error.message,
          issues: error.issues,
          recoverable: true,
        },
      });
      return;
    }
    send(response, 500, {
      error: {
        category: 'ADMIN_API',
        message: error instanceof Error ? error.message : 'Unexpected Admin API failure.',
        recoverable: true,
      },
    });
  }
}

export function createAdminServer(store: CatalogFileStore): Server {
  return createServer((request, response) => {
    void handleRequest(store, request, response);
  });
}

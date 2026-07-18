import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { CatalogFileStore } from './catalogFileStore.js';
import type { ServerCategory, ServerSong } from './catalogSchemas.js';

const TIMESTAMP = '2026-07-17T08:00:00.000Z';
const CATEGORY: ServerCategory = {
  id: 'party-songs',
  schemaVersion: 1,
  name: 'Party Songs',
  displayOrder: 1,
  enabled: true,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
};

function validSong(id = 'song-one'): ServerSong {
  return {
    id,
    schemaVersion: 1,
    title: 'Test Anthem',
    artist: 'Test Artist',
    youtubeVideoId: 'M7lc1UVf-VE',
    videoType: 'LYRIC',
    categoryIds: [CATEGORY.id],
    enabled: false,
    challenges: [
      {
        id: `challenge-${id}`,
        difficulty: 1,
        playbackStartSeconds: 5,
        verifyFromSeconds: 7,
        pauseAtSeconds: 10,
        verifyToSeconds: 12,
        expectedLyrics: 'Expected lyrics',
        missingWordCount: 2,
        hintText: 'Helpful hint',
        enabled: false,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
    ],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lyric-lockout-admin-'));
  await mkdir(path.join(root, 'songs'), { recursive: true });
  await mkdir(path.join(root, 'game-plans'), { recursive: true });
  await mkdir(path.join(root, 'backups'), { recursive: true });
  await writeFile(path.join(root, 'categories.json'), JSON.stringify([CATEGORY]), 'utf8');
  return {
    root,
    store: new CatalogFileStore({
      dataDirectory: root,
      now: () => new Date(TIMESTAMP),
    }),
  };
}

describe('Admin atomic file writes and backups', () => {
  it('creates and reloads a validated category with an atomic collection write', async () => {
    const { root, store } = await fixture();
    const category: ServerCategory = {
      ...CATEGORY,
      id: 'new-category',
      name: 'New Category',
      displayOrder: 2,
    };

    await store.createCategory(category);

    const snapshot = await store.loadCatalog();
    expect(snapshot.categories).toContainEqual(category);
    expect((await readdir(root)).some((file) => file.endsWith('.tmp'))).toBe(false);
    expect(JSON.parse(await readFile(path.join(root, 'categories.json'), 'utf8'))).toContainEqual(
      category,
    );
  });

  it('edits a category name without changing stable song references', async () => {
    const { root, store } = await fixture();
    await store.saveSong(validSong('referenced-song'));
    const edited = { ...CATEGORY, name: 'Celebration Songs', updatedAt: TIMESTAMP };

    const result = await store.updateCategory(CATEGORY.id, edited);

    expect(result.category.id).toBe(CATEGORY.id);
    expect(result.backupPath).toContain('category-update');
    const snapshot = await store.loadCatalog();
    expect(snapshot.categories[0]?.name).toBe('Celebration Songs');
    expect(snapshot.songs[0]?.categoryIds).toEqual([CATEGORY.id]);
    expect(await readFile(result.backupPath, 'utf8')).toContain('Party Songs');
    expect(await readFile(path.join(root, 'songs', 'referenced-song.json'), 'utf8')).toContain(
      `"${CATEGORY.id}"`,
    );
  });

  it('rejects blank, duplicate, and changed category IDs without persisting them', async () => {
    const { root, store } = await fixture();
    const original = await readFile(path.join(root, 'categories.json'), 'utf8');

    await expect(store.createCategory({ ...CATEGORY, id: '   ' })).rejects.toThrow(
      'Category validation failed',
    );
    await expect(store.createCategory(CATEGORY)).rejects.toThrow('already in use');
    await expect(
      store.updateCategory(CATEGORY.id, { ...CATEGORY, id: 'changed-id' }),
    ).rejects.toThrow('cannot be changed');
    expect(await readFile(path.join(root, 'categories.json'), 'utf8')).toBe(original);
  });

  it('creates a disabled song draft through a validated atomic write', async () => {
    const { root, store } = await fixture();

    await store.saveSong(validSong());

    const files = await readdir(path.join(root, 'songs'));
    expect(files).toEqual(['song-one.json']);
    expect(files.some((file) => file.endsWith('.tmp'))).toBe(false);
    expect(JSON.parse(await readFile(path.join(root, 'songs', files[0]!), 'utf8'))).toMatchObject({
      id: 'song-one',
      enabled: false,
    });
  });

  it('persists and reloads hidden-word selections without stripping them', async () => {
    const { root, store } = await fixture();
    const song = validSong();
    song.challenges[0]!.hiddenWordIndexes = [1];
    song.challenges[0]!.missingWordCount = 1;

    const saved = await store.saveSong(song);
    const file = JSON.parse(
      await readFile(path.join(root, 'songs', 'song-one.json'), 'utf8'),
    ) as ServerSong;
    const reloaded = await store.loadCatalog();

    expect(saved.song.challenges[0]?.hiddenWordIndexes).toEqual([1]);
    expect(file.challenges[0]?.hiddenWordIndexes).toEqual([1]);
    expect(reloaded.songs[0]?.challenges[0]?.hiddenWordIndexes).toEqual([1]);
  });

  it('rejects malformed hidden-word selections at the Admin write boundary', async () => {
    const { store } = await fixture();
    const song = validSong();
    song.challenges[0]!.hiddenWordIndexes = [0, 0, 99];
    song.challenges[0]!.missingWordCount = 3;

    await expect(store.saveSong(song)).rejects.toThrow('Song validation failed');
  });

  it('creates a backup before update and before delete', async () => {
    const { root, store } = await fixture();
    await store.saveSong(validSong());
    await store.saveSong({ ...validSong(), title: 'Updated title' });

    const updateBackups = await readdir(path.join(root, 'backups'));
    expect(updateBackups.some((directory) => directory.includes('song-update'))).toBe(true);

    const deletion = await store.deleteSong('song-one');
    expect(deletion.backupPath).toContain('song-delete');
    expect(await readFile(deletion.backupPath, 'utf8')).toContain('Updated title');
    expect(await readdir(path.join(root, 'songs'))).toEqual([]);
  });

  it('validates the complete import before replacing the song directory', async () => {
    const { root, store } = await fixture();
    await store.saveSong(validSong('stable-song'));
    const invalid = validSong('invalid-song');
    invalid.challenges[0]!.pauseAtSeconds = 0;

    await expect(store.importSongs([invalid], 'REPLACE')).rejects.toThrow(
      'Import validation failed',
    );
    expect(await readdir(path.join(root, 'songs'))).toEqual(['stable-song.json']);
  });
});

import { randomUUID } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rename, rm, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  categorySchema,
  songSchema,
  type ServerCategory,
  type ServerSong,
  type ServerValidationIssue,
} from './catalogSchemas.js';

export interface CatalogFileStoreOptions {
  dataDirectory: string;
  now?: (() => Date) | undefined;
}

export interface CatalogFileSnapshot {
  categories: ServerCategory[];
  songs: ServerSong[];
  issues: ServerValidationIssue[];
}

export class CatalogWriteError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly issues: ServerValidationIssue[] = [],
  ) {
    super(message);
  }
}

function schemaIssues(
  source: string,
  entityId: string | undefined,
  issues: readonly { message: string; path: PropertyKey[] }[],
): ServerValidationIssue[] {
  return issues.map((issue) => ({
    code: 'INVALID_SCHEMA',
    severity: 'ERROR',
    message: issue.message,
    path: issue.path.map(String).join('.'),
    entityId,
    source,
  }));
}

function safeFilename(id: string): string {
  const value = id
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-');
  if (!value) throw new CatalogWriteError(400, 'Song ID cannot produce a safe filename.');
  return `${value}.json`;
}

export class CatalogFileStore {
  readonly #dataDirectory: string;
  readonly #categoriesFile: string;
  readonly #songsDirectory: string;
  readonly #plansDirectory: string;
  readonly #backupsDirectory: string;
  readonly #now: () => Date;

  constructor(options: CatalogFileStoreOptions) {
    this.#dataDirectory = options.dataDirectory;
    this.#categoriesFile = path.join(options.dataDirectory, 'categories.json');
    this.#songsDirectory = path.join(options.dataDirectory, 'songs');
    this.#plansDirectory = path.join(options.dataDirectory, 'game-plans');
    this.#backupsDirectory = path.join(options.dataDirectory, 'backups');
    this.#now = options.now ?? (() => new Date());
  }

  async initialize(): Promise<void> {
    await Promise.all([
      mkdir(this.#songsDirectory, { recursive: true }),
      mkdir(this.#plansDirectory, { recursive: true }),
      mkdir(this.#backupsDirectory, { recursive: true }),
    ]);
  }

  async loadCatalog(): Promise<CatalogFileSnapshot> {
    await this.initialize();
    const issues: ServerValidationIssue[] = [];
    const categoryRaw = JSON.parse(await readFile(this.#categoriesFile, 'utf8')) as unknown;
    const categoryValues = Array.isArray(categoryRaw) ? categoryRaw : [];
    const categories: ServerCategory[] = [];
    if (!Array.isArray(categoryRaw)) {
      issues.push({
        code: 'INVALID_CATEGORY_COLLECTION',
        severity: 'ERROR',
        message: 'Categories must be stored as an array.',
        path: 'categories.json',
        source: 'categories.json',
      });
    }
    categoryValues.forEach((value) => {
      const result = categorySchema.safeParse(value);
      if (result.success) categories.push(result.data);
      else issues.push(...schemaIssues('categories.json', undefined, result.error.issues));
    });

    const records = await this.readSongRecords();
    const songs: ServerSong[] = [];
    for (const record of records) {
      const result = songSchema.safeParse(record.value);
      if (result.success) songs.push(result.data);
      else {
        issues.push(
          ...schemaIssues(
            path.relative(this.#dataDirectory, record.filePath),
            typeof record.value === 'object' &&
              record.value !== null &&
              'id' in record.value &&
              typeof record.value.id === 'string'
              ? record.value.id
              : undefined,
            result.error.issues,
          ),
        );
      }
    }
    issues.push(...this.validateReferences(categories, songs));
    return { categories, songs, issues };
  }

  async loadGamePlans(): Promise<unknown[]> {
    await this.initialize();
    const files = (await readdir(this.#plansDirectory)).filter((file) => file.endsWith('.json'));
    return Promise.all(
      files.map(
        async (file) =>
          JSON.parse(await readFile(path.join(this.#plansDirectory, file), 'utf8')) as unknown,
      ),
    );
  }

  async createCategory(value: unknown): Promise<{
    category: ServerCategory;
    issues: ServerValidationIssue[];
    backupPath: string;
  }> {
    const category = this.parseCategory(value);
    const snapshot = await this.loadCatalog();
    this.assertCategoryCollectionWritable(snapshot);
    if (snapshot.categories.some((candidate) => candidate.id === category.id)) {
      throw new CatalogWriteError(409, `Category ID "${category.id}" is already in use.`, [
        {
          code: 'DUPLICATE_CATEGORY_ID',
          severity: 'ERROR',
          message: `Category ID "${category.id}" is already in use.`,
          entityId: category.id,
          path: 'id',
        },
      ]);
    }

    const categories = [...snapshot.categories, category];
    const issues = this.validateReferences(categories, snapshot.songs);
    if (issues.some((issue) => issue.severity === 'ERROR')) {
      throw new CatalogWriteError(400, 'Category validation failed.', issues);
    }
    const backupPath = await this.backupPath(this.#categoriesFile, 'category-create');
    await this.atomicWriteJson(this.#categoriesFile, categories);
    return { category, issues, backupPath };
  }

  async updateCategory(
    categoryId: string,
    value: unknown,
  ): Promise<{
    category: ServerCategory;
    issues: ServerValidationIssue[];
    backupPath: string;
  }> {
    const category = this.parseCategory(value);
    if (category.id !== categoryId) {
      throw new CatalogWriteError(400, 'A category ID cannot be changed after creation.', [
        {
          code: 'CATEGORY_ID_IMMUTABLE',
          severity: 'ERROR',
          message: 'A category ID cannot be changed after creation.',
          entityId: categoryId,
          path: 'id',
        },
      ]);
    }
    const snapshot = await this.loadCatalog();
    this.assertCategoryCollectionWritable(snapshot);
    if (!snapshot.categories.some((candidate) => candidate.id === categoryId)) {
      throw new CatalogWriteError(404, `Category "${categoryId}" was not found.`);
    }

    const categories = snapshot.categories.map((candidate) =>
      candidate.id === categoryId ? category : candidate,
    );
    const issues = this.validateReferences(categories, snapshot.songs);
    if (issues.some((issue) => issue.severity === 'ERROR')) {
      throw new CatalogWriteError(400, 'Category validation failed.', issues);
    }
    const backupPath = await this.backupPath(this.#categoriesFile, 'category-update');
    await this.atomicWriteJson(this.#categoriesFile, categories);
    return { category, issues, backupPath };
  }

  async saveSong(value: unknown): Promise<{ song: ServerSong; issues: ServerValidationIssue[] }> {
    const parsed = songSchema.safeParse(value);
    if (!parsed.success) {
      throw new CatalogWriteError(
        400,
        'Song validation failed.',
        schemaIssues('request', undefined, parsed.error.issues),
      );
    }
    const snapshot = await this.loadCatalog();
    const referenceIssues = this.validateReferences(snapshot.categories, [
      parsed.data,
      ...snapshot.songs.filter((song) => song.id !== parsed.data.id),
    ]).filter((issue) => issue.entityId === parsed.data.id || issue.entityId === undefined);
    if (referenceIssues.some((issue) => issue.severity === 'ERROR')) {
      throw new CatalogWriteError(400, 'Song validation failed.', referenceIssues);
    }

    const records = await this.readSongRecords();
    const existing = records.find(
      (record) =>
        typeof record.value === 'object' &&
        record.value !== null &&
        'id' in record.value &&
        record.value.id === parsed.data.id,
    );
    const target =
      existing?.filePath ?? path.join(this.#songsDirectory, safeFilename(parsed.data.id));
    if (existing) await this.backupPath(existing.filePath, 'song-update');
    await this.atomicWriteJson(target, parsed.data);
    return { song: parsed.data, issues: referenceIssues };
  }

  async deleteSong(songId: string): Promise<{ backupPath: string }> {
    const records = await this.readSongRecords();
    const existing = records.find(
      (record) =>
        typeof record.value === 'object' &&
        record.value !== null &&
        'id' in record.value &&
        record.value.id === songId,
    );
    if (!existing) throw new CatalogWriteError(404, `Song "${songId}" was not found.`);
    const backupPath = await this.backupPath(existing.filePath, 'song-delete');
    await unlink(existing.filePath);
    return { backupPath };
  }

  async importSongs(values: unknown, mode: 'MERGE' | 'REPLACE'): Promise<CatalogFileSnapshot> {
    if (!Array.isArray(values))
      throw new CatalogWriteError(400, 'Import must contain a song array.');
    const parsedSongs: ServerSong[] = [];
    const issues: ServerValidationIssue[] = [];
    values.forEach((value) => {
      const result = songSchema.safeParse(value);
      if (result.success) parsedSongs.push(result.data);
      else issues.push(...schemaIssues('import', undefined, result.error.issues));
    });
    if (issues.length > 0) throw new CatalogWriteError(400, 'Import validation failed.', issues);

    const current = await this.loadCatalog();
    const songs =
      mode === 'REPLACE'
        ? parsedSongs
        : [
            ...parsedSongs,
            ...current.songs.filter(
              (song) => !parsedSongs.some((candidate) => candidate.id === song.id),
            ),
          ];
    const referenceIssues = this.validateReferences(current.categories, songs);
    if (referenceIssues.some((issue) => issue.severity === 'ERROR')) {
      throw new CatalogWriteError(400, 'Import validation failed.', referenceIssues);
    }
    await this.replaceSongDirectory(songs);
    return this.loadCatalog();
  }

  private async readSongRecords(): Promise<{ filePath: string; value: unknown }[]> {
    await this.initialize();
    const files = (await readdir(this.#songsDirectory)).filter((file) => file.endsWith('.json'));
    return Promise.all(
      files.map(async (file) => {
        const filePath = path.join(this.#songsDirectory, file);
        try {
          return { filePath, value: JSON.parse(await readFile(filePath, 'utf8')) as unknown };
        } catch {
          return { filePath, value: null };
        }
      }),
    );
  }

  private parseCategory(value: unknown): ServerCategory {
    const parsed = categorySchema.safeParse(value);
    if (!parsed.success) {
      throw new CatalogWriteError(
        400,
        'Category validation failed.',
        schemaIssues('request', undefined, parsed.error.issues),
      );
    }
    return parsed.data;
  }

  private assertCategoryCollectionWritable(snapshot: CatalogFileSnapshot): void {
    const blockingIssues = snapshot.issues.filter(
      (issue) =>
        issue.source === 'categories.json' ||
        issue.code === 'INVALID_CATEGORY_COLLECTION' ||
        issue.code === 'DUPLICATE_CATEGORY_ID',
    );
    if (blockingIssues.length > 0) {
      throw new CatalogWriteError(
        409,
        'Repair the existing category collection before saving category changes.',
        blockingIssues,
      );
    }
  }

  private validateReferences(
    categories: readonly ServerCategory[],
    songs: readonly ServerSong[],
  ): ServerValidationIssue[] {
    const issues: ServerValidationIssue[] = [];
    const categoryIds = new Set<string>();
    for (const category of categories) {
      if (categoryIds.has(category.id)) {
        issues.push({
          code: 'DUPLICATE_CATEGORY_ID',
          severity: 'ERROR',
          message: `Duplicate category ID "${category.id}".`,
          entityId: category.id,
          path: 'id',
          source: 'categories.json',
        });
      }
      categoryIds.add(category.id);
    }
    const songIds = new Set<string>();
    const challengeIds = new Set<string>();
    for (const song of songs) {
      if (songIds.has(song.id)) {
        issues.push({
          code: 'DUPLICATE_SONG_ID',
          severity: 'ERROR',
          message: `Duplicate song ID "${song.id}".`,
          entityId: song.id,
        });
      }
      songIds.add(song.id);
      for (const categoryId of song.categoryIds) {
        if (!categoryIds.has(categoryId)) {
          issues.push({
            code: 'UNKNOWN_CATEGORY_REFERENCE',
            severity: 'ERROR',
            message: `Unknown category "${categoryId}".`,
            entityId: song.id,
            path: 'categoryIds',
          });
        }
      }
      for (const challenge of song.challenges) {
        if (challengeIds.has(challenge.id)) {
          issues.push({
            code: 'DUPLICATE_CHALLENGE_ID',
            severity: 'ERROR',
            message: `Duplicate challenge ID "${challenge.id}".`,
            entityId: song.id,
            path: 'challenges',
          });
        }
        challengeIds.add(challenge.id);
      }
      if (song.enabled && song.challenges.every((challenge) => !challenge.enabled)) {
        issues.push({
          code: 'ENABLED_SONG_WITHOUT_ENABLED_CHALLENGE',
          severity: 'WARNING',
          message: 'Enabled song has no enabled challenges.',
          entityId: song.id,
          path: 'challenges',
        });
      }
    }
    return issues;
  }

  private async atomicWriteJson(target: string, value: unknown): Promise<void> {
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(temporary, target);
  }

  private async backupPath(source: string, reason: string): Promise<string> {
    const stamp = this.#now().toISOString().replaceAll(':', '-');
    const directory = path.join(this.#backupsDirectory, `${stamp}-${reason}-${randomUUID()}`);
    await mkdir(directory, { recursive: true });
    const target = path.join(directory, path.basename(source));
    await cp(source, target, { recursive: true });
    return target;
  }

  private async replaceSongDirectory(songs: readonly ServerSong[]): Promise<void> {
    const staging = path.join(this.#dataDirectory, `.songs-staging-${randomUUID()}`);
    const rollback = path.join(this.#dataDirectory, `.songs-rollback-${randomUUID()}`);
    await mkdir(staging, { recursive: true });
    try {
      await Promise.all(
        songs.map((song) =>
          writeFile(
            path.join(staging, safeFilename(song.id)),
            `${JSON.stringify(song, null, 2)}\n`,
            'utf8',
          ),
        ),
      );
      await this.backupPath(this.#songsDirectory, 'songs-import');
      await rename(this.#songsDirectory, rollback);
      try {
        await rename(staging, this.#songsDirectory);
      } catch (error) {
        await rename(rollback, this.#songsDirectory);
        throw error;
      }
      await rm(rollback, { recursive: true, force: true });
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
  }
}

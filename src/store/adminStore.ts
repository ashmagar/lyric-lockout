import { create } from 'zustand';

import { AdminGatewayError, HttpAdminGateway, type AdminGateway } from '../application/admin';
import type { Category, Song } from '../domain';
import type { CatalogValidationIssue } from '../domain/catalog';
import { updateRuntimeCatalog } from '../features/game/runtimeCatalog';

interface AdminState {
  status: 'UNINITIALIZED' | 'LOADING' | 'READY' | 'OFFLINE';
  categories: Category[];
  songs: Song[];
  issues: CatalogValidationIssue[];
  error?: string | undefined;
  lastBackupPath?: string | undefined;
  initialize: () => Promise<void>;
  reload: () => Promise<boolean>;
  createCategory: (category: Category) => Promise<boolean>;
  updateCategory: (category: Category) => Promise<boolean>;
  saveSong: (song: Song) => Promise<boolean>;
  deleteSong: (songId: string) => Promise<boolean>;
  toggleSong: (songId: string) => Promise<boolean>;
  importSongs: (songs: unknown, mode: 'MERGE' | 'REPLACE') => Promise<boolean>;
  exportCatalog: (songId?: string) => Promise<unknown>;
  clearError: () => void;
}

let configuredGateway: AdminGateway | undefined;

function gateway(): AdminGateway {
  return (configuredGateway ??= new HttpAdminGateway());
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The Admin API request failed.';
}

export function configureAdminGateway(nextGateway: AdminGateway | undefined): void {
  configuredGateway = nextGateway;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  status: 'UNINITIALIZED',
  categories: [],
  songs: [],
  issues: [],

  async initialize() {
    if (get().status !== 'UNINITIALIZED') return;
    set({ status: 'LOADING' });
    try {
      await gateway().health();
      await get().reload();
    } catch (error) {
      set({ status: 'OFFLINE', error: errorMessage(error) });
    }
  },

  async reload() {
    try {
      const snapshot = await gateway().loadCatalog();
      updateRuntimeCatalog(snapshot.categories, snapshot.songs);
      set({
        status: 'READY',
        categories: snapshot.categories,
        songs: snapshot.songs,
        issues: snapshot.issues,
        error: undefined,
      });
      return true;
    } catch (error) {
      set({ status: 'OFFLINE', error: errorMessage(error) });
      return false;
    }
  },

  async saveSong(song) {
    try {
      await gateway().saveSong(song);
      return get().reload();
    } catch (error) {
      set({
        error: errorMessage(error),
        issues: error instanceof AdminGatewayError ? error.issues : get().issues,
      });
      return false;
    }
  },

  async createCategory(category) {
    try {
      await gateway().createCategory(category);
      return get().reload();
    } catch (error) {
      set({
        error: errorMessage(error),
        issues: error instanceof AdminGatewayError ? error.issues : get().issues,
      });
      return false;
    }
  },

  async updateCategory(category) {
    try {
      await gateway().updateCategory(category);
      return get().reload();
    } catch (error) {
      set({
        error: errorMessage(error),
        issues: error instanceof AdminGatewayError ? error.issues : get().issues,
      });
      return false;
    }
  },

  async deleteSong(songId) {
    try {
      const result = await gateway().deleteSong(songId);
      set({ lastBackupPath: result.backupPath });
      return get().reload();
    } catch (error) {
      set({ error: errorMessage(error) });
      return false;
    }
  },

  async toggleSong(songId) {
    const song = get().songs.find((candidate) => candidate.id === songId);
    if (!song) return false;
    return get().saveSong({
      ...song,
      enabled: !song.enabled,
      updatedAt: new Date().toISOString(),
    });
  },

  async importSongs(songs, mode) {
    try {
      const snapshot = await gateway().importSongs(songs, mode);
      updateRuntimeCatalog(snapshot.categories, snapshot.songs);
      set({
        status: 'READY',
        categories: snapshot.categories,
        songs: snapshot.songs,
        issues: snapshot.issues,
        error: undefined,
      });
      return true;
    } catch (error) {
      set({
        error: errorMessage(error),
        issues: error instanceof AdminGatewayError ? error.issues : get().issues,
      });
      return false;
    }
  },

  async exportCatalog(songId) {
    try {
      return await gateway().exportCatalog(songId);
    } catch (error) {
      set({ error: errorMessage(error) });
      return undefined;
    }
  },

  clearError() {
    set({ error: undefined });
  },
}));

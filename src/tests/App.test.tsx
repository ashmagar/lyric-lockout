import { render, screen } from '@testing-library/react';
import { RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AdminGateway } from '../application/admin';
import { createTestRouter } from '../app/router';
import { ACTIVE_GAME_STORAGE_KEY } from '../repositories';
import { configureAdminGateway, useAdminStore } from '../store/adminStore';
import { configureGamePlanRepository, useGamePlanStore } from '../store/gamePlanStore';
import { configureGameplayRepository, useGameplayStore } from '../store/gameplayStore';
import { bootstrapTheme, DEFAULT_THEME } from '../store/settingsStore';

function renderRoute(path = '/') {
  return render(<RouterProvider router={createTestRouter([path])} />);
}

const EMPTY_ADMIN_GATEWAY: AdminGateway = {
  health: () => Promise.resolve(),
  loadCatalog: () => Promise.resolve({ categories: [], songs: [], issues: [] }),
  createCategory: (category) =>
    Promise.resolve({ category, issues: [], backupPath: 'test-backup' }),
  updateCategory: (category) =>
    Promise.resolve({ category, issues: [], backupPath: 'test-backup' }),
  saveSong: (song) => Promise.resolve({ song, issues: [] }),
  deleteSong: () => Promise.resolve({ backupPath: 'test-backup' }),
  exportCatalog: () => Promise.resolve({ categories: [], songs: [] }),
  importSongs: () => Promise.resolve({ categories: [], songs: [], issues: [] }),
};

describe('application shell', () => {
  beforeEach(() => {
    localStorage.clear();
    configureGameplayRepository(undefined);
    configureGamePlanRepository(undefined);
    configureAdminGateway(EMPTY_ADMIN_GATEWAY);
    useAdminStore.setState({
      status: 'UNINITIALIZED',
      categories: [],
      songs: [],
      issues: [],
      error: undefined,
      lastBackupPath: undefined,
    });
    useGamePlanStore.setState({
      status: 'UNINITIALIZED',
      plans: [],
      storageIssue: undefined,
      error: undefined,
    });
    useGameplayStore.setState({
      session: undefined,
      persistenceStatus: 'UNINITIALIZED',
      savedSession: undefined,
      savedSessionIssue: undefined,
      completedSummaries: [],
      persistenceError: undefined,
    });
  });

  it('renders the application', () => {
    renderRoute();

    expect(screen.getByRole('link', { name: 'Lyric Lockout home' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Ready to lock in the lyrics?' }),
    ).toBeInTheDocument();
  });

  it.each([
    ['/game', 'Bring two teams to the stage.'],
    ['/plans', 'Prepare the party before it starts.'],
    ['/admin', 'Your song library, backstage.'],
    ['/settings', 'Tune the room your way.'],
  ])('loads the %s route', async (path, heading) => {
    renderRoute(path);

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it.each([
    ['corrupt', '{not-json'],
    ['unsupported', JSON.stringify({ schemaVersion: 99, type: 'GAME_SESSION' })],
  ])('preserves %s saved data and offers recovery controls', async (_label, raw) => {
    localStorage.setItem(ACTIVE_GAME_STORAGE_KEY, raw);

    renderRoute('/game');

    expect(
      await screen.findByRole('heading', { name: 'Saved game needs attention.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export saved data' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discard saved game' })).toBeInTheDocument();
    expect(localStorage.getItem(ACTIVE_GAME_STORAGE_KEY)).toBe(raw);
  });

  it('handles an unknown route', () => {
    renderRoute('/missing-verse');

    expect(screen.getByRole('heading', { name: 'We lost the next line.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
  });
});

describe('theme bootstrap', () => {
  it('defaults to Day Party', () => {
    const root = document.createElement('html');

    bootstrapTheme(root);

    expect(DEFAULT_THEME).toBe('DAY_PARTY');
    expect(root.dataset.theme).toBe('day-party');
  });
});

import { render, screen } from '@testing-library/react';
import { RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AdminGateway } from '../application/admin';
import { createTestRouter } from '../app/router';
import { createGame } from '../domain';
import { GAMEPLAY_CATEGORIES, GAMEPLAY_ROUND_CONFIG } from '../features/game/gameplayCatalog';
import { resetRuntimeCatalog } from '../features/game/runtimeCatalog';
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
    resetRuntimeCatalog();
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
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('heading', { name: 'Lyric Lockout' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /New Game/ })).toHaveAttribute('href', '/game');
    expect(screen.getByRole('link', { name: /Saved Game Plans/ })).toHaveAttribute(
      'href',
      '/plans',
    );
    expect(screen.queryByRole('link', { name: /Resume Game/ })).not.toBeInTheDocument();
  });

  it('offers Resume Game when a saved session is available', () => {
    useGameplayStore.setState({
      persistenceStatus: 'READY',
      savedSession: createGame({
        id: 'saved-home-game',
        createdAt: '2026-07-19T12:00:00.000Z',
        teams: [
          { id: 'team-blue', name: 'Blue Panthers' },
          { id: 'team-red', name: 'Red Rockets' },
        ],
        roundConfig: GAMEPLAY_ROUND_CONFIG,
      }),
    });

    renderRoute();

    expect(screen.getByRole('link', { name: /Resume Game/ })).toHaveAttribute('href', '/game/play');
    expect(screen.getByText('Blue Panthers vs Red Rockets')).toBeInTheDocument();
  });

  it('uses the shared sidebar shell for interior routes', () => {
    renderRoute('/settings');

    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /New Game/ })).toHaveAttribute('href', '/game');
    expect(screen.getByRole('link', { name: /Saved Game Plans/ })).toHaveAttribute(
      'href',
      '/plans',
    );
    expect(screen.getByText('Local save enabled')).toBeInTheDocument();
  });

  it.each([
    ['/game', 'New Game'],
    ['/game/play', 'Bring two teams to the stage.'],
    ['/plans', 'Prepare the party before it starts.'],
    ['/admin', 'Your song library, backstage.'],
    ['/settings', 'Tune the room your way.'],
  ])('loads the %s route', async (path, heading) => {
    renderRoute(path);

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('loads newly authored categories before rendering new-game setup', async () => {
    const authoredCategory = {
      ...GAMEPLAY_CATEGORIES[0]!,
      id: 'category-authored-for-gameplay',
      name: 'Authored Gameplay Category',
      displayOrder: 42,
    };
    configureAdminGateway({
      ...EMPTY_ADMIN_GATEWAY,
      loadCatalog: () => Promise.resolve({ categories: [authoredCategory], songs: [], issues: [] }),
    });

    renderRoute('/game/play?setup=custom');

    expect(
      await screen.findByRole('heading', { name: 'Bring two teams to the stage.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Authored Gameplay Category')).toBeInTheDocument();
    expect(screen.queryByText('Romantic')).not.toBeInTheDocument();
  });

  it.each([
    ['corrupt', '{not-json'],
    ['unsupported', JSON.stringify({ schemaVersion: 99, type: 'GAME_SESSION' })],
  ])('preserves %s saved data and offers recovery controls', async (_label, raw) => {
    localStorage.setItem(ACTIVE_GAME_STORAGE_KEY, raw);

    renderRoute('/game/play');

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

  it('routes every New Game option to a working flow', () => {
    renderRoute('/game');

    expect(screen.getByRole('link', { name: /Browse Plans/ })).toHaveAttribute('href', '/plans');
    expect(screen.getByRole('link', { name: /Choose Categories/ })).toHaveAttribute(
      'href',
      '/game/play?setup=custom',
    );
    expect(screen.getByRole('link', { name: /Surprise Me/ })).toHaveAttribute(
      'href',
      '/game/play?setup=random',
    );
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

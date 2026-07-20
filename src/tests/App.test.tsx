import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
import {
  bootstrapTheme,
  DEFAULT_SETTINGS,
  DEFAULT_THEME,
  SETTINGS_STORAGE_KEY,
  useSettingsStore,
} from '../store/settingsStore';

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
    useSettingsStore.setState({ ...DEFAULT_SETTINGS });
    bootstrapTheme();
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

  it('applies, persists, and resets room preferences', async () => {
    const user = userEvent.setup();

    renderRoute('/settings');

    await user.click(screen.getByRole('button', { name: /Game Night/ }));
    expect(document.documentElement.dataset.theme).toBe('game-night');

    await user.click(screen.getByRole('switch', { name: /Reduce motion/ }));
    expect(document.documentElement.dataset.motion).toBe('reduced');

    await user.click(screen.getByRole('switch', { name: /Game sounds/ }));
    expect(screen.getByRole('slider', { name: /Suspense/ })).toBeDisabled();
    expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toContain('"audioEnabled":false');

    await user.click(screen.getByRole('button', { name: 'Restore defaults' }));
    expect(document.documentElement.dataset.theme).toBe('day-party');
    expect(document.documentElement.dataset.motion).toBeUndefined();
    expect(screen.getByRole('slider', { name: /Suspense/ })).toBeEnabled();
    expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toContain('"audioEnabled":true');
  });

  it.each([
    ['/game', 'New Game'],
    ['/game/play', 'Custom Categories'],
    ['/plans', 'Saved Game Plans'],
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

    renderRoute('/game/play?setup=custom&media=fake');

    expect(await screen.findByRole('heading', { name: 'Custom Categories' })).toBeInTheDocument();
    expect(screen.getAllByText('Authored Gameplay Category')).toHaveLength(2);
    expect(screen.queryByText('Romantic')).not.toBeInTheDocument();
  });

  it('requires exactly ten custom categories before team setup', async () => {
    const user = userEvent.setup();

    renderRoute('/game/play?setup=custom&media=fake');

    expect(await screen.findByRole('heading', { name: 'Custom Categories' })).toBeInTheDocument();
    const continueButton = screen.getByRole('button', { name: /Continue/ });
    expect(continueButton).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Remove 90s Bollywood' }));
    expect(continueButton).toBeDisabled();
    expect(screen.getByText('1 selections remaining.')).toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: /90s Bollywood/ }));
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(continueButton).toBeEnabled();

    await user.click(continueButton);
    expect(
      screen.getByRole('heading', { name: 'Bring two teams to the stage.' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Build the round' }));
    expect(screen.getByRole('heading', { name: 'Backstage' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Teams/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Lifelines' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rules Summary' })).toBeInTheDocument();
    expect(screen.queryByText(/estimated/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/trivia/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Start Game/ }));
    expect(screen.getByRole('heading', { name: 'Who starts this level?' })).toBeInTheDocument();
    expect(screen.queryByText(/trivia/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Team Sunset starts' }));
    expect(screen.getByRole('heading', { name: 'Choose a category.' })).toBeInTheDocument();
    expect(screen.getAllByText('Team Sunset').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('complementary', { name: 'Live game status' })).toBeInTheDocument();
    expect(screen.getByLabelText('Team Sunset lifelines')).toHaveTextContent('Hint');
    expect(screen.queryByLabelText('Team scores')).not.toBeInTheDocument();
    expect(screen.queryByText('Host controls')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish game' })).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Primary navigation' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '90s Bollywood' }));
    expect(
      screen.getByRole('heading', { name: 'The next song is ready to draw.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Game context' })).toHaveTextContent('90s Bollywood');

    await user.click(screen.getByRole('button', { name: 'Select challenge' }));
    expect(screen.getByRole('button', { name: 'Lock challenge' })).toBeInTheDocument();
    expect(screen.getByLabelText('Challenge context')).toHaveTextContent('90s Bollywood');

    await user.click(screen.getByRole('button', { name: 'Lock challenge' }));
    await user.click(await screen.findByRole('button', { name: 'Play challenge' }));
    await user.click(screen.getByRole('button', { name: 'Simulate challenge pause' }));

    expect(screen.getByRole('heading', { name: 'Continue the lyrics.' })).toBeInTheDocument();
    expect(screen.getByLabelText('Lyrics to complete')).toBeInTheDocument();
    expect(screen.getByLabelText('Host timer controls')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Record result' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hint · Free' }));
    expect(screen.getByLabelText('Team Sunset lifelines')).toHaveTextContent('×0');

    await user.click(screen.getByRole('button', { name: 'Perfect' }));
    expect(screen.getByRole('heading', { name: 'Team Sunset: Perfect' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm primary result' }));
    expect(screen.getByRole('heading', { name: 'Reveal the lyric.' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Complete verification' }));

    expect(screen.getByLabelText('Scoreboard overlay')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Review before points are applied.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Points remain pending until the host confirms.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm and apply score' }));
    expect(
      screen.getByRole('heading', { name: 'Team Sunset’s turn is complete.' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Current standings')).toHaveTextContent('Team Sunset');
    expect(screen.getByLabelText('Current standings')).toHaveTextContent('100');
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

  it('searches, duplicates, and safely deletes saved plans', async () => {
    const user = userEvent.setup();
    useGamePlanStore.getState().initialize();
    useGamePlanStore.getState().createPlan('Bollywood Party Night');
    useGamePlanStore.getState().createPlan('Retro Rewind');

    renderRoute('/plans');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Saved Game Plans' }),
    ).toBeInTheDocument();

    const search = screen.getByRole('searchbox', { name: 'Search game plans' });
    await user.type(search, 'Bollywood Party Night');
    expect(screen.getByRole('heading', { name: 'Bollywood Party Night' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Retro Rewind' })).not.toBeInTheDocument();

    await user.clear(search);
    await user.click(screen.getByRole('button', { name: 'Actions for Bollywood Party Night' }));
    await user.click(screen.getByRole('menuitem', { name: /Duplicate/ }));
    expect(screen.getByRole('heading', { name: 'Bollywood Party Night Copy' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Actions for Retro Rewind' }));
    await user.click(screen.getByRole('menuitem', { name: /Delete plan/ }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete plan' }));
    expect(screen.queryByRole('heading', { name: 'Retro Rewind' })).not.toBeInTheDocument();
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

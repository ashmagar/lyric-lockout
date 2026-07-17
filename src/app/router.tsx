import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router-dom';

import { AppShell } from '../components/AppShell/AppShell';
import { AdminPage } from '../features/admin/AdminPage';
import { GamePage } from '../features/game/GamePage';
import { HomePage } from '../features/home/HomePage';
import { NotFoundPage } from '../features/not-found/NotFoundPage';
import { PlaybackSpikePage } from '../features/playback-spike/PlaybackSpikePage';
import { PlansPage } from '../features/plans/PlansPage';
import { SettingsPage } from '../features/settings/SettingsPage';

export const appRoutes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'game', element: <GamePage /> },
      { path: 'plans', element: <PlansPage /> },
      { path: 'playback-spike', element: <PlaybackSpikePage /> },
      { path: 'admin', element: <AdminPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(appRoutes);
}

export function createTestRouter(initialEntries: string[] = ['/']) {
  return createMemoryRouter(appRoutes, { initialEntries });
}

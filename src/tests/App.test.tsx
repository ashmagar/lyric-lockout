import { render, screen } from '@testing-library/react';
import { RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { createTestRouter } from '../app/router';
import { bootstrapTheme, DEFAULT_THEME } from '../store/settingsStore';

function renderRoute(path = '/') {
  return render(<RouterProvider router={createTestRouter([path])} />);
}

describe('application shell', () => {
  it('renders the application', () => {
    renderRoute();

    expect(screen.getByRole('link', { name: 'Lyric Lockout home' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Ready to lock in the lyrics?' }),
    ).toBeInTheDocument();
  });

  it.each([
    ['/game', 'Bring two teams to the stage.'],
    ['/admin', 'Your song library, backstage.'],
    ['/settings', 'Tune the room your way.'],
  ])('loads the %s route', (path, heading) => {
    renderRoute(path);

    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
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

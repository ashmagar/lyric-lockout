import { expect, test } from '@playwright/test';

const TIMESTAMP = '2026-07-17T08:00:00.000Z';

test('a host authors, previews, saves, and deletes a disabled song draft', async ({ page }) => {
  const categories = [
    {
      id: 'party-songs',
      schemaVersion: 1,
      name: 'Party Songs',
      description: 'Party favorites',
      displayOrder: 1,
      enabled: true,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    },
  ];
  const songs: unknown[] = [];

  await page.route('http://127.0.0.1:3001/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/health') {
      await route.fulfill({ json: { ok: true } });
    } else if (url.pathname === '/api/categories') {
      await route.fulfill({ json: { categories, issues: [] } });
    } else if (url.pathname === '/api/songs' && request.method() === 'GET') {
      await route.fulfill({ json: { songs, issues: [] } });
    } else if (url.pathname === '/api/songs' && request.method() === 'PUT') {
      const song = request.postDataJSON() as { id: string };
      songs.splice(
        0,
        songs.length,
        song,
        ...songs.filter(
          (candidate) =>
            typeof candidate === 'object' &&
            candidate !== null &&
            'id' in candidate &&
            candidate.id !== song.id,
        ),
      );
      await route.fulfill({ json: { song, issues: [] } });
    } else if (url.pathname.startsWith('/api/songs/') && request.method() === 'DELETE') {
      songs.splice(0, songs.length);
      await route.fulfill({ json: { backupPath: 'data/backups/test/song.json' } });
    } else {
      await route.fulfill({ status: 404, json: { error: { message: 'Not found' } } });
    }
  });

  await page.goto('/admin?media=fake');
  await expect(page.getByText('Admin API connected')).toBeVisible();
  await page.getByRole('button', { name: 'Songs', exact: true }).click();
  await page.getByRole('button', { name: 'Add song' }).click();

  await page
    .getByRole('textbox', { name: 'YouTube URL or video ID' })
    .fill('https://youtu.be/M7lc1UVf-VE');
  await page.getByRole('textbox', { name: 'Title' }).fill('New Party Anthem');
  await page.getByRole('textbox', { name: 'Artist' }).fill('Local Test Artist');
  await page.getByRole('checkbox', { name: 'Party Songs' }).check();
  await page.getByRole('button', { name: 'Add challenge' }).click();

  await expect(page.getByLabel('Challenge preview')).toBeVisible();
  await page.getByRole('button', { name: 'Play challenge preview' }).click();
  await expect(page.getByText('PLAYING_CHALLENGE')).toBeVisible();

  await page.getByRole('button', { name: 'Save song' }).click();
  await expect(page.getByText('All changes saved.')).toBeVisible();
  await page.getByRole('button', { name: 'Close editor' }).click();
  await expect(page.getByText('New Party Anthem', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Confirm delete' }).click();
  await expect(page.getByText(/Destructive change backed up/)).toBeVisible();
  await expect(page.getByText('New Party Anthem', { exact: true })).toHaveCount(0);
});

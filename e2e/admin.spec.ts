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

test('a host creates and renames a category while its stable ID is preserved', async ({ page }) => {
  const categories: {
    id: string;
    schemaVersion: number;
    name: string;
    description?: string;
    icon?: string;
    displayOrder: number;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
  }[] = [
    {
      id: 'party-songs',
      schemaVersion: 1,
      name: 'Party Songs',
      displayOrder: 1,
      enabled: true,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    },
  ];

  await page.route('http://127.0.0.1:3001/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/health') {
      await route.fulfill({ json: { ok: true } });
    } else if (url.pathname === '/api/categories' && request.method() === 'GET') {
      await route.fulfill({ json: { categories, issues: [] } });
    } else if (url.pathname === '/api/categories' && request.method() === 'POST') {
      const category = request.postDataJSON() as (typeof categories)[number];
      categories.push(category);
      await route.fulfill({
        status: 201,
        json: { category, issues: [], backupPath: 'data/backups/category-create.json' },
      });
    } else if (url.pathname.startsWith('/api/categories/') && request.method() === 'PUT') {
      const category = request.postDataJSON() as (typeof categories)[number];
      const index = categories.findIndex((candidate) => candidate.id === category.id);
      categories[index] = category;
      await route.fulfill({
        json: { category, issues: [], backupPath: 'data/backups/category-update.json' },
      });
    } else if (url.pathname === '/api/songs' && request.method() === 'GET') {
      await route.fulfill({ json: { songs: [], issues: [] } });
    } else {
      await route.fulfill({ status: 404, json: { error: { message: 'Not found' } } });
    }
  });

  await page.goto('/admin?media=fake');
  await page.getByRole('button', { name: 'Categories', exact: true }).click();
  await page.getByRole('button', { name: 'Add category' }).click();
  const stableId = await page.getByRole('textbox', { name: 'Category ID' }).inputValue();
  await page.getByRole('textbox', { name: 'Display name' }).fill('Road Trip');
  await page.getByRole('textbox', { name: 'Icon or emoji' }).fill('🚗');
  await page.getByRole('textbox', { name: 'Description' }).fill('Songs for the open road');
  await page.getByRole('button', { name: 'Save category' }).click();

  await expect(page.getByText('Road Trip', { exact: true })).toBeVisible();
  await page.getByRole('article').filter({ hasText: 'Road Trip' }).getByRole('button').click();
  await expect(page.getByRole('textbox', { name: 'Category ID' })).toHaveValue(stableId);
  await page.getByRole('textbox', { name: 'Display name' }).fill('Road Trip Anthems');
  await page.getByRole('button', { name: 'Save category' }).click();

  await expect(page.getByText('Road Trip Anthems', { exact: true })).toBeVisible();
  expect(categories.at(-1)?.id).toBe(stableId);
});

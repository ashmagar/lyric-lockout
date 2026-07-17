import { expect, test } from '@playwright/test';

test('the foundation routes are available', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ready to lock in the lyrics?' })).toBeVisible();

  await page.getByRole('link', { name: 'Game', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The stage is getting ready.' })).toBeVisible();

  await page.getByRole('link', { name: 'Open playback spike' }).click();
  await expect(page.getByRole('heading', { name: 'YouTube pause-point rehearsal' })).toBeVisible();

  await page.getByRole('link', { name: 'Admin', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your song library, backstage.' })).toBeVisible();

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tune the room your way.' })).toBeVisible();
});

test('unknown routes show the not-found page', async ({ page }) => {
  await page.goto('/not-a-real-route');

  await expect(page.getByRole('heading', { name: 'We lost the next line.' })).toBeVisible();
});

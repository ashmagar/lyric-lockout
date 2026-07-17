import { expect, test } from '@playwright/test';

test('a host saves, validates, duplicates, renames, and starts a reusable plan', async ({
  page,
}) => {
  await page.goto('/plans');
  await expect(
    page.getByRole('heading', { name: 'Prepare the party before it starts.' }),
  ).toBeVisible();

  await page.getByRole('textbox', { name: 'New plan name' }).fill('Friday Party');
  await page.getByRole('button', { name: 'Create plan' }).click();
  await expect(page.getByRole('heading', { name: 'Friday Party', exact: true })).toBeVisible();

  await page.getByRole('combobox', { name: 'Preferred theme' }).selectOption('GAME_NIGHT');
  await page.getByRole('button', { name: 'Save and validate' }).click();
  await expect(page.getByText('Ready', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Duplicate' }).click();
  await expect(page.getByText('Friday Party Copy', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Rename' }).first().click();
  await page.getByRole('textbox', { name: /Rename Friday Party Copy/ }).fill('Saturday Party');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByText('Saturday Party', { exact: true })).toBeVisible();

  const fridayCard = page.getByText('Friday Party', { exact: true }).locator('..').locator('..');
  await fridayCard.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('textbox', { name: 'Team one' }).fill('Alpha');
  await page.getByRole('textbox', { name: 'Team two' }).fill('Beta');
  await page.getByRole('button', { name: 'Start independent game' }).click();

  await expect(page.getByRole('heading', { name: 'Ten categories are locked in.' })).toBeVisible();
  await expect(page.getByText('ROUND BUILDING', { exact: true })).toBeVisible();
  await expect(page.getByText('Game Night', { exact: true })).toBeVisible();
});

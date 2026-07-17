import { expect, test, type Page } from '@playwright/test';

const CATEGORIES = [
  '90s Bollywood',
  'Romantic',
  'Party Songs',
  'Female Vocals',
  'Sad Songs',
  'Dance Hits',
  'Classic Rock',
  'Disney',
  'Tamil',
  'Marathi',
] as const;

type TurnPath = 'PERFECT' | 'WRONG_PERFECT_STEAL' | 'MOSTLY_PERFECT_STEAL';

async function playMedia(page: Page) {
  await page.getByRole('button', { name: 'Play challenge' }).click();
  await page.getByRole('button', { name: 'Simulate challenge pause' }).click();
  await expect(page.getByRole('heading', { name: 'Continue the lyrics.' })).toBeVisible();
  await expect(page.getByText(/carry the melody into the night/)).toHaveCount(0);
}

async function resolveAnswer(page: Page, path: TurnPath) {
  if (path === 'PERFECT') {
    await page.getByRole('button', { name: 'Perfect', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm primary result' }).click();
    return;
  }

  await page
    .getByRole('button', {
      name: path === 'WRONG_PERFECT_STEAL' ? 'Wrong' : 'Mostly Correct',
      exact: true,
    })
    .click();
  await page.getByRole('button', { name: 'Confirm primary result' }).click();
  await page.getByRole('button', { name: 'Accept steal' }).click();
  await page.getByRole('button', { name: 'Perfect', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm steal result' }).click();
}

async function finishTurn(page: Page, overridePrimary?: number) {
  await expect(page.getByRole('heading', { name: 'Reveal the lyric.' })).toBeVisible();
  await expect(page.getByText(/carry the melody into the night/)).toBeVisible();
  await page.getByRole('button', { name: 'Complete verification' }).click();
  await expect(
    page.getByRole('heading', { name: 'Review before points are applied.' }),
  ).toBeVisible();

  if (overridePrimary !== undefined) {
    await page.getByText('Host score override').click();
    await page.getByRole('textbox', { name: 'Primary final points' }).fill(String(overridePrimary));
    await page.getByRole('button', { name: 'Apply primary override' }).click();
  }

  await page.getByRole('button', { name: 'Confirm and apply score' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
}

test('a host completes all five levels with fake media and every critical branch', async ({
  page,
}) => {
  await page.goto('/game?media=fake');
  await page.getByRole('textbox', { name: 'Team one' }).fill('Alpha');
  await page.getByRole('textbox', { name: 'Team two' }).fill('Beta');
  await page.getByRole('button', { name: 'Build the round' }).click();

  await expect(page.getByRole('heading', { name: 'Ten categories are locked in.' })).toBeVisible();
  await page.getByRole('button', { name: 'Validate round' }).click();
  await page.getByRole('button', { name: 'Start game' }).click();

  let categoryIndex = 0;
  for (let level = 1; level <= 5; level += 1) {
    await expect(page.getByRole('heading', { name: `Level ${level}`, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Begin trivia' }).click();
    await page.getByRole('button', { name: 'Alpha', exact: true }).click();
    await page.getByRole('button', { name: 'Alpha plays first' }).click();

    for (let turn = 0; turn < 2; turn += 1) {
      await page.getByRole('button', { name: CATEGORIES[categoryIndex], exact: true }).click();
      categoryIndex += 1;
      await page.getByRole('button', { name: 'Select challenge' }).click();

      if (level === 1 && turn === 0) {
        await page.getByRole('button', { name: 'Reroll song' }).click();
        await page.getByRole('button', { name: 'Select challenge' }).click();
      }

      await page.getByRole('button', { name: 'Lock challenge' }).click();
      await expect(page.getByTestId('fake-media-stage')).toBeVisible();
      await playMedia(page);

      if (level === 1 && turn === 0) {
        await page.getByRole('button', { name: /Hint.*Free/ }).click();
        await expect(page.getByText(/Hint: The final word rhymes with light/)).toBeVisible();
      }
      if (level === 2 && turn === 0) {
        await page.getByRole('button', { name: /Hint.*25/ }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.getByRole('button', { name: 'Confirm paid lifeline' }).click();
      }

      const path: TurnPath =
        level === 1 && turn === 1
          ? 'WRONG_PERFECT_STEAL'
          : level === 2 && turn === 0
            ? 'MOSTLY_PERFECT_STEAL'
            : 'PERFECT';
      await resolveAnswer(page, path);
      await finishTurn(page, level === 2 && turn === 0 ? 200 : undefined);
    }

    if (level < 5) {
      await expect(page.getByRole('heading', { name: 'Level summary' })).toBeVisible();
      await page.getByRole('button', { name: 'Start next level' }).click();
    }
  }

  await expect(page.getByRole('heading', { name: 'Alpha wins!' })).toBeVisible();
  await expect(page.getByText('All five levels and ten categories are complete.')).toBeVisible();
});

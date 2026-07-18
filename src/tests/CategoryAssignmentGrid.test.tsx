import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createGame, type GameSession } from '../domain';
import { CategoryAssignmentGrid } from '../features/game/GamePage';
import {
  GAMEPLAY_CATALOG_INDEX,
  GAMEPLAY_CATEGORIES,
  GAMEPLAY_ROUND_CONFIG,
} from '../features/game/gameplayCatalog';
import { resetRuntimeCatalog, updateRuntimeCatalog } from '../features/game/runtimeCatalog';

const TIMESTAMP = '2026-07-18T08:00:00.000Z';

function sessionWithConsumption(): GameSession {
  const session = createGame({
    id: 'category-grid-game',
    createdAt: TIMESTAMP,
    teams: [
      { id: 'team-a', name: 'Alpha' },
      { id: 'team-b', name: 'Beta' },
    ],
    roundConfig: GAMEPLAY_ROUND_CONFIG,
  });
  return {
    ...session,
    consumedCategoryIds: ['90s-bollywood'],
    categoryHistory: [
      {
        id: 'assignment-one',
        categoryId: '90s-bollywood',
        difficulty: 1,
        teamId: 'team-a',
        assignmentMode: 'SELF_SELECTED',
        selectedAt: TIMESTAMP,
      },
    ],
  };
}

describe('category assignment presentation', () => {
  beforeEach(() => {
    resetRuntimeCatalog();
  });

  it('keeps all configured categories ordered and disables the consumed category', async () => {
    const user = userEvent.setup();
    const onAssign = vi.fn();
    render(
      <CategoryAssignmentGrid
        assignmentMode="SELF_SELECTED"
        categories={GAMEPLAY_CATEGORIES}
        onAssign={onAssign}
        session={sessionWithConsumption()}
      />,
    );

    const categoryButtons = screen.getAllByRole('button');
    expect(categoryButtons).toHaveLength(10);
    expect(categoryButtons[0]).toHaveTextContent('90s Bollywood');
    expect(categoryButtons[1]).toHaveTextContent('Romantic');

    const consumed = screen.getByRole('button', {
      name: '90s Bollywood Used by Alpha',
    });
    expect(consumed).toBeDisabled();
    expect(consumed).toHaveAttribute('data-category-state', 'CONSUMED');
    await user.click(consumed);
    expect(onAssign).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Romantic' }));
    expect(onAssign).toHaveBeenCalledWith('romantic', 'SELF_SELECTED');
  });

  it('disables a category when its only eligible song was used in another category', () => {
    const sourceSong = GAMEPLAY_CATALOG_INDEX.songById.get('song-90s-bollywood');
    const romanticSong = GAMEPLAY_CATALOG_INDEX.songById.get('song-romantic');
    if (!sourceSong || !romanticSong) throw new Error('Expected bundled test songs');

    const sharedSong = {
      ...sourceSong,
      id: 'song-shared-category-grid',
      categoryIds: ['90s-bollywood', 'romantic'],
      challenges: sourceSong.challenges.map((challenge) => ({
        ...challenge,
        id: `category-grid-${challenge.id}`,
      })),
    };
    updateRuntimeCatalog(GAMEPLAY_CATEGORIES, [
      sharedSong,
      {
        ...romanticSong,
        enabled: false,
      },
    ]);

    const session = {
      ...sessionWithConsumption(),
      playedSongIds: [sharedSong.id],
    };
    render(
      <CategoryAssignmentGrid
        assignmentMode="SELF_SELECTED"
        categories={GAMEPLAY_CATEGORIES}
        onAssign={vi.fn()}
        session={session}
      />,
    );

    const romantic = screen.getByRole('button', {
      name: 'Romantic No unused songs left',
    });
    expect(romantic).toBeDisabled();
    expect(romantic).toHaveAttribute('data-category-state', 'DISABLED');
  });
});

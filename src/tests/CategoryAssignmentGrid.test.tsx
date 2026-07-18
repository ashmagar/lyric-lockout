import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createGame, type GameSession } from '../domain';
import { CategoryAssignmentGrid } from '../features/game/GamePage';
import { GAMEPLAY_CATEGORIES, GAMEPLAY_ROUND_CONFIG } from '../features/game/gameplayCatalog';

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
});

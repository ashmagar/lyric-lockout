import { beforeEach, describe, expect, it } from 'vitest';

import { useGameplayStore } from '../store/gameplayStore';

describe('gameplay application store', () => {
  beforeEach(() => {
    useGameplayStore.getState().reset();
  });

  it('creates two teams and advances through round validation by dispatching commands', () => {
    const store = useGameplayStore.getState();
    store.startSetup('Alpha', 'Beta');

    expect(useGameplayStore.getState().session).toMatchObject({
      phase: 'ROUND_BUILDING',
      teams: [{ name: 'Alpha' }, { name: 'Beta' }],
    });

    useGameplayStore.getState().send({ type: 'VALIDATE_ROUND' });
    expect(useGameplayStore.getState().session?.phase).toBe('ROUND_VALIDATION');

    useGameplayStore.getState().send({ type: 'START_GAME' });
    expect(useGameplayStore.getState().session?.phase).toBe('LEVEL_INTRO');
  });

  it('selects a replacement challenge while preserving the assigned category', () => {
    const store = useGameplayStore.getState();
    store.startSetup('Alpha', 'Beta');
    useGameplayStore.getState().send({ type: 'VALIDATE_ROUND' });
    useGameplayStore.getState().send({ type: 'START_GAME' });
    useGameplayStore.getState().send({ type: 'BEGIN_TRIVIA' });
    useGameplayStore.getState().send({ type: 'RECORD_TRIVIA_WINNER', teamId: 'team-a' });
    useGameplayStore.getState().confirmTurnOrder('team-a');
    useGameplayStore.getState().assignCategory('90s-bollywood', 'SELF_SELECTED');
    useGameplayStore.getState().selectChallenge();

    const first = useGameplayStore.getState().session?.activeChallenge?.challenge.id;
    useGameplayStore.getState().send({ type: 'REROLL_CHALLENGE' });
    useGameplayStore.getState().selectChallenge();
    const replacement = useGameplayStore.getState().session?.activeChallenge?.challenge.id;

    expect(first).toBe('challenge-90s-bollywood-1-1');
    expect(replacement).toBe('challenge-90s-bollywood-1-2');
    expect(useGameplayStore.getState().session?.activeTurn?.categoryId).toBe('90s-bollywood');
  });
});

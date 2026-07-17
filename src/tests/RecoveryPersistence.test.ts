import { beforeEach, describe, expect, it } from 'vitest';

import { LocalStorageGameSessionRepository, type GameSessionRepository } from '../repositories';
import { configureGameplayRepository, useGameplayStore } from '../store/gameplayStore';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

let repository: GameSessionRepository;

function resetMemoryOnly() {
  useGameplayStore.setState({
    session: undefined,
    events: [],
    eventBatch: 0,
    failure: undefined,
    persistenceStatus: 'UNINITIALIZED',
    savedSession: undefined,
    savedSessionIssue: undefined,
    completedSummaries: [],
    persistenceError: undefined,
    pendingPaidLifeline: undefined,
  });
}

function reachCategoryAssignment() {
  const store = useGameplayStore.getState();
  store.startSetup('Alpha', 'Beta');
  useGameplayStore.getState().send({ type: 'VALIDATE_ROUND' });
  useGameplayStore.getState().send({ type: 'START_GAME' });
  useGameplayStore.getState().send({ type: 'BEGIN_TRIVIA' });
  useGameplayStore.getState().send({ type: 'RECORD_TRIVIA_WINNER', teamId: 'team-a' });
  useGameplayStore.getState().confirmTurnOrder('team-a');
}

function reachPreview() {
  reachCategoryAssignment();
  useGameplayStore.getState().assignCategory('90s-bollywood', 'SELF_SELECTED');
  useGameplayStore.getState().selectChallenge();
}

function reachPlayback() {
  reachPreview();
  useGameplayStore.getState().send({ type: 'CONFIRM_CHALLENGE' });
  useGameplayStore.getState().send({ type: 'MARK_VIDEO_READY' });
  useGameplayStore.getState().send({ type: 'PLAY_VIDEO' });
}

function reachPrimaryAnswering() {
  reachPlayback();
  useGameplayStore.getState().send({ type: 'MARK_VIDEO_PAUSED' });
}

function reachStealAnswering() {
  reachPrimaryAnswering();
  useGameplayStore.getState().send({ type: 'CLASSIFY_PRIMARY', result: 'WRONG' });
  useGameplayStore.getState().send({ type: 'CONFIRM_PRIMARY_RESULT' });
  useGameplayStore.getState().acceptSteal();
}

function reachScoreReview() {
  reachPrimaryAnswering();
  useGameplayStore.getState().send({ type: 'CLASSIFY_PRIMARY', result: 'PERFECT' });
  useGameplayStore.getState().send({ type: 'CONFIRM_PRIMARY_RESULT' });
  useGameplayStore.getState().send({ type: 'COMPLETE_VERIFICATION' });
}

function simulateReloadAndResume() {
  resetMemoryOnly();
  useGameplayStore.getState().initializePersistence();
  expect(useGameplayStore.getState().savedSession).toBeDefined();
  useGameplayStore.getState().resumeSavedGame();
  return useGameplayStore.getState().session;
}

describe('gameplay refresh recovery', () => {
  beforeEach(() => {
    repository = new LocalStorageGameSessionRepository(new MemoryStorage());
    configureGameplayRepository(repository);
    resetMemoryOnly();
  });

  it.each([
    ['category assignment', reachCategoryAssignment, 'CATEGORY_ASSIGNMENT'],
    ['challenge preview', reachPreview, 'CHALLENGE_PREVIEW'],
    ['video playback', reachPlayback, 'VIDEO_READY'],
    ['primary answering', reachPrimaryAnswering, 'PRIMARY_ANSWERING'],
    ['steal answering', reachStealAnswering, 'STEAL_ANSWERING'],
    ['score review', reachScoreReview, 'FINAL_SCORE_REVIEW'],
  ] as const)('restores %s to its safe host phase', (_label, reachPhase, expectedPhase) => {
    reachPhase();
    const challengeId = useGameplayStore.getState().session?.activeChallenge?.challenge.id;

    const restored = simulateReloadAndResume();

    expect(restored?.phase).toBe(expectedPhase);
    expect(restored?.activeChallenge?.challenge.id).toBe(challengeId);
    if (expectedPhase === 'PRIMARY_ANSWERING') {
      expect(restored?.activeTurn?.primaryAttempt?.timer.status).toBe('PAUSED');
    }
    if (expectedPhase === 'STEAL_ANSWERING') {
      expect(restored?.activeTurn?.stealAttempt?.timer.status).toBe('PAUSED');
    }
  });

  it('does not silently drop a valid active session before the host chooses', () => {
    reachPreview();
    const savedId = useGameplayStore.getState().session?.id;

    resetMemoryOnly();
    useGameplayStore.getState().initializePersistence();

    expect(useGameplayStore.getState().session).toBeUndefined();
    expect(useGameplayStore.getState().savedSession?.id).toBe(savedId);
    expect(repository.loadActiveSession()).toMatchObject({
      status: 'VALID',
      session: { id: savedId },
    });
  });
});

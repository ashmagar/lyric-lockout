import { create } from 'zustand';

import { selectChallenge } from '../domain/catalog';
import { createGame, getWinningTeams } from '../domain/engine';
import type { CategoryAssignmentMode, LifelineType } from '../domain/enums';
import type { ActiveChallenge, GameSession } from '../domain/models/game';
import type { GameCommand } from '../domain/stateMachine/commands';
import type { DomainEvent } from '../domain/stateMachine/events';
import { processGameCommand } from '../domain/stateMachine';
import { GAMEPLAY_ROUND_CONFIG } from '../features/game/gameplayCatalog';
import { getRuntimeCatalogIndex } from '../features/game/runtimeCatalog';
import { LocalStorageGameSessionRepository, type GameSessionRepository } from '../repositories';
import type { CompletedGameSummary } from '../schemas';

type CommandInput<T extends GameCommand = GameCommand> = T extends GameCommand
  ? Omit<T, 'commandId' | 'issuedAt'>
  : never;

interface PaidLifelineRequest {
  teamId: string;
  lifelineType: LifelineType;
  usageId: string;
  penaltyPoints: number;
}

export interface SavedSessionIssue {
  kind: 'CORRUPT' | 'UNSUPPORTED';
  message: string;
  raw: string;
}

export interface GameplayState {
  session?: GameSession | undefined;
  events: DomainEvent[];
  eventBatch: number;
  failure?: string | undefined;
  persistenceStatus: 'UNINITIALIZED' | 'LOADING' | 'READY';
  savedSession?: GameSession | undefined;
  savedSessionIssue?: SavedSessionIssue | undefined;
  completedSummaries: CompletedGameSummary[];
  persistenceError?: string | undefined;
  pendingPaidLifeline?: PaidLifelineRequest | undefined;
  initializePersistence: () => void;
  resumeSavedGame: () => void;
  discardSavedGame: () => void;
  exportRecoveryData: () => string;
  clearPersistenceError: () => void;
  startSetup: (teamOneName: string, teamTwoName: string) => void;
  startSession: (session: GameSession) => void;
  send: (command: CommandInput) => boolean;
  selectChallenge: () => void;
  assignCategory: (categoryId: string, assignmentMode: CategoryAssignmentMode) => void;
  confirmTurnOrder: (firstPlayingTeamId: string) => void;
  activateLifeline: (teamId: string, lifelineType: LifelineType) => void;
  confirmPaidLifeline: () => void;
  dismissPaidLifeline: () => void;
  acceptSteal: () => void;
  declineSteal: () => void;
  completeTurn: () => void;
  adjustTimer: (deltaMilliseconds: number) => void;
  clearFailure: () => void;
  reset: () => void;
}

let idSequence = 0;
let configuredRepository: GameSessionRepository | undefined;

function nextId(prefix: string): string {
  idSequence += 1;
  const unique =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${idSequence}`;
  return `${prefix}-${unique}`;
}

function timestamp(): string {
  return new Date().toISOString();
}

function withCommandMetadata(input: CommandInput): GameCommand {
  return {
    ...input,
    commandId: nextId('command'),
    issuedAt: timestamp(),
  };
}

function getRepository(): GameSessionRepository {
  return (configuredRepository ??= new LocalStorageGameSessionRepository(window.localStorage));
}

function completedSummary(session: GameSession): CompletedGameSummary {
  return {
    schemaVersion: 1,
    gameId: session.id,
    completedAt: session.completedAt ?? session.updatedAt,
    teams: session.teams.map(({ id, name, score }) => ({ id, name, score })),
    winnerTeamIds: getWinningTeams(session).map((team) => team.id),
  };
}

function persistenceMessage(error: unknown): string {
  return error instanceof Error
    ? `Game progress could not be saved: ${error.message}`
    : 'Game progress could not be saved.';
}

export function configureGameplayRepository(repository: GameSessionRepository | undefined): void {
  configuredRepository = repository;
}

export const useGameplayStore = create<GameplayState>((set, get) => ({
  events: [],
  eventBatch: 0,
  persistenceStatus: 'UNINITIALIZED',
  completedSummaries: [],

  initializePersistence() {
    if (get().persistenceStatus !== 'UNINITIALIZED') return;
    set({ persistenceStatus: 'LOADING' });

    try {
      const repository = getRepository();
      const active = repository.loadActiveSession();
      const completedSummaries = repository.loadCompletedSummaries();
      if (active.status === 'VALID') {
        set({
          persistenceStatus: 'READY',
          savedSession: active.session,
          savedSessionIssue: undefined,
          completedSummaries,
          persistenceError: undefined,
        });
      } else if (active.status === 'CORRUPT' || active.status === 'UNSUPPORTED') {
        set({
          persistenceStatus: 'READY',
          savedSession: undefined,
          savedSessionIssue: {
            kind: active.status,
            message: active.message,
            raw: active.raw,
          },
          completedSummaries,
          persistenceError: undefined,
        });
      } else {
        set({
          persistenceStatus: 'READY',
          savedSession: undefined,
          savedSessionIssue: undefined,
          completedSummaries,
          persistenceError: undefined,
        });
      }
    } catch (error) {
      set({
        persistenceStatus: 'READY',
        persistenceError: persistenceMessage(error),
      });
    }
  },

  resumeSavedGame() {
    const savedSession = get().savedSession;
    if (!savedSession) return;

    if (savedSession.phase === 'GAME_SUMMARY') {
      set({
        session: savedSession,
        savedSession: undefined,
        events: [],
        eventBatch: get().eventBatch + 1,
        failure: undefined,
      });
      return;
    }

    const recoveryResult =
      savedSession.phase === 'RECOVERY'
        ? { ok: true as const, session: savedSession }
        : processGameCommand(
            savedSession,
            withCommandMetadata({
              type: 'ENTER_RECOVERY',
              reason: 'Browser refresh',
            }),
          );
    if (!recoveryResult.ok) {
      set({ failure: recoveryResult.failure.message });
      return;
    }

    const resumeResult = processGameCommand(
      recoveryResult.session,
      withCommandMetadata({ type: 'RESUME_FROM_RECOVERY' }),
    );
    if (!resumeResult.ok) {
      set({ failure: resumeResult.failure.message });
      return;
    }

    set({
      session: resumeResult.session,
      savedSession: undefined,
      events: resumeResult.events,
      eventBatch: get().eventBatch + 1,
      failure: undefined,
      persistenceError: undefined,
    });
    try {
      getRepository().saveActiveSession(resumeResult.session);
    } catch (error) {
      set({ persistenceError: persistenceMessage(error) });
    }
  },

  discardSavedGame() {
    try {
      getRepository().clearActiveSession();
      set({
        savedSession: undefined,
        savedSessionIssue: undefined,
        persistenceError: undefined,
      });
    } catch (error) {
      set({ persistenceError: persistenceMessage(error) });
    }
  },

  exportRecoveryData() {
    const issue = get().savedSessionIssue;
    if (issue) return issue.raw;
    return JSON.stringify(get().session ?? get().savedSession ?? null, null, 2);
  },

  clearPersistenceError() {
    set({ persistenceError: undefined });
  },

  startSetup(teamOneName, teamTwoName) {
    const createdAt = timestamp();
    const session = createGame({
      id: nextId('game'),
      createdAt,
      teams: [
        { id: 'team-a', name: teamOneName },
        { id: 'team-b', name: teamTwoName },
      ],
      roundConfig: GAMEPLAY_ROUND_CONFIG,
    });
    set({
      session,
      events: [],
      failure: undefined,
      pendingPaidLifeline: undefined,
      eventBatch: get().eventBatch + 1,
      persistenceError: undefined,
    });
    get().send({ type: 'ENTER_ROUND_BUILDING' });
  },

  startSession(session) {
    set({
      session,
      savedSession: undefined,
      savedSessionIssue: undefined,
      events: [],
      failure: undefined,
      pendingPaidLifeline: undefined,
      eventBatch: get().eventBatch + 1,
      persistenceError: undefined,
    });
    get().send({ type: 'ENTER_ROUND_BUILDING' });
  },

  send(input) {
    const session = get().session;
    if (!session) {
      set({ failure: 'Start a game before sending gameplay commands.' });
      return false;
    }
    const result = processGameCommand(session, withCommandMetadata(input));
    if (!result.ok) {
      set({ failure: result.failure.message });
      return false;
    }

    const confirmation = result.events.find(
      (event): event is Extract<DomainEvent, { type: 'LIFELINE_CONFIRMATION_REQUESTED' }> =>
        event.type === 'LIFELINE_CONFIRMATION_REQUESTED',
    );
    set({
      session: result.session,
      events: result.events,
      eventBatch: get().eventBatch + 1,
      failure: undefined,
      pendingPaidLifeline: confirmation
        ? {
            teamId: confirmation.teamId,
            lifelineType: confirmation.lifelineType,
            usageId: get().pendingPaidLifeline?.usageId ?? nextId('lifeline'),
            penaltyPoints: confirmation.penaltyPoints,
          }
        : undefined,
    });

    try {
      const repository = getRepository();
      if (result.session.phase === 'GAME_SUMMARY') {
        repository.saveCompletedSummary(completedSummary(result.session));
        repository.clearActiveSession();
        set({
          completedSummaries: repository.loadCompletedSummaries(),
          persistenceError: undefined,
        });
      } else {
        repository.saveActiveSession(result.session);
        set({ persistenceError: undefined });
      }
    } catch (error) {
      set({ persistenceError: persistenceMessage(error) });
    }
    return true;
  },

  selectChallenge() {
    const session = get().session;
    const turn = session?.activeTurn;
    if (!session || !turn?.categoryId) {
      set({ failure: 'Assign a category before selecting a challenge.' });
      return;
    }
    const result = selectChallenge(
      getRuntimeCatalogIndex(),
      {
        categoryId: turn.categoryId,
        difficulty: turn.difficulty,
        songSelectionMode: session.roundConfig.songSelectionMode,
        approvedChallengeIds: session.roundConfig.manualChallengePools.find(
          (pool) => pool.categoryId === turn.categoryId,
        )?.approvedChallengeIdsByDifficulty[turn.difficulty],
        excludedChallengeIds: [
          ...new Set([...session.playedChallengeIds, ...session.rejectedChallengeIds]),
        ],
        excludedSongIds: session.playedSongIds,
        allowSongReuseFallback: true,
      },
      () => 0,
    );
    if (!result.ok) {
      set({ failure: result.diagnostics.map((diagnostic) => diagnostic.message).join('; ') });
      return;
    }
    const activeChallenge: ActiveChallenge = {
      reference: result.candidate.reference,
      song: result.candidate.song,
      category: result.candidate.category,
      challenge: result.candidate.challenge,
      selectedAt: timestamp(),
    };
    get().send({ type: 'SELECT_CHALLENGE', activeChallenge });
  },

  assignCategory(categoryId, assignmentMode) {
    get().send({
      type: 'ASSIGN_CATEGORY',
      categoryId,
      assignmentMode,
      assignmentRecordId: nextId('category-assignment'),
    });
  },

  confirmTurnOrder(firstPlayingTeamId) {
    get().send({
      type: 'CONFIRM_TURN_ORDER',
      firstPlayingTeamId,
      turnId: nextId('turn'),
      primaryAttemptId: nextId('primary-attempt'),
    });
  },

  activateLifeline(teamId, lifelineType) {
    const usageId = nextId('lifeline');
    set({
      pendingPaidLifeline: {
        teamId,
        lifelineType,
        usageId,
        penaltyPoints: get().session?.gameConfig.additionalLifelinePenaltyPoints ?? 25,
      },
    });
    get().send({ type: 'USE_LIFELINE', teamId, lifelineType, usageId });
  },

  confirmPaidLifeline() {
    const request = get().pendingPaidLifeline;
    if (!request) return;
    get().send({
      type: 'USE_LIFELINE',
      teamId: request.teamId,
      lifelineType: request.lifelineType,
      usageId: request.usageId,
      confirmPaidUse: true,
    });
  },

  dismissPaidLifeline() {
    set({ pendingPaidLifeline: undefined });
  },

  acceptSteal() {
    get().send({ type: 'ACCEPT_STEAL', stealAttemptId: nextId('steal-attempt') });
  },

  declineSteal() {
    get().send({ type: 'DECLINE_STEAL', stealAttemptId: nextId('steal-attempt') });
  },

  completeTurn() {
    const session = get().session;
    if (!session) return;
    const needsNextTurn = session.currentLevelState.primaryTurnsCompleted === 0;
    get().send({
      type: 'COMPLETE_TURN',
      nextTurnId: needsNextTurn ? nextId('turn') : undefined,
      nextPrimaryAttemptId: needsNextTurn ? nextId('primary-attempt') : undefined,
    });
  },

  adjustTimer(deltaMilliseconds) {
    get().send({
      type: 'ADJUST_TIMER',
      adjustmentId: nextId('timer-adjustment'),
      deltaMilliseconds,
    });
  },

  clearFailure() {
    set({ failure: undefined });
  },

  reset() {
    let persistenceError: string | undefined;
    try {
      getRepository().clearActiveSession();
    } catch (error) {
      persistenceError = persistenceMessage(error);
    }
    set({
      session: undefined,
      events: [],
      eventBatch: get().eventBatch + 1,
      failure: undefined,
      pendingPaidLifeline: undefined,
      persistenceError,
    });
  },
}));

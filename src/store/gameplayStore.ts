import { create } from 'zustand';

import { selectChallenge } from '../domain/catalog';
import { createGame } from '../domain/engine';
import type { CategoryAssignmentMode, LifelineType } from '../domain/enums';
import type { ActiveChallenge, GameSession } from '../domain/models/game';
import type { GameCommand } from '../domain/stateMachine/commands';
import type { DomainEvent } from '../domain/stateMachine/events';
import { processGameCommand } from '../domain/stateMachine';
import { GAMEPLAY_CATALOG_INDEX, GAMEPLAY_ROUND_CONFIG } from '../features/game/gameplayCatalog';

type CommandInput<T extends GameCommand = GameCommand> = T extends GameCommand
  ? Omit<T, 'commandId' | 'issuedAt'>
  : never;

interface PaidLifelineRequest {
  teamId: string;
  lifelineType: LifelineType;
  usageId: string;
  penaltyPoints: number;
}

interface GameplayState {
  session?: GameSession | undefined;
  events: DomainEvent[];
  eventBatch: number;
  failure?: string | undefined;
  pendingPaidLifeline?: PaidLifelineRequest | undefined;
  startSetup: (teamOneName: string, teamTwoName: string) => void;
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

function nextId(prefix: string): string {
  idSequence += 1;
  return `${prefix}-${idSequence}`;
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

export const useGameplayStore = create<GameplayState>((set, get) => ({
  events: [],
  eventBatch: 0,

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
      GAMEPLAY_CATALOG_INDEX,
      {
        categoryId: turn.categoryId,
        difficulty: turn.difficulty,
        songSelectionMode: session.roundConfig.songSelectionMode,
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
    idSequence = 0;
    set({
      session: undefined,
      events: [],
      eventBatch: get().eventBatch + 1,
      failure: undefined,
      pendingPaidLifeline: undefined,
    });
  },
}));

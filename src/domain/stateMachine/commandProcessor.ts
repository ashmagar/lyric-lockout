import {
  applyTurnScore,
  assignCategory,
  classifyPrimaryAnswer,
  classifyStealAnswer,
  completeTurn,
  confirmChallenge,
  GameRuleError,
  overrideTurnScore,
  recommendTurnScore,
  recordLevelOrder,
  startPrimaryTurn,
  startStealAttempt,
  useLifeline as applyLifeline,
} from '../engine';
import type { GamePhase } from '../enums';
import type { AnswerAttempt } from '../models/attempt';
import type { ActiveTurn, CategorySelectionRecord, GameSession } from '../models/game';
import type { ChallengeTimerState } from '../models/timer';
import type { GameCommand } from './commands';
import type { DomainEvent } from './events';
import { getSafeRecoveryPhase, pauseActiveTimersForRecovery } from './recovery';
import type { CommandFailure, CommandResult, CommandSuccess } from './results';
import { isLegalPhaseTransition } from './transitions';

const MAX_PROCESSED_COMMAND_IDS = 100;

class CommandTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommandTransitionError';
  }
}

interface ExecutionResult {
  session: GameSession;
  events: DomainEvent[];
}

function eventBase(command: GameCommand) {
  return { commandId: command.commandId, occurredAt: command.issuedAt };
}

function requirePhase(session: GameSession, command: GameCommand, ...phases: GamePhase[]): void {
  if (!phases.includes(session.phase)) {
    throw new CommandTransitionError(
      `${command.type} is not allowed during ${session.phase}; expected ${phases.join(' or ')}`,
    );
  }
}

function transition(
  session: GameSession,
  to: GamePhase,
  command: GameCommand,
  events: DomainEvent[] = [],
): ExecutionResult {
  if (!isLegalPhaseTransition(session.phase, to)) {
    throw new CommandTransitionError(`Illegal phase transition: ${session.phase} -> ${to}`);
  }

  return {
    session: { ...session, phase: to, updatedAt: command.issuedAt },
    events: [
      ...events,
      {
        ...eventBase(command),
        type: 'PHASE_CHANGED',
        from: session.phase,
        to,
      },
    ],
  };
}

function getTurn(session: GameSession): ActiveTurn {
  if (!session.activeTurn) {
    throw new GameRuleError('NO_ACTIVE_TURN', 'This command requires an active turn');
  }
  return session.activeTurn;
}

function getAttemptForAnsweringPhase(session: GameSession): AnswerAttempt {
  const turn = getTurn(session);
  const attempt = session.phase === 'STEAL_ANSWERING' ? turn.stealAttempt : turn.primaryAttempt;
  if (!attempt) {
    throw new GameRuleError('TURN_NOT_READY', 'The answering attempt is missing');
  }
  return attempt;
}

function replaceAnsweringAttempt(
  session: GameSession,
  update: (attempt: AnswerAttempt) => AnswerAttempt,
): GameSession {
  const turn = getTurn(session);
  const isSteal = session.phase === 'STEAL_ANSWERING';
  const attempt = isSteal ? turn.stealAttempt : turn.primaryAttempt;
  if (!attempt) {
    throw new GameRuleError('TURN_NOT_READY', 'The answering attempt is missing');
  }

  return {
    ...session,
    activeTurn: isSteal
      ? { ...turn, stealAttempt: update(attempt) }
      : { ...turn, primaryAttempt: update(attempt) },
  };
}

function startTimer(timer: ChallengeTimerState, startedAt: string): ChallengeTimerState {
  return {
    ...timer,
    status: 'RUNNING',
    startedAt,
    lastResumedAt: startedAt,
    expiredAt: undefined,
    completedAt: undefined,
  };
}

function completeAnsweringTimer(session: GameSession, completedAt: string): GameSession {
  return replaceAnsweringAttempt(session, (attempt) => ({
    ...attempt,
    timer: { ...attempt.timer, status: 'COMPLETED', completedAt },
  }));
}

function findCurrentAssignment(session: GameSession): CategorySelectionRecord {
  const turn = getTurn(session);
  for (let index = session.categoryHistory.length - 1; index >= 0; index -= 1) {
    const record = session.categoryHistory[index];
    if (!record) continue;
    if (
      record.categoryId === turn.categoryId &&
      record.teamId === turn.primaryTeamId &&
      record.difficulty === turn.difficulty
    ) {
      return record;
    }
  }
  throw new GameRuleError('TURN_NOT_READY', 'The turn category assignment is missing');
}

function validateSelectedChallenge(session: GameSession, command: GameCommand): void {
  if (command.type !== 'SELECT_CHALLENGE') return;
  const turn = getTurn(session);
  const snapshot = command.activeChallenge;
  const reference = snapshot.reference;

  if (
    !turn.categoryId ||
    reference.categoryId !== turn.categoryId ||
    reference.difficulty !== turn.difficulty ||
    reference.songId !== snapshot.song.id ||
    reference.challengeId !== snapshot.challenge.id ||
    snapshot.category.id !== turn.categoryId ||
    snapshot.challenge.difficulty !== turn.difficulty
  ) {
    throw new GameRuleError('CHALLENGE_MISMATCH', 'Selected challenge does not match this turn');
  }
  if (
    session.playedChallengeIds.includes(reference.challengeId) ||
    session.rejectedChallengeIds.includes(reference.challengeId)
  ) {
    throw new GameRuleError('CHALLENGE_ALREADY_PLAYED', 'The challenge is unavailable');
  }
}

function beginVerification(session: GameSession, command: GameCommand): ExecutionResult {
  const activeChallenge = session.activeChallenge;
  if (!activeChallenge) {
    throw new GameRuleError('CHALLENGE_REQUIRED', 'Verification requires an active challenge');
  }

  return transition(session, 'CHALLENGE_VERIFICATION', command, [
    { ...eventBase(command), type: 'SUSPENSE_STOP_REQUESTED' },
    {
      ...eventBase(command),
      type: 'VIDEO_SEEK_REQUESTED',
      seconds: activeChallenge.challenge.verifyFromSeconds,
    },
    { ...eventBase(command), type: 'VIDEO_PLAY_REQUESTED', purpose: 'VERIFICATION' },
  ]);
}

function timerCommand(session: GameSession, command: GameCommand): ExecutionResult {
  requirePhase(session, command, 'PRIMARY_ANSWERING', 'STEAL_ANSWERING');
  const attempt = getAttemptForAnsweringPhase(session);
  let action: Extract<DomainEvent, { type: 'TIMER_ACTION_REQUESTED' }>['action'];
  let updated = session;
  let deltaMilliseconds: number | undefined;

  switch (command.type) {
    case 'PAUSE_TIMER':
      if (attempt.timer.status !== 'RUNNING' || command.remainingMilliseconds < 0) {
        throw new GameRuleError('TURN_NOT_READY', 'Only a running timer can be paused');
      }
      action = 'PAUSE';
      updated = replaceAnsweringAttempt(session, (current) => ({
        ...current,
        timer: {
          ...current.timer,
          status: 'PAUSED',
          remainingMilliseconds: command.remainingMilliseconds,
          pauseHistory: [
            ...current.timer.pauseHistory,
            {
              pausedAt: command.issuedAt,
              remainingMilliseconds: command.remainingMilliseconds,
            },
          ],
        },
      }));
      break;
    case 'RESUME_TIMER':
      if (attempt.timer.status !== 'PAUSED') {
        throw new GameRuleError('TURN_NOT_READY', 'Only a paused timer can be resumed');
      }
      action = 'RESUME';
      updated = replaceAnsweringAttempt(session, (current) => {
        const pauseHistory = [...current.timer.pauseHistory];
        const latest = pauseHistory.at(-1);
        if (latest && !latest.resumedAt) {
          pauseHistory[pauseHistory.length - 1] = { ...latest, resumedAt: command.issuedAt };
        }
        return {
          ...current,
          timer: {
            ...current.timer,
            status: 'RUNNING',
            lastResumedAt: command.issuedAt,
            pauseHistory,
          },
        };
      });
      break;
    case 'RESTART_TIMER':
      action = 'RESTART';
      updated = replaceAnsweringAttempt(session, (current) => ({
        ...current,
        timer: {
          ...startTimer(current.timer, command.issuedAt),
          remainingMilliseconds: current.timer.configuredSeconds * 1000,
        },
      }));
      break;
    case 'ADJUST_TIMER':
      action = 'ADJUST';
      deltaMilliseconds = command.deltaMilliseconds;
      updated = replaceAnsweringAttempt(session, (current) => ({
        ...current,
        timer: {
          ...current.timer,
          remainingMilliseconds: Math.max(
            0,
            current.timer.remainingMilliseconds + command.deltaMilliseconds,
          ),
          adjustments: [
            ...current.timer.adjustments,
            {
              id: command.adjustmentId,
              deltaMilliseconds: command.deltaMilliseconds,
              adjustedAt: command.issuedAt,
              reason: command.reason,
            },
          ],
        },
      }));
      break;
    case 'DISABLE_TIMER':
      action = 'DISABLE';
      updated = replaceAnsweringAttempt(session, (current) => ({
        ...current,
        timer: { ...current.timer, status: 'DISABLED' },
      }));
      break;
    case 'END_TIMER':
      action = 'END';
      updated = completeAnsweringTimer(session, command.issuedAt);
      break;
    default:
      throw new CommandTransitionError(`${command.type} is not a timer-control command`);
  }

  return {
    session: { ...updated, updatedAt: command.issuedAt },
    events: [
      {
        ...eventBase(command),
        type: 'TIMER_ACTION_REQUESTED',
        action,
        attemptId: attempt.id,
        deltaMilliseconds,
      },
    ],
  };
}

function executeCommand(session: GameSession, command: GameCommand): ExecutionResult {
  switch (command.type) {
    case 'ENTER_ROUND_BUILDING':
      requirePhase(session, command, 'GAME_SETUP', 'ROUND_VALIDATION');
      return transition(session, 'ROUND_BUILDING', command);
    case 'VALIDATE_ROUND': {
      requirePhase(session, command, 'ROUND_BUILDING');
      if (session.teams.length !== 2 || new Set(session.teams.map((team) => team.id)).size !== 2) {
        throw new GameRuleError('INVALID_TEAM_COUNT', 'A valid game requires two unique teams');
      }
      if (
        session.roundConfig.selectedCategoryIds.length !== 10 ||
        new Set(session.roundConfig.selectedCategoryIds).size !== 10
      ) {
        throw new GameRuleError(
          'INVALID_CATEGORY_COUNT',
          'A valid round requires ten unique categories',
        );
      }
      return transition(session, 'ROUND_VALIDATION', command);
    }
    case 'START_GAME':
      requirePhase(session, command, 'ROUND_VALIDATION');
      return transition(
        { ...session, status: 'IN_PROGRESS', startedAt: command.issuedAt },
        'LEVEL_INTRO',
        command,
      );
    case 'BEGIN_TRIVIA':
      requirePhase(session, command, 'LEVEL_INTRO');
      return transition(session, 'TRIVIA_RESULT_ENTRY', command);
    case 'RECORD_TRIVIA_WINNER': {
      requirePhase(session, command, 'TRIVIA_RESULT_ENTRY');
      if (!session.teams.some((team) => team.id === command.teamId)) {
        throw new GameRuleError('INVALID_TEAM', 'Trivia winner must be a team in the game');
      }
      return transition(
        {
          ...session,
          currentLevelState: {
            ...session.currentLevelState,
            triviaWinnerTeamId: command.teamId,
          },
        },
        'TURN_ORDER_CONFIRMATION',
        command,
      );
    }
    case 'CONFIRM_TURN_ORDER': {
      requirePhase(session, command, 'TURN_ORDER_CONFIRMATION');
      const triviaWinner = session.currentLevelState.triviaWinnerTeamId;
      if (!triviaWinner) {
        throw new GameRuleError('LEVEL_ORDER_REQUIRED', 'Record the trivia winner first');
      }
      let updated = recordLevelOrder(
        session,
        triviaWinner,
        command.firstPlayingTeamId,
        command.issuedAt,
      );
      updated = startPrimaryTurn(updated, {
        teamId: command.firstPlayingTeamId,
        turnId: command.turnId,
        attemptId: command.primaryAttemptId,
        startedAt: command.issuedAt,
      });
      return transition(updated, 'CATEGORY_ASSIGNMENT', command);
    }
    case 'ASSIGN_CATEGORY': {
      requirePhase(session, command, 'CATEGORY_ASSIGNMENT');
      const updated = assignCategory(session, {
        assignmentRecordId: command.assignmentRecordId,
        assignmentMode: command.assignmentMode,
        categoryId: command.categoryId,
        assignedAt: command.issuedAt,
      });
      return transition(updated, 'CHALLENGE_SELECTION', command);
    }
    case 'SELECT_CHALLENGE':
      requirePhase(session, command, 'CHALLENGE_SELECTION');
      validateSelectedChallenge(session, command);
      return transition(
        { ...session, activeChallenge: command.activeChallenge },
        'CHALLENGE_PREVIEW',
        command,
      );
    case 'REROLL_CHALLENGE': {
      requirePhase(session, command, 'CHALLENGE_PREVIEW');
      if (!session.gameConfig.allowSongReroll || !session.roundConfig.allowRuntimeReroll) {
        throw new GameRuleError('TURN_NOT_READY', 'Challenge rerolls are disabled');
      }
      const rejectedChallengeId = session.activeChallenge?.reference.challengeId;
      if (!rejectedChallengeId) {
        throw new GameRuleError('CHALLENGE_REQUIRED', 'There is no challenge to reroll');
      }
      return transition(
        {
          ...session,
          activeChallenge: undefined,
          rejectedChallengeIds: session.rejectedChallengeIds.includes(rejectedChallengeId)
            ? session.rejectedChallengeIds
            : [...session.rejectedChallengeIds, rejectedChallengeId],
        },
        'CHALLENGE_SELECTION',
        command,
        [
          {
            ...eventBase(command),
            type: 'CHALLENGE_REROLL_REQUESTED',
            rejectedChallengeId,
          },
        ],
      );
    }
    case 'CONFIRM_CHALLENGE': {
      requirePhase(session, command, 'CHALLENGE_PREVIEW');
      const activeChallenge = session.activeChallenge;
      if (!activeChallenge) {
        throw new GameRuleError('CHALLENGE_REQUIRED', 'Select a challenge before confirming it');
      }
      let updated = session;
      if (!session.activeTurn?.challengeReference) {
        const assignment = findCurrentAssignment(session);
        updated = confirmChallenge(session, {
          assignmentRecordId: assignment.id,
          assignmentMode: assignment.assignmentMode,
          challengeReference: activeChallenge.reference,
          confirmedAt: command.issuedAt,
        });
      }
      return transition(updated, 'VIDEO_LOADING', command, [
        {
          ...eventBase(command),
          type: 'VIDEO_LOAD_REQUESTED',
          challenge: activeChallenge.reference,
        },
      ]);
    }
    case 'MARK_VIDEO_READY':
      requirePhase(session, command, 'VIDEO_LOADING');
      return transition(session, 'VIDEO_READY', command);
    case 'PLAY_VIDEO':
      requirePhase(session, command, 'VIDEO_READY');
      return transition(session, 'VIDEO_PLAYING', command, [
        { ...eventBase(command), type: 'VIDEO_PLAY_REQUESTED', purpose: 'CHALLENGE' },
      ]);
    case 'MARK_VIDEO_PAUSED': {
      requirePhase(session, command, 'VIDEO_PLAYING');
      const turn = getTurn(session);
      if (!turn.primaryAttempt) {
        throw new GameRuleError('TURN_NOT_READY', 'Primary attempt is missing');
      }
      const updated = {
        ...session,
        activeTurn: {
          ...turn,
          primaryAttempt: {
            ...turn.primaryAttempt,
            timer: startTimer(turn.primaryAttempt.timer, command.issuedAt),
          },
        },
      };
      return transition(updated, 'PRIMARY_ANSWERING', command, [
        { ...eventBase(command), type: 'SUSPENSE_START_REQUESTED' },
        {
          ...eventBase(command),
          type: 'TIMER_ACTION_REQUESTED',
          action: 'START',
          attemptId: turn.primaryAttempt.id,
        },
      ]);
    }
    case 'USE_LIFELINE': {
      requirePhase(session, command, 'PRIMARY_ANSWERING', 'STEAL_ANSWERING');
      let result: ReturnType<typeof applyLifeline>;
      try {
        result = applyLifeline(session, {
          teamId: command.teamId,
          type: command.lifelineType,
          usageId: command.usageId,
          usedAt: command.issuedAt,
          confirmPaidUse: command.confirmPaidUse,
        });
      } catch (error) {
        if (
          error instanceof GameRuleError &&
          error.code === 'PAID_LIFELINE_CONFIRMATION_REQUIRED'
        ) {
          return {
            session,
            events: [
              {
                ...eventBase(command),
                type: 'LIFELINE_CONFIRMATION_REQUESTED',
                teamId: command.teamId,
                lifelineType: command.lifelineType,
                penaltyPoints: session.gameConfig.additionalLifelinePenaltyPoints,
              },
            ],
          };
        }
        throw error;
      }
      const events: DomainEvent[] = [
        {
          ...eventBase(command),
          type: 'LIFELINE_USED',
          teamId: command.teamId,
          lifelineType: command.lifelineType,
          wasFree: result.usage.wasFree,
          penaltyPoints: result.usage.penaltyPoints,
        },
      ];
      if (command.lifelineType === 'HINT') {
        events.push({
          ...eventBase(command),
          type: 'HINT_DISPLAY_REQUESTED',
          teamId: command.teamId,
        });
      }
      return { session: result.session, events };
    }
    case 'CLASSIFY_PRIMARY': {
      requirePhase(session, command, 'PRIMARY_ANSWERING');
      let updated = classifyPrimaryAnswer(session, command.result, command.issuedAt);
      updated = completeAnsweringTimer(updated, command.issuedAt);
      return transition(updated, 'PRIMARY_RESULT_REVIEW', command, [
        {
          ...eventBase(command),
          type: 'TIMER_ACTION_REQUESTED',
          action: 'END',
          attemptId: getTurn(session).primaryAttempt!.id,
        },
      ]);
    }
    case 'CONFIRM_PRIMARY_RESULT': {
      requirePhase(session, command, 'PRIMARY_RESULT_REVIEW');
      const result = getTurn(session).primaryAttempt?.result;
      if (result === 'PERFECT') return beginVerification(session, command);
      if (result === 'MOSTLY_CORRECT' || result === 'WRONG') {
        return transition(session, 'STEAL_OFFER', command);
      }
      throw new GameRuleError('PRIMARY_RESULT_REQUIRED', 'A confirmed primary result is required');
    }
    case 'ACCEPT_STEAL': {
      requirePhase(session, command, 'STEAL_OFFER');
      let updated = startStealAttempt(session, {
        attemptId: command.stealAttemptId,
        startedAt: command.issuedAt,
      });
      const stealAttempt = updated.activeTurn?.stealAttempt;
      if (!stealAttempt) throw new GameRuleError('STEAL_REQUIRED', 'Steal attempt is missing');
      updated = {
        ...updated,
        activeTurn: {
          ...updated.activeTurn!,
          stealAttempt: {
            ...stealAttempt,
            timer: startTimer(stealAttempt.timer, command.issuedAt),
          },
        },
      };
      return transition(updated, 'STEAL_ANSWERING', command, [
        {
          ...eventBase(command),
          type: 'TIMER_ACTION_REQUESTED',
          action: 'START',
          attemptId: stealAttempt.id,
        },
      ]);
    }
    case 'DECLINE_STEAL': {
      requirePhase(session, command, 'STEAL_OFFER');
      let updated = startStealAttempt(session, {
        attemptId: command.stealAttemptId,
        startedAt: command.issuedAt,
      });
      updated = classifyStealAnswer(updated, 'DECLINED', command.issuedAt);
      return beginVerification(updated, command);
    }
    case 'CLASSIFY_STEAL': {
      requirePhase(session, command, 'STEAL_ANSWERING');
      let updated = classifyStealAnswer(session, command.result, command.issuedAt);
      updated = completeAnsweringTimer(updated, command.issuedAt);
      return transition(updated, 'STEAL_RESULT_REVIEW', command, [
        {
          ...eventBase(command),
          type: 'TIMER_ACTION_REQUESTED',
          action: 'END',
          attemptId: getTurn(session).stealAttempt!.id,
        },
      ]);
    }
    case 'CONFIRM_STEAL_RESULT':
      requirePhase(session, command, 'STEAL_RESULT_REVIEW');
      if (!getTurn(session).stealAttempt?.hostClassificationConfirmed) {
        throw new GameRuleError('STEAL_REQUIRED', 'Resolve the steal before verification');
      }
      return beginVerification(session, command);
    case 'COMPLETE_VERIFICATION': {
      requirePhase(session, command, 'CHALLENGE_VERIFICATION');
      const updated = recommendTurnScore(session, command.issuedAt);
      const score = getTurn(updated).score;
      if (!score) throw new GameRuleError('SCORE_REQUIRED', 'Score recommendation is missing');
      return transition(updated, 'FINAL_SCORE_REVIEW', command, [
        { ...eventBase(command), type: 'VIDEO_PAUSE_REQUESTED' },
        { ...eventBase(command), type: 'SCORE_RECOMMENDED', score },
      ]);
    }
    case 'OVERRIDE_SCORE': {
      requirePhase(session, command, 'FINAL_SCORE_REVIEW');
      const updated = overrideTurnScore(session, {
        target: command.target,
        finalAwardedPoints: command.finalAwardedPoints,
        reason: command.reason,
        overriddenAt: command.issuedAt,
      });
      return { session: updated, events: [] };
    }
    case 'CONFIRM_SCORE': {
      requirePhase(session, command, 'FINAL_SCORE_REVIEW');
      const turnId = getTurn(session).id;
      const updated = applyTurnScore(session, command.issuedAt);
      return transition(updated, 'TURN_SUMMARY', command, [
        { ...eventBase(command), type: 'SCORE_CONFIRMED', turnId },
      ]);
    }
    case 'COMPLETE_TURN': {
      requirePhase(session, command, 'TURN_SUMMARY');
      const turn = getTurn(session);
      const completedDifficulty = session.currentDifficulty;
      let updated = completeTurn(session, command.issuedAt);
      const events: DomainEvent[] = [
        { ...eventBase(command), type: 'TURN_COMPLETED', turnId: turn.id },
      ];
      if (updated.status === 'COMPLETED') {
        events.push({ ...eventBase(command), type: 'GAME_COMPLETED', gameId: session.id });
        return transition(updated, 'GAME_SUMMARY', command, events);
      }
      if (updated.currentDifficulty !== completedDifficulty) {
        events.push({
          ...eventBase(command),
          type: 'LEVEL_COMPLETED',
          difficulty: completedDifficulty,
        });
        return transition(updated, 'LEVEL_SUMMARY', command, events);
      }
      if (!command.nextTurnId || !command.nextPrimaryAttemptId) {
        throw new GameRuleError(
          'TURN_NOT_READY',
          'Next-turn IDs are required after the first turn',
        );
      }
      const firstPlayingTeamId = updated.currentLevelState.firstPlayingTeamId;
      const nextTeam = updated.teams.find((team) => team.id !== firstPlayingTeamId);
      if (!nextTeam) throw new GameRuleError('INVALID_TEAM', 'Next primary team is missing');
      updated = startPrimaryTurn(updated, {
        teamId: nextTeam.id,
        turnId: command.nextTurnId,
        attemptId: command.nextPrimaryAttemptId,
        startedAt: command.issuedAt,
      });
      return transition(updated, 'CATEGORY_ASSIGNMENT', command, events);
    }
    case 'START_NEXT_LEVEL':
      requirePhase(session, command, 'LEVEL_SUMMARY');
      return transition(session, 'LEVEL_INTRO', command);
    case 'PAUSE_TIMER':
    case 'RESUME_TIMER':
    case 'RESTART_TIMER':
    case 'ADJUST_TIMER':
    case 'DISABLE_TIMER':
    case 'END_TIMER':
      return timerCommand(session, command);
    case 'TIMER_EXPIRED': {
      requirePhase(session, command, 'PRIMARY_ANSWERING', 'STEAL_ANSWERING');
      const attempt = getAttemptForAnsweringPhase(session);
      const updated = replaceAnsweringAttempt(session, (current) => ({
        ...current,
        timer: { ...current.timer, status: 'EXPIRED', expiredAt: command.issuedAt },
      }));
      return {
        session: { ...updated, updatedAt: command.issuedAt },
        events: [{ ...eventBase(command), type: 'TIMER_EXPIRED', attemptId: attempt.id }],
      };
    }
    case 'ENTER_RECOVERY': {
      if (session.phase === 'RECOVERY' || session.phase === 'GAME_SUMMARY') {
        throw new CommandTransitionError(`Recovery cannot begin during ${session.phase}`);
      }
      const previousPhase = session.phase;
      const safePhase = getSafeRecoveryPhase(previousPhase);
      const paused = pauseActiveTimersForRecovery(session, command.issuedAt);
      return transition(
        {
          ...paused,
          recovery: {
            previousPhase,
            safePhase,
            reason: command.reason,
            recoveredAt: command.issuedAt,
          },
        },
        'RECOVERY',
        command,
        [
          { ...eventBase(command), type: 'VIDEO_PAUSE_REQUESTED' },
          { ...eventBase(command), type: 'SUSPENSE_STOP_REQUESTED' },
          { ...eventBase(command), type: 'RECOVERY_ENTERED', previousPhase, safePhase },
        ],
      );
    }
    case 'RESUME_FROM_RECOVERY': {
      requirePhase(session, command, 'RECOVERY');
      const safePhase = session.recovery?.safePhase;
      if (!safePhase || safePhase === 'RECOVERY') {
        throw new CommandTransitionError('Recovery metadata does not contain a safe phase');
      }
      return transition(session, safePhase, command, [
        { ...eventBase(command), type: 'RECOVERY_RESUMED', safePhase },
      ]);
    }
  }
}

function rejected(
  session: GameSession,
  command: GameCommand,
  failure: Omit<CommandFailure, 'commandId' | 'commandType' | 'phase'>,
): CommandResult {
  return {
    ok: false,
    session,
    events: [],
    failure: {
      ...failure,
      commandId: command.commandId,
      commandType: command.type,
      phase: session.phase,
    },
  };
}

export function processGameCommand(session: GameSession, command: GameCommand): CommandResult {
  if (!command.commandId.trim() || !command.issuedAt.trim()) {
    return rejected(session, command, {
      kind: 'GAME_RULE',
      code: 'INVALID_COMMAND',
      message: 'Commands require nonblank command IDs and timestamps',
      recoverable: true,
    });
  }
  if (session.processedCommandIds.includes(command.commandId)) {
    return rejected(session, command, {
      kind: 'DUPLICATE_COMMAND',
      code: 'DUPLICATE_COMMAND',
      message: `Command ${command.commandId} was already processed`,
      recoverable: true,
    });
  }

  try {
    const result = executeCommand(session, command);
    const processedCommandIds = [...result.session.processedCommandIds, command.commandId].slice(
      -MAX_PROCESSED_COMMAND_IDS,
    );
    const success: CommandSuccess = {
      ok: true,
      session: {
        ...result.session,
        processedCommandIds,
        updatedAt: command.issuedAt,
      },
      events: result.events,
    };
    return success;
  } catch (error) {
    if (error instanceof GameRuleError) {
      return rejected(session, command, {
        kind: 'GAME_RULE',
        code: error.code,
        message: error.message,
        recoverable: true,
      });
    }
    if (error instanceof CommandTransitionError) {
      return rejected(session, command, {
        kind: 'ILLEGAL_TRANSITION',
        code: 'ILLEGAL_PHASE',
        message: error.message,
        recoverable: true,
      });
    }
    throw error;
  }
}

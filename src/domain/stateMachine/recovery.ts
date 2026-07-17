import type { GamePhase } from '../enums';
import type { ActiveTurn, GameSession } from '../models/game';
import type { AnswerAttempt } from '../models/attempt';

export const SAFE_RECOVERY_PHASES: Readonly<Record<GamePhase, GamePhase>> = {
  GAME_SETUP: 'GAME_SETUP',
  ROUND_BUILDING: 'ROUND_BUILDING',
  ROUND_VALIDATION: 'ROUND_VALIDATION',
  LEVEL_INTRO: 'LEVEL_INTRO',
  TRIVIA_RESULT_ENTRY: 'TRIVIA_RESULT_ENTRY',
  TURN_ORDER_CONFIRMATION: 'TURN_ORDER_CONFIRMATION',
  CATEGORY_ASSIGNMENT: 'CATEGORY_ASSIGNMENT',
  CHALLENGE_SELECTION: 'CHALLENGE_SELECTION',
  CHALLENGE_PREVIEW: 'CHALLENGE_PREVIEW',
  VIDEO_LOADING: 'VIDEO_READY',
  VIDEO_READY: 'VIDEO_READY',
  VIDEO_PLAYING: 'VIDEO_READY',
  PRIMARY_ANSWERING: 'PRIMARY_ANSWERING',
  PRIMARY_RESULT_REVIEW: 'PRIMARY_RESULT_REVIEW',
  STEAL_OFFER: 'STEAL_OFFER',
  STEAL_ANSWERING: 'STEAL_ANSWERING',
  STEAL_RESULT_REVIEW: 'STEAL_RESULT_REVIEW',
  CHALLENGE_VERIFICATION: 'CHALLENGE_VERIFICATION',
  FINAL_SCORE_REVIEW: 'FINAL_SCORE_REVIEW',
  TURN_SUMMARY: 'TURN_SUMMARY',
  LEVEL_SUMMARY: 'LEVEL_SUMMARY',
  GAME_SUMMARY: 'GAME_SUMMARY',
  RECOVERY: 'RECOVERY',
  ERROR: 'GAME_SETUP',
};

export function getSafeRecoveryPhase(phase: GamePhase): GamePhase {
  return SAFE_RECOVERY_PHASES[phase];
}

function pauseAttempt(
  attempt: AnswerAttempt | undefined,
  pausedAt: string,
): AnswerAttempt | undefined {
  if (attempt?.timer.status !== 'RUNNING') return attempt;

  return {
    ...attempt,
    timer: {
      ...attempt.timer,
      status: 'PAUSED',
      pauseHistory: [
        ...attempt.timer.pauseHistory,
        {
          pausedAt,
          remainingMilliseconds: attempt.timer.remainingMilliseconds,
        },
      ],
    },
  };
}

export function pauseActiveTimersForRecovery(
  session: GameSession,
  recoveredAt: string,
): GameSession {
  const turn = session.activeTurn;
  if (!turn) return session;

  const updatedTurn: ActiveTurn = {
    ...turn,
    primaryAttempt: pauseAttempt(turn.primaryAttempt, recoveredAt),
    stealAttempt: pauseAttempt(turn.stealAttempt, recoveredAt),
  };

  return { ...session, activeTurn: updatedTurn };
}

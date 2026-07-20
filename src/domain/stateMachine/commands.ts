import type { AnswerResult, CategoryAssignmentMode, LifelineType } from '../enums';
import type { ActiveChallenge } from '../models/game';

interface CommandBase {
  commandId: string;
  issuedAt: string;
}

export type GameCommand =
  | (CommandBase & { type: 'ENTER_ROUND_BUILDING' })
  | (CommandBase & { type: 'VALIDATE_ROUND' })
  | (CommandBase & { type: 'START_GAME' })
  | (CommandBase & { type: 'BEGIN_TRIVIA' })
  | (CommandBase & { type: 'RECORD_TRIVIA_WINNER'; teamId: string })
  | (CommandBase & {
      type: 'CONFIRM_TURN_ORDER';
      firstPlayingTeamId: string;
      turnId: string;
      primaryAttemptId: string;
    })
  | (CommandBase & {
      type: 'ASSIGN_CATEGORY';
      categoryId: string;
      assignmentRecordId: string;
      assignmentMode: CategoryAssignmentMode;
    })
  | (CommandBase & { type: 'SELECT_CHALLENGE'; activeChallenge: ActiveChallenge })
  | (CommandBase & { type: 'REROLL_CHALLENGE' })
  | (CommandBase & { type: 'CONFIRM_CHALLENGE' })
  | (CommandBase & { type: 'MARK_VIDEO_READY' })
  | (CommandBase & { type: 'PLAY_VIDEO' })
  | (CommandBase & { type: 'MARK_VIDEO_PAUSED' })
  | (CommandBase & {
      type: 'USE_LIFELINE';
      teamId: string;
      lifelineType: LifelineType;
      usageId: string;
      confirmPaidUse?: boolean | undefined;
    })
  | (CommandBase & { type: 'CLASSIFY_PRIMARY'; result: AnswerResult })
  | (CommandBase & { type: 'CONFIRM_PRIMARY_RESULT' })
  | (CommandBase & { type: 'ACCEPT_STEAL'; stealAttemptId: string })
  | (CommandBase & { type: 'DECLINE_STEAL'; stealAttemptId: string })
  | (CommandBase & { type: 'CLASSIFY_STEAL'; result: AnswerResult })
  | (CommandBase & { type: 'CONFIRM_STEAL_RESULT' })
  | (CommandBase & { type: 'COMPLETE_VERIFICATION' })
  | (CommandBase & {
      type: 'OVERRIDE_SCORE';
      target: 'PRIMARY' | 'STEAL';
      finalAwardedPoints: number;
      reason?: string | undefined;
    })
  | (CommandBase & { type: 'CONFIRM_SCORE' })
  | (CommandBase & {
      type: 'COMPLETE_TURN';
      nextTurnId?: string | undefined;
      nextPrimaryAttemptId?: string | undefined;
    })
  | (CommandBase & { type: 'START_NEXT_LEVEL' })
  | (CommandBase & { type: 'FINISH_GAME' })
  | (CommandBase & { type: 'PAUSE_TIMER'; remainingMilliseconds: number })
  | (CommandBase & { type: 'RESUME_TIMER' })
  | (CommandBase & { type: 'RESTART_TIMER' })
  | (CommandBase & {
      type: 'ADJUST_TIMER';
      adjustmentId: string;
      deltaMilliseconds: number;
      reason?: string | undefined;
    })
  | (CommandBase & { type: 'DISABLE_TIMER' })
  | (CommandBase & { type: 'END_TIMER' })
  | (CommandBase & { type: 'TIMER_EXPIRED' })
  | (CommandBase & { type: 'ENTER_RECOVERY'; reason: string })
  | (CommandBase & { type: 'RESUME_FROM_RECOVERY' });

export type GameCommandType = GameCommand['type'];

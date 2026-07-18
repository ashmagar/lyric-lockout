import type { LifelineType } from '../enums';
import type { LifelineUsage } from '../models/attempt';
import type { ActiveTurn, GameSession } from '../models/game';
import { GameRuleError } from './errors';
import { getTeam, replaceTeam } from './sessionHelpers';

export interface UseLifelineInput {
  teamId: string;
  type: LifelineType;
  usageId: string;
  usedAt: string;
  confirmPaidUse?: boolean | undefined;
}

export interface UseLifelineResult {
  session: GameSession;
  usage: LifelineUsage;
}

export function useLifeline(session: GameSession, input: UseLifelineInput): UseLifelineResult {
  const turn = session.activeTurn;
  if (!turn) {
    throw new GameRuleError('NO_ACTIVE_TURN', 'A lifeline requires an active turn');
  }

  const isPrimaryAttempt = input.teamId === turn.primaryTeamId;
  const isStealAttempt = input.teamId === turn.opposingTeamId && turn.stealAttempt !== undefined;

  if (!isPrimaryAttempt && !isStealAttempt) {
    throw new GameRuleError('LIFELINE_NOT_AVAILABLE', 'The team has no active answer attempt');
  }
  if (isStealAttempt && !session.gameConfig.allowLifelinesDuringSteal) {
    throw new GameRuleError(
      'LIFELINE_DURING_STEAL_DISABLED',
      'Lifelines are disabled during steal attempts',
    );
  }

  const attempt = isPrimaryAttempt ? turn.primaryAttempt : turn.stealAttempt;
  if (!attempt) {
    throw new GameRuleError('LIFELINE_NOT_AVAILABLE', 'The team has no active answer attempt');
  }
  if (attempt.hostClassificationConfirmed) {
    throw new GameRuleError(
      'LIFELINE_AFTER_CLASSIFICATION',
      'Lifelines cannot be used after answer classification',
    );
  }

  const team = getTeam(session, input.teamId);
  const currentUseCount =
    input.type === 'HINT' ? team.lifelines.hintUseCount : team.lifelines.teamHuddleUseCount;
  const freeUseCount =
    input.type === 'HINT'
      ? session.gameConfig.freeHintUsesPerTeam
      : session.gameConfig.freeTeamHuddleUsesPerTeam;
  const usageNumber = currentUseCount + 1;
  const wasFree = usageNumber <= freeUseCount;

  if (!wasFree && input.confirmPaidUse !== true) {
    throw new GameRuleError(
      'PAID_LIFELINE_CONFIRMATION_REQUIRED',
      'Additional lifeline use requires host confirmation',
    );
  }

  const usage: LifelineUsage = {
    id: input.usageId,
    teamId: input.teamId,
    attemptId: attempt.id,
    type: input.type,
    usageNumber,
    wasFree,
    penaltyPoints: wasFree ? 0 : session.gameConfig.additionalLifelinePenaltyPoints,
    usedAt: input.usedAt,
  };

  const sessionWithTeam = replaceTeam(session, input.teamId, (currentTeam) => ({
    ...currentTeam,
    lifelines: {
      ...currentTeam.lifelines,
      ...(input.type === 'HINT'
        ? { hintUseCount: usageNumber }
        : { teamHuddleUseCount: usageNumber }),
    },
  }));

  const updatedAttempt = {
    ...attempt,
    lifelinesUsed: [...attempt.lifelinesUsed, usage],
  };
  const updatedTurn: ActiveTurn = isPrimaryAttempt
    ? { ...turn, primaryAttempt: updatedAttempt }
    : { ...turn, stealAttempt: updatedAttempt };

  return {
    session: {
      ...sessionWithTeam,
      activeTurn: updatedTurn,
      updatedAt: input.usedAt,
    },
    usage,
  };
}

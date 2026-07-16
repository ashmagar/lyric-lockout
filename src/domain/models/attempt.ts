import type { AnswerResult, AttemptType, LifelineType } from '../enums';
import type { ChallengeTimerState } from './timer';

export interface LifelineUsage {
  id: string;
  teamId: string;
  attemptId: string;
  type: LifelineType;
  usageNumber: number;
  wasFree: boolean;
  penaltyPoints: number;
  usedAt: string;
}

export interface AnswerAttempt {
  id: string;
  teamId: string;
  attemptType: AttemptType;
  result?: AnswerResult | undefined;
  startedAt: string;
  completedAt?: string | undefined;
  timer: ChallengeTimerState;
  lifelinesUsed: LifelineUsage[];
  hostClassificationConfirmed: boolean;
}

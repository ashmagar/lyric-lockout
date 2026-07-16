import type { TimerStatus } from '../enums';

export interface TimerPauseRecord {
  pausedAt: string;
  resumedAt?: string | undefined;
  remainingMilliseconds: number;
}

export interface TimerAdjustment {
  id: string;
  deltaMilliseconds: number;
  adjustedAt: string;
  reason?: string | undefined;
}

export interface ChallengeTimerState {
  configuredSeconds: number;
  remainingMilliseconds: number;
  status: TimerStatus;
  startedAt?: string | undefined;
  lastResumedAt?: string | undefined;
  expiredAt?: string | undefined;
  completedAt?: string | undefined;
  pauseHistory: TimerPauseRecord[];
  adjustments: TimerAdjustment[];
}

import { z } from 'zod';

import type {
  ChallengeTimerState,
  TimerAdjustment,
  TimerPauseRecord,
} from '../domain/models/timer';
import {
  idSchema,
  nonBlankStringSchema,
  nonNegativeIntegerSchema,
  timerStatusSchema,
  timestampSchema,
} from './common';

export const timerPauseRecordSchema: z.ZodType<TimerPauseRecord> = z.object({
  pausedAt: timestampSchema,
  resumedAt: timestampSchema.optional(),
  remainingMilliseconds: nonNegativeIntegerSchema,
});

export const timerAdjustmentSchema: z.ZodType<TimerAdjustment> = z.object({
  id: idSchema,
  deltaMilliseconds: z.number().int(),
  adjustedAt: timestampSchema,
  reason: nonBlankStringSchema.optional(),
});

export const challengeTimerStateSchema: z.ZodType<ChallengeTimerState> = z.object({
  configuredSeconds: nonNegativeIntegerSchema,
  remainingMilliseconds: nonNegativeIntegerSchema,
  status: timerStatusSchema,
  startedAt: timestampSchema.optional(),
  lastResumedAt: timestampSchema.optional(),
  expiredAt: timestampSchema.optional(),
  completedAt: timestampSchema.optional(),
  pauseHistory: z.array(timerPauseRecordSchema),
  adjustments: z.array(timerAdjustmentSchema),
});

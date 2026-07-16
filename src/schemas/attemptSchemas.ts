import { z } from 'zod';

import type { AnswerAttempt, LifelineUsage } from '../domain/models/attempt';
import {
  answerResultSchema,
  attemptTypeSchema,
  idSchema,
  lifelineTypeSchema,
  nonNegativeIntegerSchema,
  timestampSchema,
} from './common';
import { challengeTimerStateSchema } from './timerSchemas';

export const lifelineUsageSchema: z.ZodType<LifelineUsage> = z.object({
  id: idSchema,
  teamId: idSchema,
  attemptId: idSchema,
  type: lifelineTypeSchema,
  usageNumber: z.number().int().positive(),
  wasFree: z.boolean(),
  penaltyPoints: nonNegativeIntegerSchema,
  usedAt: timestampSchema,
});

export const answerAttemptSchema: z.ZodType<AnswerAttempt> = z.object({
  id: idSchema,
  teamId: idSchema,
  attemptType: attemptTypeSchema,
  result: answerResultSchema.optional(),
  startedAt: timestampSchema,
  completedAt: timestampSchema.optional(),
  timer: challengeTimerStateSchema,
  lifelinesUsed: z.array(lifelineUsageSchema),
  hostClassificationConfirmed: z.boolean(),
});

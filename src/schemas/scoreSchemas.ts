import { z } from 'zod';

import type { ScoreBreakdown, TurnScore } from '../domain/models/score';
import { nonBlankStringSchema, nonNegativeIntegerSchema } from './common';

export const scoreBreakdownSchema: z.ZodType<ScoreBreakdown> = z.object({
  fullChallengePoints: nonNegativeIntegerSchema,
  baseAllocatedPoints: nonNegativeIntegerSchema,
  lifelinePenaltyPoints: nonNegativeIntegerSchema,
  hostAdjustmentPoints: z.number().int(),
  recommendedPoints: nonNegativeIntegerSchema,
  finalAwardedPoints: z.number().int(),
  overridden: z.boolean(),
  overrideReason: nonBlankStringSchema.optional(),
});

export const turnScoreSchema: z.ZodType<TurnScore> = z.object({
  primary: scoreBreakdownSchema,
  steal: scoreBreakdownSchema.optional(),
});

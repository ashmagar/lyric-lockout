import { z } from 'zod';

import type { TeamLifelineState, TeamState } from '../domain/models/team';
import { idSchema, nonBlankStringSchema, nonNegativeIntegerSchema } from './common';

export const teamLifelineStateSchema: z.ZodType<TeamLifelineState> = z.object({
  hintUseCount: nonNegativeIntegerSchema,
  teamHuddleUseCount: nonNegativeIntegerSchema,
});

export const teamStateSchema: z.ZodType<TeamState> = z.object({
  id: idSchema,
  name: nonBlankStringSchema,
  score: z.number().int(),
  lifelines: teamLifelineStateSchema,
  primaryChallengeCount: nonNegativeIntegerSchema,
  stealAttemptCount: nonNegativeIntegerSchema,
  correctPrimaryCount: nonNegativeIntegerSchema,
  mostlyCorrectPrimaryCount: nonNegativeIntegerSchema,
  wrongPrimaryCount: nonNegativeIntegerSchema,
  successfulStealCount: nonNegativeIntegerSchema,
});

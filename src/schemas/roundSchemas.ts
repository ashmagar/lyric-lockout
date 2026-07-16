import { z } from 'zod';

import type { ManualChallengePool, RoundCreationConfig } from '../domain/models/round';
import { idSchema, selectionModeSchema, songSelectionModeSchema, uniqueValues } from './common';

const challengeIdListSchema = z.array(idSchema);

const approvedChallengeIdsByDifficultySchema: z.ZodType<
  ManualChallengePool['approvedChallengeIdsByDifficulty']
> = z.object({
  1: challengeIdListSchema.optional(),
  2: challengeIdListSchema.optional(),
  3: challengeIdListSchema.optional(),
  4: challengeIdListSchema.optional(),
  5: challengeIdListSchema.optional(),
});

export const manualChallengePoolSchema: z.ZodType<ManualChallengePool> = z.object({
  categoryId: idSchema,
  approvedChallengeIdsByDifficulty: approvedChallengeIdsByDifficultySchema,
});

export const roundCreationConfigSchema: z.ZodType<RoundCreationConfig> = z.object({
  categorySelectionMode: selectionModeSchema,
  songSelectionMode: songSelectionModeSchema,
  categoryCount: z.literal(10),
  difficultyLevels: z.tuple([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  selectedCategoryIds: z
    .array(idSchema)
    .max(10)
    .refine(uniqueValues, 'Selected category IDs must be unique'),
  manualChallengePools: z.array(manualChallengePoolSchema),
  preventChallengeReuse: z.boolean(),
  preventSongReuse: z.boolean(),
  allowRuntimeReroll: z.boolean(),
  randomSeed: z.string().trim().min(1).optional(),
});

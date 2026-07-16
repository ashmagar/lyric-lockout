import { z } from 'zod';

import { SCHEMA_VERSIONS } from '../domain/constants';
import type { GamePlan, GamePlanValidationIssue } from '../domain/models/gamePlan';
import {
  gamePlanStatusSchema,
  idSchema,
  nonBlankStringSchema,
  themeNameSchema,
  timestampSchema,
  validationIssueSeveritySchema,
} from './common';
import { gameConfigSchema } from './gameSchemas';
import { roundCreationConfigSchema } from './roundSchemas';

export const gamePlanValidationIssueSchema: z.ZodType<GamePlanValidationIssue> = z.object({
  code: nonBlankStringSchema,
  severity: validationIssueSeveritySchema,
  message: nonBlankStringSchema,
  path: nonBlankStringSchema.optional(),
});

export const gamePlanSchema: z.ZodType<GamePlan> = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.gamePlan),
  id: idSchema,
  name: nonBlankStringSchema,
  description: nonBlankStringSchema.optional(),
  status: gamePlanStatusSchema,
  roundConfig: roundCreationConfigSchema,
  gameConfig: gameConfigSchema,
  preferredTheme: themeNameSchema,
  revealSongBeforePlayback: z.boolean(),
  validationIssues: z.array(gamePlanValidationIssueSchema),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

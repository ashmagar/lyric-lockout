import { z } from 'zod';

import type { HostOverride } from '../domain/models/hostOverride';
import { hostOverrideTypeSchema, idSchema, nonBlankStringSchema, timestampSchema } from './common';

export const hostOverrideSchema: z.ZodType<HostOverride> = z.object({
  id: idSchema,
  type: hostOverrideTypeSchema,
  targetId: idSchema.optional(),
  previousValue: z.unknown().optional(),
  newValue: z.unknown(),
  reason: nonBlankStringSchema.optional(),
  createdAt: timestampSchema,
});

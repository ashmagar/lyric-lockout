import { z } from 'zod';

import { gamePlanSchema } from './gamePlanSchemas';

export const GAME_PLANS_ENVELOPE_VERSION = 2 as const;

export const gamePlansEnvelopeSchema = z.object({
  schemaVersion: z.literal(GAME_PLANS_ENVELOPE_VERSION),
  type: z.literal('GAME_PLANS'),
  savedAt: z.iso.datetime({ offset: true }),
  plans: z.array(gamePlanSchema),
});

export type GamePlansEnvelope = z.infer<typeof gamePlansEnvelopeSchema>;

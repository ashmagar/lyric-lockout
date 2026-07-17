import { z } from 'zod';

import { gameSessionSchema } from './gameSchemas';

export const ACTIVE_GAME_ENVELOPE_VERSION = 1 as const;
export const COMPLETED_GAME_SUMMARIES_ENVELOPE_VERSION = 1 as const;

export const activeGameEnvelopeSchema = z.object({
  schemaVersion: z.literal(ACTIVE_GAME_ENVELOPE_VERSION),
  type: z.literal('GAME_SESSION'),
  savedAt: z.string().datetime(),
  session: gameSessionSchema,
});

export const completedGameSummarySchema = z.object({
  schemaVersion: z.literal(1),
  gameId: z.string().min(1),
  completedAt: z.string().datetime(),
  teams: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        score: z.number().int(),
      }),
    )
    .min(2),
  winnerTeamIds: z.array(z.string().min(1)).min(1),
});

export const completedGameSummariesEnvelopeSchema = z.object({
  schemaVersion: z.literal(COMPLETED_GAME_SUMMARIES_ENVELOPE_VERSION),
  type: z.literal('COMPLETED_GAME_SUMMARIES'),
  savedAt: z.string().datetime(),
  summaries: z.array(completedGameSummarySchema),
});

export type ActiveGameEnvelope = z.infer<typeof activeGameEnvelopeSchema>;
export type CompletedGameSummary = z.infer<typeof completedGameSummarySchema>;
export type CompletedGameSummariesEnvelope = z.infer<typeof completedGameSummariesEnvelopeSchema>;

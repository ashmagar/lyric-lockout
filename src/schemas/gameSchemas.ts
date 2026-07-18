import { z } from 'zod';

import { SCHEMA_VERSIONS } from '../domain/constants';
import type {
  ActiveChallenge,
  ActiveTurn,
  CategorySelectionRecord,
  ChallengeReference,
  ChallengeSelectionRequest,
  GameConfig,
  GameError,
  GameSession,
  LevelResult,
  LevelState,
  RecoveryState,
  TeamLevelScore,
  TurnResult,
} from '../domain/models/game';
import { answerAttemptSchema } from './attemptSchemas';
import { categorySchema, challengeSchema, songSchema } from './catalogSchemas';
import {
  categoryAssignmentModeSchema,
  difficultyLevelSchema,
  gameErrorCategorySchema,
  gameErrorSeveritySchema,
  gamePhaseSchema,
  gameStatusSchema,
  idSchema,
  nonBlankStringSchema,
  nonNegativeIntegerSchema,
  songSelectionModeSchema,
  stealTimerModeSchema,
  timestampSchema,
} from './common';
import { roundCreationConfigSchema } from './roundSchemas';
import { scoreBreakdownSchema, turnScoreSchema } from './scoreSchemas';
import { teamStateSchema } from './teamSchemas';

const difficultyValueMapSchema = z.object({
  1: nonNegativeIntegerSchema,
  2: nonNegativeIntegerSchema,
  3: nonNegativeIntegerSchema,
  4: nonNegativeIntegerSchema,
  5: nonNegativeIntegerSchema,
});

export const gameConfigSchema: z.ZodType<GameConfig> = z.object({
  freeHintUsesPerTeam: nonNegativeIntegerSchema,
  freeTeamHuddleUsesPerTeam: nonNegativeIntegerSchema,
  additionalLifelinePenaltyPoints: nonNegativeIntegerSchema,
  fullPointsByDifficulty: difficultyValueMapSchema,
  answerSecondsByDifficulty: difficultyValueMapSchema,
  stealTimerMode: stealTimerModeSchema,
  stealTimerSeconds: nonNegativeIntegerSchema,
  allowLifelinesDuringSteal: z.boolean(),
  scoreFloorAtZero: z.boolean(),
  allowHostScoreOverride: z.boolean(),
  allowHostTimerOverride: z.boolean(),
  allowSongReroll: z.boolean(),
  revealSongBeforePlayback: z.boolean(),
});

export const challengeReferenceSchema: z.ZodType<ChallengeReference> = z.object({
  songId: idSchema,
  challengeId: idSchema,
  categoryId: idSchema,
  difficulty: difficultyLevelSchema,
});

export const challengeSelectionRequestSchema: z.ZodType<ChallengeSelectionRequest> = z.object({
  categoryId: idSchema,
  difficulty: difficultyLevelSchema,
  songSelectionMode: songSelectionModeSchema,
  approvedChallengeIds: z.array(idSchema).optional(),
  excludedChallengeIds: z.array(idSchema),
  excludedSongIds: z.array(idSchema),
  allowSongReuseFallback: z.boolean(),
});

export const levelStateSchema: z.ZodType<LevelState> = z.object({
  difficulty: difficultyLevelSchema,
  triviaWinnerTeamId: idSchema.optional(),
  firstPlayingTeamId: idSchema.optional(),
  primaryTurnsCompleted: z.number().int().min(0).max(2),
});

export const categorySelectionRecordSchema: z.ZodType<CategorySelectionRecord> = z.object({
  id: idSchema,
  categoryId: idSchema,
  difficulty: difficultyLevelSchema,
  teamId: idSchema,
  assignmentMode: categoryAssignmentModeSchema,
  selectedAt: timestampSchema,
});

export const activeChallengeSchema: z.ZodType<ActiveChallenge> = z.object({
  reference: challengeReferenceSchema,
  song: songSchema,
  category: categorySchema,
  challenge: challengeSchema,
  selectedAt: timestampSchema,
});

export const activeTurnSchema: z.ZodType<ActiveTurn> = z.object({
  id: idSchema,
  difficulty: difficultyLevelSchema,
  primaryTeamId: idSchema,
  opposingTeamId: idSchema,
  categoryId: idSchema.optional(),
  challengeReference: challengeReferenceSchema.optional(),
  primaryAttempt: answerAttemptSchema.optional(),
  stealAttempt: answerAttemptSchema.optional(),
  score: turnScoreSchema.optional(),
  scoreApplied: z.boolean(),
  startedAt: timestampSchema,
});

export const turnResultSchema: z.ZodType<TurnResult> = z.object({
  turnId: idSchema,
  difficulty: difficultyLevelSchema,
  categoryId: idSchema,
  challenge: challengeReferenceSchema,
  primaryAttempt: answerAttemptSchema,
  stealAttempt: answerAttemptSchema.optional(),
  primaryScore: scoreBreakdownSchema,
  stealScore: scoreBreakdownSchema.optional(),
  completedAt: timestampSchema,
});

export const teamLevelScoreSchema: z.ZodType<TeamLevelScore> = z.object({
  teamId: idSchema,
  pointsAwarded: z.number().int(),
});

export const levelResultSchema: z.ZodType<LevelResult> = z.object({
  difficulty: difficultyLevelSchema,
  turnIds: z.tuple([idSchema, idSchema]),
  teamScores: z.tuple([teamLevelScoreSchema, teamLevelScoreSchema]),
  completedAt: timestampSchema,
});

export const recoveryStateSchema: z.ZodType<RecoveryState> = z.object({
  previousPhase: gamePhaseSchema,
  safePhase: gamePhaseSchema,
  reason: nonBlankStringSchema,
  recoveredAt: timestampSchema,
});

export const gameErrorSchema: z.ZodType<GameError> = z.object({
  category: gameErrorCategorySchema,
  severity: gameErrorSeveritySchema,
  code: nonBlankStringSchema,
  message: nonBlankStringSchema,
  recoverable: z.boolean(),
  occurredAt: timestampSchema,
});

export const gameSessionSchema: z.ZodType<GameSession> = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.gameSession),
  id: idSchema,
  status: gameStatusSchema,
  phase: gamePhaseSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  startedAt: timestampSchema.optional(),
  completedAt: timestampSchema.optional(),
  roundConfig: roundCreationConfigSchema,
  gameConfig: gameConfigSchema,
  teams: z.tuple([teamStateSchema, teamStateSchema]),
  currentDifficulty: difficultyLevelSchema,
  currentLevelState: levelStateSchema,
  consumedCategoryIds: z.array(idSchema),
  categoryHistory: z.array(categorySelectionRecordSchema),
  playedSongIds: z.array(idSchema),
  playedChallengeIds: z.array(idSchema),
  rejectedChallengeIds: z.array(idSchema),
  activeTurn: activeTurnSchema.optional(),
  activeChallenge: activeChallengeSchema.optional(),
  turnHistory: z.array(turnResultSchema),
  levelHistory: z.array(levelResultSchema),
  processedCommandIds: z.array(idSchema),
  recovery: recoveryStateSchema.optional(),
  error: gameErrorSchema.optional(),
});

import { z } from 'zod';

import {
  ANSWER_RESULTS,
  ATTEMPT_TYPES,
  CATEGORY_ASSIGNMENT_MODES,
  GAME_ERROR_CATEGORIES,
  GAME_ERROR_SEVERITIES,
  GAME_PHASES,
  GAME_PLAN_STATUSES,
  GAME_STATUSES,
  HOST_OVERRIDE_TYPES,
  LIFELINE_TYPES,
  SELECTION_MODES,
  SONG_SELECTION_MODES,
  STEAL_TIMER_MODES,
  THEME_NAMES,
  TIMER_STATUSES,
  VALIDATION_ISSUE_SEVERITIES,
  VIDEO_TYPES,
} from '../domain/enums';

export const idSchema = z.string().trim().min(1, 'ID must not be blank');
export const nonBlankStringSchema = z.string().trim().min(1, 'Value must not be blank');
export const timestampSchema = z.iso.datetime({ offset: true });
export const nonNegativeIntegerSchema = z.number().int().nonnegative();

export const difficultyLevelSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const gameStatusSchema = z.enum(GAME_STATUSES);
export const gamePhaseSchema = z.enum(GAME_PHASES);
export const answerResultSchema = z.enum(ANSWER_RESULTS);
export const attemptTypeSchema = z.enum(ATTEMPT_TYPES);
export const lifelineTypeSchema = z.enum(LIFELINE_TYPES);
export const selectionModeSchema = z.enum(SELECTION_MODES);
export const songSelectionModeSchema = z.enum(SONG_SELECTION_MODES);
export const themeNameSchema = z.enum(THEME_NAMES);
export const videoTypeSchema = z.enum(VIDEO_TYPES);
export const stealTimerModeSchema = z.enum(STEAL_TIMER_MODES);
export const timerStatusSchema = z.enum(TIMER_STATUSES);
export const hostOverrideTypeSchema = z.enum(HOST_OVERRIDE_TYPES);
export const categoryAssignmentModeSchema = z.enum(CATEGORY_ASSIGNMENT_MODES);
export const gamePlanStatusSchema = z.enum(GAME_PLAN_STATUSES);
export const validationIssueSeveritySchema = z.enum(VALIDATION_ISSUE_SEVERITIES);
export const gameErrorCategorySchema = z.enum(GAME_ERROR_CATEGORIES);
export const gameErrorSeveritySchema = z.enum(GAME_ERROR_SEVERITIES);

export function uniqueValues<T>(values: T[]) {
  return new Set(values).size === values.length;
}

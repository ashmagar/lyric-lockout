export const DIFFICULTY_LEVELS = [1, 2, 3, 4, 5] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

export const GAME_STATUSES = ['DRAFT', 'READY', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED'] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

export const GAME_PHASES = [
  'GAME_SETUP',
  'ROUND_BUILDING',
  'ROUND_VALIDATION',
  'LEVEL_INTRO',
  'TRIVIA_RESULT_ENTRY',
  'TURN_ORDER_CONFIRMATION',
  'CATEGORY_ASSIGNMENT',
  'CHALLENGE_SELECTION',
  'CHALLENGE_PREVIEW',
  'VIDEO_LOADING',
  'VIDEO_READY',
  'VIDEO_PLAYING',
  'PRIMARY_ANSWERING',
  'PRIMARY_RESULT_REVIEW',
  'STEAL_OFFER',
  'STEAL_ANSWERING',
  'STEAL_RESULT_REVIEW',
  'CHALLENGE_VERIFICATION',
  'FINAL_SCORE_REVIEW',
  'TURN_SUMMARY',
  'LEVEL_SUMMARY',
  'GAME_SUMMARY',
  'RECOVERY',
  'ERROR',
] as const;
export type GamePhase = (typeof GAME_PHASES)[number];

export const ANSWER_RESULTS = ['PERFECT', 'MOSTLY_CORRECT', 'WRONG', 'DECLINED'] as const;
export type AnswerResult = (typeof ANSWER_RESULTS)[number];

export const ATTEMPT_TYPES = ['PRIMARY', 'STEAL'] as const;
export type AttemptType = (typeof ATTEMPT_TYPES)[number];

export const LIFELINE_TYPES = ['HINT', 'TEAM_HUDDLE'] as const;
export type LifelineType = (typeof LIFELINE_TYPES)[number];

export const SELECTION_MODES = ['RANDOM', 'MANUAL'] as const;
export type SelectionMode = (typeof SELECTION_MODES)[number];

export const SONG_SELECTION_MODES = ['FULL_CATALOG', 'CURATED_POOL'] as const;
export type SongSelectionMode = (typeof SONG_SELECTION_MODES)[number];

export const THEME_NAMES = ['DAY_PARTY', 'GAME_NIGHT'] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

export const VIDEO_TYPES = ['LYRIC', 'KARAOKE', 'OFFICIAL_VIDEO', 'OTHER'] as const;
export type VideoType = (typeof VIDEO_TYPES)[number];

export const STEAL_TIMER_MODES = [
  'FIXED',
  'REMAINING_PRIMARY_TIME',
  'FULL_LEVEL_TIME',
  'HOST_CONTROLLED',
] as const;
export type StealTimerMode = (typeof STEAL_TIMER_MODES)[number];

export const TIMER_STATUSES = [
  'IDLE',
  'RUNNING',
  'PAUSED',
  'EXPIRED',
  'DISABLED',
  'COMPLETED',
] as const;
export type TimerStatus = (typeof TIMER_STATUSES)[number];

export const HOST_OVERRIDE_TYPES = [
  'SCORE',
  'TIMER',
  'TURN_ORDER',
  'CATEGORY_ASSIGNMENT',
  'ANSWER_RESULT',
  'STEAL_RESULT',
  'LIFELINE_PENALTY',
  'CHALLENGE_SELECTION',
  'GAME_PHASE',
] as const;
export type HostOverrideType = (typeof HOST_OVERRIDE_TYPES)[number];

export const CATEGORY_ASSIGNMENT_MODES = [
  'SELF_SELECTED',
  'OPPONENT_ASSIGNED',
  'HOST_ASSIGNED',
] as const;
export type CategoryAssignmentMode = (typeof CATEGORY_ASSIGNMENT_MODES)[number];

export const GAME_PLAN_STATUSES = ['DRAFT', 'READY', 'READY_WITH_WARNINGS', 'INVALID'] as const;
export type GamePlanStatus = (typeof GAME_PLAN_STATUSES)[number];

export const VALIDATION_ISSUE_SEVERITIES = ['WARNING', 'ERROR'] as const;
export type ValidationIssueSeverity = (typeof VALIDATION_ISSUE_SEVERITIES)[number];

export const GAME_ERROR_CATEGORIES = [
  'VALIDATION',
  'GAME_RULE',
  'MEDIA',
  'AUDIO',
  'TIMER',
  'PERSISTENCE',
  'CATALOG',
  'ADMIN_API',
  'UNKNOWN',
] as const;
export type GameErrorCategory = (typeof GAME_ERROR_CATEGORIES)[number];

export const GAME_ERROR_SEVERITIES = ['INFO', 'WARNING', 'RECOVERABLE', 'FATAL'] as const;
export type GameErrorSeverity = (typeof GAME_ERROR_SEVERITIES)[number];

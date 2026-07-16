import type { DifficultyLevel, ThemeName } from './enums';
import type { GameConfig } from './models/game';

export const SCHEMA_VERSIONS = {
  category: 1,
  song: 1,
  gamePlan: 1,
  gameSession: 1,
  settings: 1,
} as const;

export const DEFAULT_THEME: ThemeName = 'DAY_PARTY';

export const DIFFICULTY_CONFIG: Readonly<
  Record<DifficultyLevel, { fullPoints: number; answerSeconds: number }>
> = {
  1: { fullPoints: 100, answerSeconds: 30 },
  2: { fullPoints: 200, answerSeconds: 45 },
  3: { fullPoints: 300, answerSeconds: 60 },
  4: { fullPoints: 400, answerSeconds: 90 },
  5: { fullPoints: 500, answerSeconds: 120 },
};

export const FREE_HINT_USES_PER_TEAM = 1;
export const FREE_ASK_FRIEND_USES_PER_TEAM = 1;
export const ADDITIONAL_LIFELINE_PENALTY_POINTS = 25;

export const DEFAULT_GAME_CONFIG: Readonly<GameConfig> = {
  freeHintUsesPerTeam: FREE_HINT_USES_PER_TEAM,
  freeAskFriendUsesPerTeam: FREE_ASK_FRIEND_USES_PER_TEAM,
  additionalLifelinePenaltyPoints: ADDITIONAL_LIFELINE_PENALTY_POINTS,
  fullPointsByDifficulty: {
    1: DIFFICULTY_CONFIG[1].fullPoints,
    2: DIFFICULTY_CONFIG[2].fullPoints,
    3: DIFFICULTY_CONFIG[3].fullPoints,
    4: DIFFICULTY_CONFIG[4].fullPoints,
    5: DIFFICULTY_CONFIG[5].fullPoints,
  },
  answerSecondsByDifficulty: {
    1: DIFFICULTY_CONFIG[1].answerSeconds,
    2: DIFFICULTY_CONFIG[2].answerSeconds,
    3: DIFFICULTY_CONFIG[3].answerSeconds,
    4: DIFFICULTY_CONFIG[4].answerSeconds,
    5: DIFFICULTY_CONFIG[5].answerSeconds,
  },
  stealTimerMode: 'FIXED',
  stealTimerSeconds: 30,
  allowLifelinesDuringSteal: false,
  scoreFloorAtZero: true,
  allowHostScoreOverride: true,
  allowHostTimerOverride: true,
  allowSongReroll: true,
  revealSongBeforePlayback: true,
};

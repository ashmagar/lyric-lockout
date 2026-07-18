import type {
  CategoryAssignmentMode,
  DifficultyLevel,
  GameErrorCategory,
  GameErrorSeverity,
  GamePhase,
  GameStatus,
  SongSelectionMode,
  StealTimerMode,
} from '../enums';
import type { AnswerAttempt } from './attempt';
import type { Category, Challenge, Song } from './catalog';
import type { RoundCreationConfig } from './round';
import type { ScoreBreakdown, TurnScore } from './score';
import type { TeamState } from './team';

export interface GameConfig {
  freeHintUsesPerTeam: number;
  freeTeamHuddleUsesPerTeam: number;
  additionalLifelinePenaltyPoints: number;
  fullPointsByDifficulty: Record<DifficultyLevel, number>;
  answerSecondsByDifficulty: Record<DifficultyLevel, number>;
  stealTimerMode: StealTimerMode;
  stealTimerSeconds: number;
  allowLifelinesDuringSteal: boolean;
  scoreFloorAtZero: boolean;
  allowHostScoreOverride: boolean;
  allowHostTimerOverride: boolean;
  allowSongReroll: boolean;
  revealSongBeforePlayback: boolean;
}

export interface ChallengeReference {
  songId: string;
  challengeId: string;
  categoryId: string;
  difficulty: DifficultyLevel;
}

export interface ChallengeSelectionRequest {
  categoryId: string;
  difficulty: DifficultyLevel;
  songSelectionMode: SongSelectionMode;
  approvedChallengeIds?: string[] | undefined;
  excludedChallengeIds: string[];
  excludedSongIds: string[];
  allowSongReuseFallback: boolean;
}

export interface LevelState {
  difficulty: DifficultyLevel;
  triviaWinnerTeamId?: string | undefined;
  firstPlayingTeamId?: string | undefined;
  primaryTurnsCompleted: number;
}

export interface CategorySelectionRecord {
  id: string;
  categoryId: string;
  difficulty: DifficultyLevel;
  teamId: string;
  assignmentMode: CategoryAssignmentMode;
  selectedAt: string;
}

export interface ActiveChallenge {
  reference: ChallengeReference;
  song: Song;
  category: Category;
  challenge: Challenge;
  selectedAt: string;
}

export interface ActiveTurn {
  id: string;
  difficulty: DifficultyLevel;
  primaryTeamId: string;
  opposingTeamId: string;
  categoryId?: string | undefined;
  challengeReference?: ChallengeReference | undefined;
  primaryAttempt?: AnswerAttempt | undefined;
  stealAttempt?: AnswerAttempt | undefined;
  score?: TurnScore | undefined;
  scoreApplied: boolean;
  startedAt: string;
}

export interface TurnResult {
  turnId: string;
  difficulty: DifficultyLevel;
  categoryId: string;
  challenge: ChallengeReference;
  primaryAttempt: AnswerAttempt;
  stealAttempt?: AnswerAttempt | undefined;
  primaryScore: ScoreBreakdown;
  stealScore?: ScoreBreakdown | undefined;
  completedAt: string;
}

export interface TeamLevelScore {
  teamId: string;
  pointsAwarded: number;
}

export interface LevelResult {
  difficulty: DifficultyLevel;
  turnIds: [string, string];
  teamScores: [TeamLevelScore, TeamLevelScore];
  completedAt: string;
}

export interface RecoveryState {
  previousPhase: GamePhase;
  safePhase: GamePhase;
  reason: string;
  recoveredAt: string;
}

export interface GameError {
  category: GameErrorCategory;
  severity: GameErrorSeverity;
  code: string;
  message: string;
  recoverable: boolean;
  occurredAt: string;
}

export interface GameSession {
  schemaVersion: number;
  id: string;
  status: GameStatus;
  phase: GamePhase;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | undefined;
  completedAt?: string | undefined;
  roundConfig: RoundCreationConfig;
  gameConfig: GameConfig;
  teams: [TeamState, TeamState];
  currentDifficulty: DifficultyLevel;
  currentLevelState: LevelState;
  consumedCategoryIds: string[];
  categoryHistory: CategorySelectionRecord[];
  playedSongIds: string[];
  playedChallengeIds: string[];
  rejectedChallengeIds: string[];
  activeTurn?: ActiveTurn | undefined;
  activeChallenge?: ActiveChallenge | undefined;
  turnHistory: TurnResult[];
  levelHistory: LevelResult[];
  processedCommandIds: string[];
  recovery?: RecoveryState | undefined;
  error?: GameError | undefined;
}

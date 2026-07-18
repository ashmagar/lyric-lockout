import { DEFAULT_GAME_CONFIG, SCHEMA_VERSIONS } from '../constants';
import type { AnswerResult, CategoryAssignmentMode, DifficultyLevel } from '../enums';
import type { AnswerAttempt } from '../models/attempt';
import type {
  ActiveTurn,
  CategorySelectionRecord,
  ChallengeReference,
  GameConfig,
  GameSession,
  LevelResult,
  TurnResult,
} from '../models/game';
import type { RoundCreationConfig } from '../models/round';
import type { ScoreBreakdown } from '../models/score';
import type { TeamState } from '../models/team';
import { GameRuleError } from './errors';
import type { RandomSource } from './random';
import { selectRandomItem } from './random';
import { calculateTurnScore, isStealEligible, type PrimaryAnswerResult } from './scoring';
import { getOpposingTeamId, getTeam, replaceTeam } from './sessionHelpers';

export interface TeamIdentity {
  id: string;
  name: string;
}

export interface CreateGameInput {
  id: string;
  createdAt: string;
  teams: readonly TeamIdentity[];
  roundConfig: RoundCreationConfig;
  gameConfig?: GameConfig | undefined;
}

export interface StartPrimaryTurnInput {
  teamId: string;
  turnId: string;
  attemptId: string;
  startedAt: string;
}

export interface ConfirmChallengeInput {
  assignmentRecordId: string;
  assignmentMode: CategoryAssignmentMode;
  challengeReference: ChallengeReference;
  confirmedAt: string;
}

export interface AssignCategoryInput {
  assignmentRecordId: string;
  assignmentMode: CategoryAssignmentMode;
  categoryId: string;
  assignedAt: string;
}

export interface StartStealInput {
  attemptId: string;
  startedAt: string;
}

export interface OverrideScoreInput {
  target: 'PRIMARY' | 'STEAL';
  finalAwardedPoints: number;
  reason?: string | undefined;
  overriddenAt: string;
}

function cloneRoundConfig(config: RoundCreationConfig): RoundCreationConfig {
  return {
    ...config,
    difficultyLevels: [...config.difficultyLevels],
    selectedCategoryIds: [...config.selectedCategoryIds],
    manualChallengePools: config.manualChallengePools.map((pool) => ({
      ...pool,
      approvedChallengeIdsByDifficulty: Object.fromEntries(
        Object.entries(pool.approvedChallengeIdsByDifficulty).map(([difficulty, ids]) => [
          difficulty,
          ids ? [...ids] : ids,
        ]),
      ),
    })),
  };
}

function cloneGameConfig(config: GameConfig): GameConfig {
  return {
    ...config,
    fullPointsByDifficulty: { ...config.fullPointsByDifficulty },
    answerSecondsByDifficulty: { ...config.answerSecondsByDifficulty },
  };
}

function createTeam(identity: TeamIdentity): TeamState {
  return {
    id: identity.id,
    name: identity.name.trim(),
    score: 0,
    lifelines: {
      hintUseCount: 0,
      teamHuddleUseCount: 0,
    },
    primaryChallengeCount: 0,
    stealAttemptCount: 0,
    correctPrimaryCount: 0,
    mostlyCorrectPrimaryCount: 0,
    wrongPrimaryCount: 0,
    successfulStealCount: 0,
  };
}

function createAttempt(
  id: string,
  teamId: string,
  attemptType: 'PRIMARY' | 'STEAL',
  configuredSeconds: number,
  startedAt: string,
): AnswerAttempt {
  return {
    id,
    teamId,
    attemptType,
    startedAt,
    timer: {
      configuredSeconds,
      remainingMilliseconds: configuredSeconds * 1000,
      status: 'IDLE',
      pauseHistory: [],
      adjustments: [],
    },
    lifelinesUsed: [],
    hostClassificationConfirmed: false,
  };
}

function assertGameInProgress(session: GameSession): void {
  if (session.status === 'COMPLETED') {
    throw new GameRuleError('GAME_ALREADY_COMPLETED', 'The game is already complete');
  }
}

function getActiveTurn(session: GameSession): ActiveTurn {
  if (!session.activeTurn) {
    throw new GameRuleError('NO_ACTIVE_TURN', 'This action requires an active turn');
  }

  return session.activeTurn;
}

function getPrimaryResult(turn: ActiveTurn): PrimaryAnswerResult {
  const result = turn.primaryAttempt?.result;
  if (!turn.primaryAttempt?.hostClassificationConfirmed || result === undefined) {
    throw new GameRuleError('PRIMARY_RESULT_REQUIRED', 'Primary classification is required');
  }
  if (result === 'DECLINED') {
    throw new GameRuleError('INVALID_PRIMARY_RESULT', 'A primary answer cannot be Declined');
  }

  return result;
}

function sumPenalties(attempt: AnswerAttempt | undefined): number {
  return attempt?.lifelinesUsed.reduce((total, usage) => total + usage.penaltyPoints, 0) ?? 0;
}

export function createGame(input: CreateGameInput): GameSession {
  if (input.teams.length !== 2) {
    throw new GameRuleError('INVALID_TEAM_COUNT', 'A game requires exactly two teams');
  }

  const [firstIdentity, secondIdentity] = input.teams;
  if (!firstIdentity || !secondIdentity) {
    throw new GameRuleError('INVALID_TEAM_COUNT', 'A game requires exactly two teams');
  }
  if (!firstIdentity.id.trim() || !firstIdentity.name.trim()) {
    throw new GameRuleError('INVALID_TEAM', 'Both teams require nonblank IDs and names');
  }
  if (!secondIdentity.id.trim() || !secondIdentity.name.trim()) {
    throw new GameRuleError('INVALID_TEAM', 'Both teams require nonblank IDs and names');
  }
  if (firstIdentity.id === secondIdentity.id) {
    throw new GameRuleError('DUPLICATE_TEAM_ID', 'Team IDs must be unique');
  }

  if (input.roundConfig.selectedCategoryIds.length !== 10) {
    throw new GameRuleError('INVALID_CATEGORY_COUNT', 'A game requires exactly ten categories');
  }
  if (new Set(input.roundConfig.selectedCategoryIds).size !== 10) {
    throw new GameRuleError('DUPLICATE_CATEGORY', 'The ten game categories must be unique');
  }

  return {
    schemaVersion: SCHEMA_VERSIONS.gameSession,
    id: input.id,
    status: 'IN_PROGRESS',
    phase: 'GAME_SETUP',
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    roundConfig: cloneRoundConfig(input.roundConfig),
    gameConfig: cloneGameConfig(input.gameConfig ?? DEFAULT_GAME_CONFIG),
    teams: [createTeam(firstIdentity), createTeam(secondIdentity)],
    currentDifficulty: 1,
    currentLevelState: {
      difficulty: 1,
      primaryTurnsCompleted: 0,
    },
    consumedCategoryIds: [],
    categoryHistory: [],
    playedSongIds: [],
    playedChallengeIds: [],
    rejectedChallengeIds: [],
    turnHistory: [],
    levelHistory: [],
    processedCommandIds: [],
  };
}

export function recordLevelOrder(
  session: GameSession,
  triviaWinnerTeamId: string,
  firstPlayingTeamId: string,
  recordedAt: string,
): GameSession {
  assertGameInProgress(session);
  getTeam(session, triviaWinnerTeamId);
  getTeam(session, firstPlayingTeamId);

  if (session.activeTurn || session.currentLevelState.primaryTurnsCompleted > 0) {
    throw new GameRuleError(
      'LEVEL_ALREADY_STARTED',
      'Trivia and first-playing team cannot change after the level starts',
    );
  }

  return {
    ...session,
    currentLevelState: {
      ...session.currentLevelState,
      triviaWinnerTeamId,
      firstPlayingTeamId,
    },
    updatedAt: recordedAt,
  };
}

export function startPrimaryTurn(session: GameSession, input: StartPrimaryTurnInput): GameSession {
  assertGameInProgress(session);
  if (session.activeTurn) {
    throw new GameRuleError('ACTIVE_TURN_EXISTS', 'Only one primary turn may be active');
  }

  const firstPlayingTeamId = session.currentLevelState.firstPlayingTeamId;
  if (!firstPlayingTeamId) {
    throw new GameRuleError('LEVEL_ORDER_REQUIRED', 'Record trivia and first-playing team first');
  }

  const completedTurns = session.currentLevelState.primaryTurnsCompleted;
  const expectedTeamId =
    completedTurns === 0 ? firstPlayingTeamId : getOpposingTeamId(session, firstPlayingTeamId);

  if (completedTurns > 1 || input.teamId !== expectedTeamId) {
    throw new GameRuleError(
      'UNEXPECTED_PRIMARY_TEAM',
      `Expected team "${expectedTeamId}" for this primary turn`,
    );
  }

  const opposingTeamId = getOpposingTeamId(session, input.teamId);
  const answerSeconds = session.gameConfig.answerSecondsByDifficulty[session.currentDifficulty];

  return {
    ...session,
    activeTurn: {
      id: input.turnId,
      difficulty: session.currentDifficulty,
      primaryTeamId: input.teamId,
      opposingTeamId,
      primaryAttempt: createAttempt(
        input.attemptId,
        input.teamId,
        'PRIMARY',
        answerSeconds,
        input.startedAt,
      ),
      scoreApplied: false,
      startedAt: input.startedAt,
    },
    updatedAt: input.startedAt,
  };
}

export function selectRandomAvailableCategory(session: GameSession, random: RandomSource): string {
  const available = session.roundConfig.selectedCategoryIds.filter(
    (categoryId) => !session.consumedCategoryIds.includes(categoryId),
  );
  return selectRandomItem(available, random);
}

export function getCategoryConsumptionRecord(
  session: GameSession,
  categoryId: string,
): CategorySelectionRecord | undefined {
  if (!session.consumedCategoryIds.includes(categoryId)) return undefined;
  for (let index = session.categoryHistory.length - 1; index >= 0; index -= 1) {
    const record = session.categoryHistory[index];
    if (record?.categoryId === categoryId) return record;
  }
  return undefined;
}

export function assignCategory(session: GameSession, input: AssignCategoryInput): GameSession {
  const turn = getActiveTurn(session);

  if (turn.categoryId || turn.challengeReference) {
    throw new GameRuleError('CATEGORY_ALREADY_CONFIRMED', 'This turn already has a category');
  }
  if (!session.roundConfig.selectedCategoryIds.includes(input.categoryId)) {
    throw new GameRuleError('CATEGORY_NOT_IN_ROUND', 'The category is not part of this game');
  }
  if (session.consumedCategoryIds.includes(input.categoryId)) {
    throw new GameRuleError('CATEGORY_ALREADY_CONSUMED', 'The category was already consumed');
  }

  return {
    ...session,
    activeTurn: { ...turn, categoryId: input.categoryId },
    categoryHistory: [
      ...session.categoryHistory,
      {
        id: input.assignmentRecordId,
        categoryId: input.categoryId,
        difficulty: session.currentDifficulty,
        teamId: turn.primaryTeamId,
        assignmentMode: input.assignmentMode,
        selectedAt: input.assignedAt,
      },
    ],
    updatedAt: input.assignedAt,
  };
}

export function confirmChallenge(session: GameSession, input: ConfirmChallengeInput): GameSession {
  const turn = getActiveTurn(session);
  const reference = input.challengeReference;

  if (turn.challengeReference) {
    throw new GameRuleError('CATEGORY_ALREADY_CONFIRMED', 'This turn already has a challenge');
  }
  if (turn.categoryId && turn.categoryId !== reference.categoryId) {
    throw new GameRuleError('CHALLENGE_MISMATCH', 'Challenge category does not match the turn');
  }
  if (!session.roundConfig.selectedCategoryIds.includes(reference.categoryId)) {
    throw new GameRuleError('CATEGORY_NOT_IN_ROUND', 'The category is not part of this game');
  }
  if (session.consumedCategoryIds.includes(reference.categoryId)) {
    throw new GameRuleError('CATEGORY_ALREADY_CONSUMED', 'The category was already consumed');
  }
  if (reference.difficulty !== session.currentDifficulty) {
    throw new GameRuleError('CHALLENGE_MISMATCH', 'Challenge difficulty does not match the level');
  }
  if (session.playedChallengeIds.includes(reference.challengeId)) {
    throw new GameRuleError('CHALLENGE_ALREADY_PLAYED', 'The challenge was already played');
  }
  if (session.roundConfig.preventSongReuse && session.playedSongIds.includes(reference.songId)) {
    throw new GameRuleError(
      'SONG_ALREADY_PLAYED',
      'This song was already played during the current game',
    );
  }

  return {
    ...session,
    activeTurn: {
      ...turn,
      categoryId: reference.categoryId,
      challengeReference: reference,
    },
    consumedCategoryIds: [...session.consumedCategoryIds, reference.categoryId],
    categoryHistory: turn.categoryId
      ? session.categoryHistory
      : [
          ...session.categoryHistory,
          {
            id: input.assignmentRecordId,
            categoryId: reference.categoryId,
            difficulty: session.currentDifficulty,
            teamId: turn.primaryTeamId,
            assignmentMode: input.assignmentMode,
            selectedAt: input.confirmedAt,
          },
        ],
    playedSongIds: session.playedSongIds.includes(reference.songId)
      ? session.playedSongIds
      : [...session.playedSongIds, reference.songId],
    playedChallengeIds: [...session.playedChallengeIds, reference.challengeId],
    updatedAt: input.confirmedAt,
  };
}

export function classifyPrimaryAnswer(
  session: GameSession,
  result: AnswerResult,
  classifiedAt: string,
): GameSession {
  const turn = getActiveTurn(session);
  if (!turn.challengeReference) {
    throw new GameRuleError('CHALLENGE_REQUIRED', 'Confirm a challenge before classification');
  }
  if (result === 'DECLINED') {
    throw new GameRuleError('INVALID_PRIMARY_RESULT', 'A primary answer cannot be Declined');
  }
  if (!turn.primaryAttempt) {
    throw new GameRuleError('TURN_NOT_READY', 'Primary attempt is missing');
  }
  if (turn.primaryAttempt.hostClassificationConfirmed) {
    throw new GameRuleError('PRIMARY_ALREADY_CLASSIFIED', 'Primary answer is already classified');
  }

  return {
    ...session,
    activeTurn: {
      ...turn,
      primaryAttempt: {
        ...turn.primaryAttempt,
        result,
        completedAt: classifiedAt,
        hostClassificationConfirmed: true,
      },
    },
    updatedAt: classifiedAt,
  };
}

export function startStealAttempt(session: GameSession, input: StartStealInput): GameSession {
  const turn = getActiveTurn(session);
  const primaryResult = getPrimaryResult(turn);

  if (!isStealEligible(primaryResult)) {
    throw new GameRuleError('STEAL_NOT_ELIGIBLE', 'A Perfect primary answer blocks the steal');
  }
  if (turn.stealAttempt) {
    throw new GameRuleError('STEAL_ALREADY_STARTED', 'This turn already has a steal attempt');
  }

  return {
    ...session,
    activeTurn: {
      ...turn,
      stealAttempt: createAttempt(
        input.attemptId,
        turn.opposingTeamId,
        'STEAL',
        session.gameConfig.stealTimerSeconds,
        input.startedAt,
      ),
    },
    updatedAt: input.startedAt,
  };
}

export function classifyStealAnswer(
  session: GameSession,
  result: AnswerResult,
  classifiedAt: string,
): GameSession {
  const turn = getActiveTurn(session);
  const stealAttempt = turn.stealAttempt;
  if (!stealAttempt) {
    throw new GameRuleError('STEAL_REQUIRED', 'Start the steal attempt before classification');
  }
  if (stealAttempt.hostClassificationConfirmed) {
    throw new GameRuleError('STEAL_ALREADY_CLASSIFIED', 'Steal answer is already classified');
  }

  return {
    ...session,
    activeTurn: {
      ...turn,
      stealAttempt: {
        ...stealAttempt,
        result,
        completedAt: classifiedAt,
        hostClassificationConfirmed: true,
      },
    },
    updatedAt: classifiedAt,
  };
}

export function recommendTurnScore(session: GameSession, calculatedAt: string): GameSession {
  const turn = getActiveTurn(session);
  if (turn.scoreApplied) {
    throw new GameRuleError('SCORE_ALREADY_APPLIED', 'Applied scores cannot be recalculated');
  }

  const primaryResult = getPrimaryResult(turn);
  let stealResult: AnswerResult | undefined;

  if (isStealEligible(primaryResult)) {
    if (!turn.stealAttempt?.hostClassificationConfirmed || !turn.stealAttempt.result) {
      throw new GameRuleError('STEAL_REQUIRED', 'Resolve the steal before calculating score');
    }
    stealResult = turn.stealAttempt.result;
  }

  const score = calculateTurnScore({
    difficulty: turn.difficulty,
    primaryResult,
    stealResult,
    primaryPenaltyPoints: sumPenalties(turn.primaryAttempt),
    stealPenaltyPoints: sumPenalties(turn.stealAttempt),
    gameConfig: session.gameConfig,
  });

  return {
    ...session,
    activeTurn: { ...turn, score },
    updatedAt: calculatedAt,
  };
}

function overrideBreakdown(
  breakdown: ScoreBreakdown,
  finalAwardedPoints: number,
  reason: string | undefined,
): ScoreBreakdown {
  return {
    ...breakdown,
    hostAdjustmentPoints: finalAwardedPoints - breakdown.recommendedPoints,
    finalAwardedPoints,
    overridden: true,
    overrideReason: reason,
  };
}

export function overrideTurnScore(session: GameSession, input: OverrideScoreInput): GameSession {
  const turn = getActiveTurn(session);
  if (!session.gameConfig.allowHostScoreOverride) {
    throw new GameRuleError('SCORE_OVERRIDE_DISABLED', 'Host score overrides are disabled');
  }
  if (turn.scoreApplied) {
    throw new GameRuleError('SCORE_ALREADY_APPLIED', 'Applied scores cannot be overridden');
  }
  if (!Number.isInteger(input.finalAwardedPoints)) {
    throw new GameRuleError('INVALID_SCORE_OVERRIDE', 'Final awarded points must be an integer');
  }
  if (!turn.score) {
    throw new GameRuleError('SCORE_REQUIRED', 'Calculate the recommended score first');
  }

  if (input.target === 'STEAL' && !turn.score.steal) {
    throw new GameRuleError('STEAL_NOT_ELIGIBLE', 'This turn has no steal score to override');
  }

  return {
    ...session,
    activeTurn: {
      ...turn,
      score:
        input.target === 'PRIMARY'
          ? {
              ...turn.score,
              primary: overrideBreakdown(
                turn.score.primary,
                input.finalAwardedPoints,
                input.reason,
              ),
            }
          : {
              ...turn.score,
              steal: overrideBreakdown(turn.score.steal!, input.finalAwardedPoints, input.reason),
            },
    },
    updatedAt: input.overriddenAt,
  };
}

export function applyTurnScore(session: GameSession, appliedAt: string): GameSession {
  const turn = getActiveTurn(session);
  if (turn.scoreApplied) {
    return session;
  }
  if (!turn.score) {
    throw new GameRuleError('SCORE_REQUIRED', 'Calculate the score before applying it');
  }

  let updated = replaceTeam(session, turn.primaryTeamId, (team) => ({
    ...team,
    score: team.score + turn.score!.primary.finalAwardedPoints,
  }));

  if (turn.score.steal) {
    updated = replaceTeam(updated, turn.opposingTeamId, (team) => ({
      ...team,
      score: team.score + turn.score!.steal!.finalAwardedPoints,
    }));
  }

  return {
    ...updated,
    activeTurn: { ...turn, scoreApplied: true },
    updatedAt: appliedAt,
  };
}

function updateTurnStatistics(session: GameSession, turn: ActiveTurn): GameSession {
  const primaryResult = getPrimaryResult(turn);
  let updated = replaceTeam(session, turn.primaryTeamId, (team) => ({
    ...team,
    primaryChallengeCount: team.primaryChallengeCount + 1,
    correctPrimaryCount: team.correctPrimaryCount + (primaryResult === 'PERFECT' ? 1 : 0),
    mostlyCorrectPrimaryCount:
      team.mostlyCorrectPrimaryCount + (primaryResult === 'MOSTLY_CORRECT' ? 1 : 0),
    wrongPrimaryCount: team.wrongPrimaryCount + (primaryResult === 'WRONG' ? 1 : 0),
  }));

  if (turn.stealAttempt?.hostClassificationConfirmed) {
    updated = replaceTeam(updated, turn.opposingTeamId, (team) => ({
      ...team,
      stealAttemptCount: team.stealAttemptCount + 1,
      successfulStealCount:
        team.successfulStealCount + (turn.stealAttempt?.result === 'PERFECT' ? 1 : 0),
    }));
  }

  return updated;
}

function buildLevelResult(
  session: GameSession,
  difficulty: DifficultyLevel,
  results: readonly TurnResult[],
  completedAt: string,
): LevelResult {
  const levelTurns = results.filter((result) => result.difficulty === difficulty);
  const firstTurn = levelTurns[0];
  const secondTurn = levelTurns[1];
  if (!firstTurn || !secondTurn || levelTurns.length !== 2) {
    throw new GameRuleError('TURN_NOT_READY', 'A level requires exactly two completed turns');
  }

  const pointsForTeam = (teamId: string) =>
    levelTurns.reduce((total, result) => {
      const primaryPoints =
        result.primaryAttempt.teamId === teamId ? result.primaryScore.finalAwardedPoints : 0;
      const stealPoints =
        result.stealAttempt?.teamId === teamId ? (result.stealScore?.finalAwardedPoints ?? 0) : 0;
      return total + primaryPoints + stealPoints;
    }, 0);

  return {
    difficulty,
    turnIds: [firstTurn.turnId, secondTurn.turnId],
    teamScores: [
      { teamId: session.teams[0].id, pointsAwarded: pointsForTeam(session.teams[0].id) },
      { teamId: session.teams[1].id, pointsAwarded: pointsForTeam(session.teams[1].id) },
    ],
    completedAt,
  };
}

export function completeTurn(session: GameSession, completedAt: string): GameSession {
  const turn = getActiveTurn(session);
  if (!turn.categoryId || !turn.challengeReference || !turn.primaryAttempt || !turn.score) {
    throw new GameRuleError(
      'TURN_NOT_READY',
      'The turn is missing required challenge or score data',
    );
  }
  if (!turn.scoreApplied) {
    throw new GameRuleError('TURN_NOT_READY', 'Apply the score before completing the turn');
  }

  const primaryResult = getPrimaryResult(turn);
  if (
    isStealEligible(primaryResult) &&
    (!turn.stealAttempt?.hostClassificationConfirmed || !turn.stealAttempt.result)
  ) {
    throw new GameRuleError('STEAL_REQUIRED', 'Resolve the steal before completing the turn');
  }

  const result: TurnResult = {
    turnId: turn.id,
    difficulty: turn.difficulty,
    categoryId: turn.categoryId,
    challenge: turn.challengeReference,
    primaryAttempt: turn.primaryAttempt,
    stealAttempt: turn.stealAttempt,
    primaryScore: turn.score.primary,
    stealScore: turn.score.steal,
    completedAt,
  };

  const withStatistics = updateTurnStatistics(session, turn);
  const turnHistory = [...withStatistics.turnHistory, result];
  const completedTurns = session.currentLevelState.primaryTurnsCompleted + 1;

  if (completedTurns < 2) {
    return {
      ...withStatistics,
      activeTurn: undefined,
      activeChallenge: undefined,
      currentLevelState: {
        ...session.currentLevelState,
        primaryTurnsCompleted: completedTurns,
      },
      turnHistory,
      updatedAt: completedAt,
    };
  }

  const levelResult = buildLevelResult(
    withStatistics,
    session.currentDifficulty,
    turnHistory,
    completedAt,
  );
  const levelHistory = [...withStatistics.levelHistory, levelResult];

  if (session.currentDifficulty === 5) {
    if (withStatistics.consumedCategoryIds.length !== 10) {
      throw new GameRuleError(
        'INVALID_CATEGORY_COUNT',
        'A completed game must consume ten categories',
      );
    }

    return {
      ...withStatistics,
      status: 'COMPLETED',
      completedAt,
      activeTurn: undefined,
      activeChallenge: undefined,
      currentLevelState: {
        ...session.currentLevelState,
        primaryTurnsCompleted: 2,
      },
      turnHistory,
      levelHistory,
      updatedAt: completedAt,
    };
  }

  const nextDifficulty = (session.currentDifficulty + 1) as DifficultyLevel;
  return {
    ...withStatistics,
    activeTurn: undefined,
    activeChallenge: undefined,
    currentDifficulty: nextDifficulty,
    currentLevelState: {
      difficulty: nextDifficulty,
      primaryTurnsCompleted: 0,
    },
    turnHistory,
    levelHistory,
    updatedAt: completedAt,
  };
}

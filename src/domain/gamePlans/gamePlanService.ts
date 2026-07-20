import {
  analyzeCatalogCoverage,
  buildRoundConfig,
  type CatalogIndex,
  type ValidationDiagnostic,
} from '../catalog';
import { DEFAULT_GAME_CONFIG, DEFAULT_THEME, SCHEMA_VERSIONS } from '../constants';
import { createGame, type RandomSource, type TeamIdentity } from '../engine';
import type { GameSession } from '../models/game';
import type { GamePlan, GamePlanValidationIssue } from '../models/gamePlan';

export interface CreateGamePlanInput {
  id: string;
  name: string;
  createdAt: string;
  catalog: CatalogIndex;
}

export interface ValidateGamePlanInput {
  plan: GamePlan;
  catalog: CatalogIndex;
  random: RandomSource;
  validatedAt: string;
}

export interface StartGameFromPlanInput extends ValidateGamePlanInput {
  gameId: string;
  teams: readonly TeamIdentity[];
  acceptWarnings: boolean;
}

export type StartGameFromPlanResult =
  | {
      ok: true;
      plan: GamePlan;
      session: GameSession;
    }
  | {
      ok: false;
      code: 'INVALID_PLAN' | 'WARNING_ACCEPTANCE_REQUIRED';
      plan: GamePlan;
      message: string;
    };

function clonePlan(plan: GamePlan): GamePlan {
  return {
    ...plan,
    roundConfig: {
      ...plan.roundConfig,
      difficultyLevels: [...plan.roundConfig.difficultyLevels],
      selectedCategoryIds: [...plan.roundConfig.selectedCategoryIds],
      manualChallengePools: plan.roundConfig.manualChallengePools.map((pool) => ({
        ...pool,
        approvedChallengeIdsByDifficulty: Object.fromEntries(
          Object.entries(pool.approvedChallengeIdsByDifficulty).map(([difficulty, ids]) => [
            difficulty,
            ids ? [...ids] : ids,
          ]),
        ),
      })),
    },
    gameConfig: {
      ...plan.gameConfig,
      fullPointsByDifficulty: { ...plan.gameConfig.fullPointsByDifficulty },
      answerSecondsByDifficulty: { ...plan.gameConfig.answerSecondsByDifficulty },
    },
    validationIssues: plan.validationIssues.map((issue) => ({ ...issue })),
  };
}

function toPlanIssue(diagnostic: ValidationDiagnostic): GamePlanValidationIssue {
  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    path: diagnostic.path,
  };
}

export function createGamePlan(input: CreateGamePlanInput): GamePlan {
  const readyCategoryIds = new Set(
    analyzeCatalogCoverage(input.catalog).categories
      .filter((category) => category.isReady)
      .map((category) => category.categoryId),
  );
  const enabledCategories = input.catalog.snapshot.categories.filter((category) => category.enabled);
  const selectedCategoryIds = [
    ...enabledCategories.filter((category) => readyCategoryIds.has(category.id)),
    ...enabledCategories.filter((category) => !readyCategoryIds.has(category.id)),
  ]
    .slice(0, 10)
    .map((category) => category.id);

  return {
    schemaVersion: SCHEMA_VERSIONS.gamePlan,
    id: input.id,
    name: input.name.trim(),
    status: 'DRAFT',
    roundConfig: {
      categorySelectionMode: 'MANUAL',
      songSelectionMode: 'FULL_CATALOG',
      categoryCount: 10,
      difficultyLevels: [1, 2, 3, 4, 5],
      selectedCategoryIds,
      manualChallengePools: [],
      preventChallengeReuse: true,
      preventSongReuse: true,
      allowRuntimeReroll: true,
    },
    gameConfig: {
      ...DEFAULT_GAME_CONFIG,
      fullPointsByDifficulty: { ...DEFAULT_GAME_CONFIG.fullPointsByDifficulty },
      answerSecondsByDifficulty: { ...DEFAULT_GAME_CONFIG.answerSecondsByDifficulty },
    },
    preferredTheme: DEFAULT_THEME,
    revealSongBeforePlayback: DEFAULT_GAME_CONFIG.revealSongBeforePlayback,
    validationIssues: [],
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
}

export function duplicateGamePlan(source: GamePlan, id: string, duplicatedAt: string): GamePlan {
  const duplicate = clonePlan(source);
  return {
    ...duplicate,
    id,
    name: `${source.name} Copy`,
    status: 'DRAFT',
    validationIssues: [],
    createdAt: duplicatedAt,
    updatedAt: duplicatedAt,
  };
}

export function validateGamePlan(input: ValidateGamePlanInput): GamePlan {
  const source = clonePlan(input.plan);
  const result = buildRoundConfig(
    {
      categorySelectionMode: source.roundConfig.categorySelectionMode,
      songSelectionMode: source.roundConfig.songSelectionMode,
      manualCategoryIds: source.roundConfig.selectedCategoryIds,
      manualChallengePools: source.roundConfig.manualChallengePools,
      preventChallengeReuse: source.roundConfig.preventChallengeReuse,
      preventSongReuse: source.roundConfig.preventSongReuse,
      allowRuntimeReroll: source.roundConfig.allowRuntimeReroll,
      randomSeed: source.roundConfig.randomSeed,
    },
    input.catalog,
    input.random,
  );
  const validationIssues = result.diagnostics.map(toPlanIssue);
  const hasErrors = validationIssues.some((issue) => issue.severity === 'ERROR');
  const hasWarnings = validationIssues.some((issue) => issue.severity === 'WARNING');

  return {
    ...source,
    status: hasErrors ? 'INVALID' : hasWarnings ? 'READY_WITH_WARNINGS' : 'READY',
    roundConfig: result.ok ? result.config : source.roundConfig,
    gameConfig: {
      ...source.gameConfig,
      revealSongBeforePlayback: source.revealSongBeforePlayback,
    },
    validationIssues,
    updatedAt: input.validatedAt,
  };
}

export function startGameFromPlan(input: StartGameFromPlanInput): StartGameFromPlanResult {
  const plan = validateGamePlan(input);
  if (plan.status === 'INVALID') {
    return {
      ok: false,
      code: 'INVALID_PLAN',
      plan,
      message: 'Fix plan validation errors before starting a game.',
    };
  }
  if (plan.status === 'READY_WITH_WARNINGS' && !input.acceptWarnings) {
    return {
      ok: false,
      code: 'WARNING_ACCEPTANCE_REQUIRED',
      plan,
      message: 'Accept the plan warnings before starting a game.',
    };
  }

  return {
    ok: true,
    plan,
    session: createGame({
      id: input.gameId,
      createdAt: input.validatedAt,
      teams: input.teams,
      roundConfig: plan.roundConfig,
      gameConfig: plan.gameConfig,
    }),
  };
}

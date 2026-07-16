import type { AnswerResult, DifficultyLevel } from '../enums';
import type { GameConfig } from '../models/game';
import type { ScoreBreakdown, TurnScore } from '../models/score';
import { GameRuleError } from './errors';

export type PrimaryAnswerResult = Exclude<AnswerResult, 'DECLINED'>;

export interface TurnScoreInput {
  difficulty: DifficultyLevel;
  primaryResult: PrimaryAnswerResult;
  stealResult?: AnswerResult | undefined;
  primaryPenaltyPoints: number;
  stealPenaltyPoints: number;
  gameConfig: GameConfig;
}

export function isStealEligible(result: PrimaryAnswerResult): boolean {
  return result === 'MOSTLY_CORRECT' || result === 'WRONG';
}

function createScoreBreakdown(
  fullChallengePoints: number,
  baseAllocatedPoints: number,
  lifelinePenaltyPoints: number,
  scoreFloorAtZero: boolean,
): ScoreBreakdown {
  const rawRecommendation = baseAllocatedPoints - lifelinePenaltyPoints;
  const recommendedPoints = scoreFloorAtZero ? Math.max(0, rawRecommendation) : rawRecommendation;

  return {
    fullChallengePoints,
    baseAllocatedPoints,
    lifelinePenaltyPoints,
    hostAdjustmentPoints: 0,
    recommendedPoints,
    finalAwardedPoints: recommendedPoints,
    overridden: false,
  };
}

export function calculateTurnScore(input: TurnScoreInput): TurnScore {
  const fullPoints = input.gameConfig.fullPointsByDifficulty[input.difficulty];
  const halfPoints = fullPoints / 2;

  if (input.primaryResult === 'PERFECT') {
    if (input.stealResult !== undefined) {
      throw new GameRuleError('STEAL_NOT_ELIGIBLE', 'A Perfect primary answer cannot have a steal');
    }

    return {
      primary: createScoreBreakdown(
        fullPoints,
        fullPoints,
        input.primaryPenaltyPoints,
        input.gameConfig.scoreFloorAtZero,
      ),
    };
  }

  if (input.stealResult === undefined) {
    throw new GameRuleError(
      'STEAL_REQUIRED',
      'Mostly Correct and Wrong answers require a steal result',
    );
  }

  const primaryBase = input.primaryResult === 'MOSTLY_CORRECT' ? halfPoints : 0;
  const stealBase = input.stealResult === 'PERFECT' ? halfPoints : 0;

  return {
    primary: createScoreBreakdown(
      fullPoints,
      primaryBase,
      input.primaryPenaltyPoints,
      input.gameConfig.scoreFloorAtZero,
    ),
    steal: createScoreBreakdown(
      fullPoints,
      stealBase,
      input.stealPenaltyPoints,
      input.gameConfig.scoreFloorAtZero,
    ),
  };
}

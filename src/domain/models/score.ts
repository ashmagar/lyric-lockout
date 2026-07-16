export interface ScoreBreakdown {
  fullChallengePoints: number;
  baseAllocatedPoints: number;
  lifelinePenaltyPoints: number;
  hostAdjustmentPoints: number;
  recommendedPoints: number;
  finalAwardedPoints: number;
  overridden: boolean;
  overrideReason?: string | undefined;
}

export interface TurnScore {
  primary: ScoreBreakdown;
  steal?: ScoreBreakdown | undefined;
}

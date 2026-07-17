import type { GamePlan } from '../domain';

export type GamePlanLoadResult =
  | { status: 'EMPTY'; plans: [] }
  | { status: 'VALID'; plans: GamePlan[]; savedAt: string; raw: string }
  | {
      status: 'CORRUPT' | 'UNSUPPORTED';
      plans: [];
      message: string;
      raw: string;
    };

export interface GamePlanRepository {
  loadPlans(): GamePlanLoadResult;
  savePlan(plan: GamePlan): void;
  deletePlan(planId: string): void;
}

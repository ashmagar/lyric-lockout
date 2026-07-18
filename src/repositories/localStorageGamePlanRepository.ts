import type { GamePlan } from '../domain';
import { GAME_PLANS_ENVELOPE_VERSION, gamePlanSchema, gamePlansEnvelopeSchema } from '../schemas';
import type { GamePlanLoadResult, GamePlanRepository } from './gamePlanRepository';

export const LEGACY_GAME_PLANS_STORAGE_KEY = 'lyric-lockout.game-plans';
export const GAME_PLANS_STORAGE_KEY = 'lyric-lockout.v2.game-plans';

function readVersion(value: unknown): number | undefined {
  if (
    typeof value === 'object' &&
    value !== null &&
    'schemaVersion' in value &&
    typeof value.schemaVersion === 'number'
  ) {
    return value.schemaVersion;
  }
  return undefined;
}

export class LocalStorageGamePlanRepository implements GamePlanRepository {
  constructor(
    private readonly storage: Storage,
    private readonly now: () => Date = () => new Date(),
  ) {}

  loadPlans(): GamePlanLoadResult {
    this.storage.removeItem(LEGACY_GAME_PLANS_STORAGE_KEY);
    const raw = this.storage.getItem(GAME_PLANS_STORAGE_KEY);
    if (raw === null) return { status: 'EMPTY', plans: [] };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        status: 'CORRUPT',
        plans: [],
        message: 'Saved Game Plans are not valid JSON.',
        raw,
      };
    }
    const version = readVersion(parsed);
    if (version !== GAME_PLANS_ENVELOPE_VERSION) {
      return {
        status: 'UNSUPPORTED',
        plans: [],
        message:
          version === undefined
            ? 'Saved Game Plans have no recognized schema version.'
            : `Saved Game Plan schema version ${version} is not supported.`,
        raw,
      };
    }
    const result = gamePlansEnvelopeSchema.safeParse(parsed);
    if (!result.success) {
      return {
        status: 'CORRUPT',
        plans: [],
        message: 'Saved Game Plans failed validation and were not changed.',
        raw,
      };
    }
    return {
      status: 'VALID',
      plans: result.data.plans,
      savedAt: result.data.savedAt,
      raw,
    };
  }

  savePlan(plan: GamePlan): void {
    const plans = this.requireWritablePlans();
    const validatedPlan = gamePlanSchema.parse(plan);
    const envelope = gamePlansEnvelopeSchema.parse({
      schemaVersion: GAME_PLANS_ENVELOPE_VERSION,
      type: 'GAME_PLANS',
      savedAt: this.now().toISOString(),
      plans: [validatedPlan, ...plans.filter((candidate) => candidate.id !== validatedPlan.id)],
    });
    this.storage.setItem(GAME_PLANS_STORAGE_KEY, JSON.stringify(envelope));
  }

  deletePlan(planId: string): void {
    const plans = this.requireWritablePlans();
    const envelope = gamePlansEnvelopeSchema.parse({
      schemaVersion: GAME_PLANS_ENVELOPE_VERSION,
      type: 'GAME_PLANS',
      savedAt: this.now().toISOString(),
      plans: plans.filter((plan) => plan.id !== planId),
    });
    this.storage.setItem(GAME_PLANS_STORAGE_KEY, JSON.stringify(envelope));
  }

  private requireWritablePlans(): GamePlan[] {
    const result = this.loadPlans();
    if (result.status === 'CORRUPT' || result.status === 'UNSUPPORTED') {
      throw new Error(result.message);
    }
    return result.plans;
  }
}

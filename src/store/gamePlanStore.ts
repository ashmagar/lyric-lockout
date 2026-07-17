import { create } from 'zustand';

import {
  createGamePlan,
  duplicateGamePlan,
  startGameFromPlan,
  validateGamePlan,
  type GamePlan,
  type StartGameFromPlanResult,
} from '../domain';
import { GAMEPLAY_CATALOG_INDEX } from '../features/game/gameplayCatalog';
import { LocalStorageGamePlanRepository, type GamePlanRepository } from '../repositories';

interface PlanStorageIssue {
  kind: 'CORRUPT' | 'UNSUPPORTED';
  message: string;
  raw: string;
}

interface PreparePlanStartInput {
  planId: string;
  teamOneName: string;
  teamTwoName: string;
  acceptWarnings: boolean;
}

interface GamePlanState {
  status: 'UNINITIALIZED' | 'READY';
  plans: GamePlan[];
  storageIssue?: PlanStorageIssue | undefined;
  error?: string | undefined;
  initialize: () => void;
  createPlan: (name: string) => GamePlan | undefined;
  savePlan: (plan: GamePlan) => boolean;
  validatePlan: (planId: string) => GamePlan | undefined;
  duplicatePlan: (planId: string) => GamePlan | undefined;
  renamePlan: (planId: string, name: string) => boolean;
  deletePlan: (planId: string) => boolean;
  preparePlanStart: (input: PreparePlanStartInput) => StartGameFromPlanResult | undefined;
  clearError: () => void;
}

let configuredRepository: GamePlanRepository | undefined;
let fallbackSequence = 0;

function repository(): GamePlanRepository {
  return (configuredRepository ??= new LocalStorageGamePlanRepository(window.localStorage));
}

function now(): string {
  return new Date().toISOString();
}

function nextId(prefix: string): string {
  fallbackSequence += 1;
  const unique =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${fallbackSequence}`;
  return `${prefix}-${unique}`;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Saved Game Plans could not be updated.';
}

function markDraft(plan: GamePlan): GamePlan {
  return {
    ...plan,
    status: 'DRAFT',
    validationIssues: [],
    updatedAt: now(),
  };
}

export function configureGamePlanRepository(nextRepository: GamePlanRepository | undefined): void {
  configuredRepository = nextRepository;
}

export const useGamePlanStore = create<GamePlanState>((set, get) => ({
  status: 'UNINITIALIZED',
  plans: [],

  initialize() {
    if (get().status !== 'UNINITIALIZED') return;
    try {
      const result = repository().loadPlans();
      if (result.status === 'CORRUPT' || result.status === 'UNSUPPORTED') {
        set({
          status: 'READY',
          plans: [],
          storageIssue: {
            kind: result.status,
            message: result.message,
            raw: result.raw,
          },
        });
        return;
      }
      set({
        status: 'READY',
        plans: result.plans,
        storageIssue: undefined,
        error: undefined,
      });
    } catch (error) {
      set({ status: 'READY', error: message(error) });
    }
  },

  createPlan(name) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      set({ error: 'A plan name is required.' });
      return undefined;
    }
    const plan = createGamePlan({
      id: nextId('plan'),
      name: trimmedName,
      createdAt: now(),
      catalog: GAMEPLAY_CATALOG_INDEX,
    });
    try {
      repository().savePlan(plan);
      set({ plans: [plan, ...get().plans], error: undefined });
      return plan;
    } catch (error) {
      set({ error: message(error) });
      return undefined;
    }
  },

  savePlan(plan) {
    const draft = markDraft(plan);
    try {
      repository().savePlan(draft);
      set({
        plans: [draft, ...get().plans.filter((candidate) => candidate.id !== draft.id)],
        error: undefined,
      });
      return true;
    } catch (error) {
      set({ error: message(error) });
      return false;
    }
  },

  validatePlan(planId) {
    const plan = get().plans.find((candidate) => candidate.id === planId);
    if (!plan) return undefined;
    const validated = validateGamePlan({
      plan,
      catalog: GAMEPLAY_CATALOG_INDEX,
      random: Math.random,
      validatedAt: now(),
    });
    try {
      repository().savePlan(validated);
      set({
        plans: [validated, ...get().plans.filter((candidate) => candidate.id !== validated.id)],
        error: undefined,
      });
      return validated;
    } catch (error) {
      set({ error: message(error) });
      return undefined;
    }
  },

  duplicatePlan(planId) {
    const source = get().plans.find((candidate) => candidate.id === planId);
    if (!source) return undefined;
    const duplicate = duplicateGamePlan(source, nextId('plan'), now());
    try {
      repository().savePlan(duplicate);
      set({ plans: [duplicate, ...get().plans], error: undefined });
      return duplicate;
    } catch (error) {
      set({ error: message(error) });
      return undefined;
    }
  },

  renamePlan(planId, name) {
    const plan = get().plans.find((candidate) => candidate.id === planId);
    const trimmedName = name.trim();
    if (!plan || !trimmedName) {
      set({ error: 'A plan name is required.' });
      return false;
    }
    return get().savePlan({ ...plan, name: trimmedName });
  },

  deletePlan(planId) {
    try {
      repository().deletePlan(planId);
      set({
        plans: get().plans.filter((candidate) => candidate.id !== planId),
        error: undefined,
      });
      return true;
    } catch (error) {
      set({ error: message(error) });
      return false;
    }
  },

  preparePlanStart(input) {
    const plan = get().plans.find((candidate) => candidate.id === input.planId);
    if (!plan) {
      set({ error: 'The selected Game Plan could not be found.' });
      return undefined;
    }
    const result = startGameFromPlan({
      plan,
      catalog: GAMEPLAY_CATALOG_INDEX,
      random: Math.random,
      validatedAt: now(),
      gameId: nextId('game'),
      teams: [
        { id: 'team-a', name: input.teamOneName },
        { id: 'team-b', name: input.teamTwoName },
      ],
      acceptWarnings: input.acceptWarnings,
    });
    try {
      repository().savePlan(result.plan);
      set({
        plans: [result.plan, ...get().plans.filter((candidate) => candidate.id !== result.plan.id)],
        error: result.ok ? undefined : result.message,
      });
    } catch (error) {
      set({ error: message(error) });
      return undefined;
    }
    return result;
  },

  clearError() {
    set({ error: undefined });
  },
}));

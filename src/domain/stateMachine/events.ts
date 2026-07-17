import type { DifficultyLevel, GamePhase, LifelineType } from '../enums';
import type { ChallengeReference } from '../models/game';
import type { TurnScore } from '../models/score';

interface DomainEventBase {
  commandId: string;
  occurredAt: string;
}

export type DomainEvent =
  | (DomainEventBase & { type: 'PHASE_CHANGED'; from: GamePhase; to: GamePhase })
  | (DomainEventBase & { type: 'VIDEO_LOAD_REQUESTED'; challenge: ChallengeReference })
  | (DomainEventBase & { type: 'VIDEO_PLAY_REQUESTED'; purpose: 'CHALLENGE' | 'VERIFICATION' })
  | (DomainEventBase & { type: 'VIDEO_PAUSE_REQUESTED' })
  | (DomainEventBase & { type: 'VIDEO_SEEK_REQUESTED'; seconds: number })
  | (DomainEventBase & { type: 'SUSPENSE_START_REQUESTED' })
  | (DomainEventBase & { type: 'SUSPENSE_STOP_REQUESTED' })
  | (DomainEventBase & {
      type: 'TIMER_ACTION_REQUESTED';
      action: 'START' | 'PAUSE' | 'RESUME' | 'RESTART' | 'ADJUST' | 'DISABLE' | 'END';
      attemptId: string;
      deltaMilliseconds?: number | undefined;
    })
  | (DomainEventBase & { type: 'TIMER_EXPIRED'; attemptId: string })
  | (DomainEventBase & {
      type: 'LIFELINE_CONFIRMATION_REQUESTED';
      teamId: string;
      lifelineType: LifelineType;
      penaltyPoints: number;
    })
  | (DomainEventBase & {
      type: 'LIFELINE_USED';
      teamId: string;
      lifelineType: LifelineType;
      wasFree: boolean;
      penaltyPoints: number;
    })
  | (DomainEventBase & { type: 'HINT_DISPLAY_REQUESTED'; teamId: string })
  | (DomainEventBase & { type: 'CHALLENGE_REROLL_REQUESTED'; rejectedChallengeId: string })
  | (DomainEventBase & { type: 'SCORE_RECOMMENDED'; score: TurnScore })
  | (DomainEventBase & { type: 'SCORE_CONFIRMED'; turnId: string })
  | (DomainEventBase & { type: 'TURN_COMPLETED'; turnId: string })
  | (DomainEventBase & { type: 'LEVEL_COMPLETED'; difficulty: DifficultyLevel })
  | (DomainEventBase & { type: 'GAME_COMPLETED'; gameId: string })
  | (DomainEventBase & {
      type: 'RECOVERY_ENTERED';
      previousPhase: GamePhase;
      safePhase: GamePhase;
    })
  | (DomainEventBase & { type: 'RECOVERY_RESUMED'; safePhase: GamePhase });

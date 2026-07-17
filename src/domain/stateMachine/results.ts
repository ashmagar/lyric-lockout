import type { GamePhase } from '../enums';
import type { GameRuleErrorCode } from '../engine';
import type { GameSession } from '../models/game';
import type { GameCommandType } from './commands';
import type { DomainEvent } from './events';

export interface CommandFailure {
  kind: 'DUPLICATE_COMMAND' | 'ILLEGAL_TRANSITION' | 'GAME_RULE';
  code: GameRuleErrorCode | 'DUPLICATE_COMMAND' | 'ILLEGAL_PHASE' | 'INVALID_COMMAND';
  message: string;
  commandId: string;
  commandType: GameCommandType;
  phase: GamePhase;
  recoverable: boolean;
}

export interface CommandSuccess {
  ok: true;
  session: GameSession;
  events: DomainEvent[];
}

export interface CommandRejected {
  ok: false;
  session: GameSession;
  events: [];
  failure: CommandFailure;
}

export type CommandResult = CommandSuccess | CommandRejected;

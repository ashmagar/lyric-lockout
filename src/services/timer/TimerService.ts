import type { TimerStatus } from '../../domain/enums';

export interface TimerSnapshot {
  configuredMilliseconds: number;
  remainingMilliseconds: number;
  status: TimerStatus;
}

export type TimerEvent =
  | { type: 'STATE_CHANGED'; snapshot: TimerSnapshot }
  | { type: 'TICK'; snapshot: TimerSnapshot }
  | { type: 'EXPIRED'; snapshot: TimerSnapshot };

export type TimerEventListener = (event: TimerEvent) => void;

export interface PausedTimerRestoreState {
  configuredMilliseconds: number;
  remainingMilliseconds: number;
}

export interface TimerService {
  getSnapshot(): TimerSnapshot;
  subscribe(listener: TimerEventListener): () => void;
  start(durationMilliseconds: number): void;
  pause(): void;
  resume(): void;
  restart(): void;
  adjust(deltaMilliseconds: number): void;
  disable(): void;
  stop(): void;
  restorePaused(state: PausedTimerRestoreState): void;
  dispose(): void;
}

export interface TimerClock {
  now(): number;
}

export interface TimerScheduler {
  scheduleRepeating(task: () => void, intervalMilliseconds: number): () => void;
}

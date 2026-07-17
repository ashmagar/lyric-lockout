import type { TimerStatus } from '../../domain/enums';
import type {
  PausedTimerRestoreState,
  TimerClock,
  TimerEvent,
  TimerEventListener,
  TimerScheduler,
  TimerService,
  TimerSnapshot,
} from './TimerService';

const DEFAULT_TICK_INTERVAL_MILLISECONDS = 100;

function requireNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a nonnegative finite number`);
  }
}

export class SystemTimerClock implements TimerClock {
  now(): number {
    return Date.now();
  }
}

export class BrowserTimerScheduler implements TimerScheduler {
  scheduleRepeating(task: () => void, intervalMilliseconds: number): () => void {
    const intervalId = window.setInterval(task, intervalMilliseconds);
    return () => window.clearInterval(intervalId);
  }
}

export class BrowserTimerService implements TimerService {
  readonly #clock: TimerClock;
  readonly #scheduler: TimerScheduler;
  readonly #tickIntervalMilliseconds: number;
  readonly #listeners = new Set<TimerEventListener>();

  #configuredMilliseconds = 0;
  #remainingMilliseconds = 0;
  #status: TimerStatus = 'IDLE';
  #runStartedAt = 0;
  #runStartedWithMilliseconds = 0;
  #cancelTick?: (() => void) | undefined;
  #expirationEmitted = false;
  #disposed = false;

  constructor(
    clock: TimerClock = new SystemTimerClock(),
    scheduler: TimerScheduler = new BrowserTimerScheduler(),
    tickIntervalMilliseconds = DEFAULT_TICK_INTERVAL_MILLISECONDS,
  ) {
    if (!Number.isFinite(tickIntervalMilliseconds) || tickIntervalMilliseconds <= 0) {
      throw new Error('Timer tick interval must be a positive finite number');
    }
    this.#clock = clock;
    this.#scheduler = scheduler;
    this.#tickIntervalMilliseconds = tickIntervalMilliseconds;
  }

  getSnapshot(): TimerSnapshot {
    const remainingMilliseconds =
      this.#status === 'RUNNING'
        ? this.calculateRemaining(this.#clock.now())
        : this.#remainingMilliseconds;
    return {
      configuredMilliseconds: this.#configuredMilliseconds,
      remainingMilliseconds,
      status: remainingMilliseconds === 0 && this.#status === 'RUNNING' ? 'EXPIRED' : this.#status,
    };
  }

  subscribe(listener: TimerEventListener): () => void {
    this.assertActive();
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  start(durationMilliseconds: number): void {
    this.assertActive();
    requireNonNegative(durationMilliseconds, 'Timer duration');
    this.stopTicking();
    this.#configuredMilliseconds = durationMilliseconds;
    this.#remainingMilliseconds = durationMilliseconds;
    this.#expirationEmitted = false;
    this.beginRunning();
  }

  pause(): void {
    this.assertActive();
    if (this.#status !== 'RUNNING') return;
    this.synchronize();
    if (this.#remainingMilliseconds === 0) return;
    this.stopTicking();
    this.#status = 'PAUSED';
    this.emit('STATE_CHANGED');
  }

  resume(): void {
    this.assertActive();
    if (this.#status !== 'PAUSED') return;
    this.beginRunning();
  }

  restart(): void {
    this.assertActive();
    this.stopTicking();
    this.#remainingMilliseconds = this.#configuredMilliseconds;
    this.#expirationEmitted = false;
    this.beginRunning();
  }

  adjust(deltaMilliseconds: number): void {
    this.assertActive();
    if (!Number.isFinite(deltaMilliseconds)) {
      throw new Error('Timer adjustment must be a finite number');
    }
    if (this.#status === 'RUNNING') this.synchronize();
    if (this.#status === 'DISABLED' || this.#status === 'COMPLETED') return;

    this.#remainingMilliseconds = Math.max(0, this.#remainingMilliseconds + deltaMilliseconds);
    if (this.#status === 'RUNNING') {
      this.#runStartedAt = this.#clock.now();
      this.#runStartedWithMilliseconds = this.#remainingMilliseconds;
    }
    if (this.#remainingMilliseconds === 0 && this.#status !== 'IDLE') {
      this.expire();
      return;
    }
    this.emit('STATE_CHANGED');
  }

  disable(): void {
    this.assertActive();
    this.stopTicking();
    this.#status = 'DISABLED';
    this.emit('STATE_CHANGED');
  }

  stop(): void {
    this.assertActive();
    if (this.#status === 'RUNNING') this.synchronize();
    this.stopTicking();
    this.#status = 'COMPLETED';
    this.emit('STATE_CHANGED');
  }

  restorePaused(state: PausedTimerRestoreState): void {
    this.assertActive();
    requireNonNegative(state.configuredMilliseconds, 'Configured timer duration');
    requireNonNegative(state.remainingMilliseconds, 'Remaining timer duration');
    this.stopTicking();
    this.#configuredMilliseconds = state.configuredMilliseconds;
    this.#remainingMilliseconds = state.remainingMilliseconds;
    this.#status = 'PAUSED';
    this.#expirationEmitted = false;
    this.emit('STATE_CHANGED');
  }

  dispose(): void {
    if (this.#disposed) return;
    this.stopTicking();
    this.#disposed = true;
    this.#listeners.clear();
  }

  private beginRunning(): void {
    this.#status = 'RUNNING';
    this.#runStartedAt = this.#clock.now();
    this.#runStartedWithMilliseconds = this.#remainingMilliseconds;
    if (this.#remainingMilliseconds === 0) {
      this.expire();
      return;
    }
    this.#cancelTick = this.#scheduler.scheduleRepeating(
      () => this.synchronize(),
      this.#tickIntervalMilliseconds,
    );
    this.emit('STATE_CHANGED');
  }

  private calculateRemaining(now: number): number {
    return Math.max(0, this.#runStartedWithMilliseconds - (now - this.#runStartedAt));
  }

  private synchronize(): void {
    if (this.#status !== 'RUNNING') return;
    this.#remainingMilliseconds = this.calculateRemaining(this.#clock.now());
    if (this.#remainingMilliseconds === 0) {
      this.expire();
      return;
    }
    this.emit('TICK');
  }

  private expire(): void {
    this.#remainingMilliseconds = 0;
    this.#status = 'EXPIRED';
    this.stopTicking();
    if (this.#expirationEmitted) return;
    this.#expirationEmitted = true;
    this.emit('EXPIRED');
  }

  private stopTicking(): void {
    this.#cancelTick?.();
    this.#cancelTick = undefined;
  }

  private emit(type: TimerEvent['type']): void {
    const event: TimerEvent = { type, snapshot: this.getSnapshot() };
    this.#listeners.forEach((listener) => listener(event));
  }

  private assertActive(): void {
    if (this.#disposed) throw new Error('Timer service is disposed');
  }
}

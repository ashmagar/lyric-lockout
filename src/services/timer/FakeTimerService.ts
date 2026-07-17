import type {
  PausedTimerRestoreState,
  TimerEvent,
  TimerEventListener,
  TimerService,
  TimerSnapshot,
} from './TimerService';

export class FakeTimerService implements TimerService {
  readonly startRequests: number[] = [];
  readonly adjustmentRequests: number[] = [];
  pauseCallCount = 0;
  resumeCallCount = 0;
  restartCallCount = 0;
  disableCallCount = 0;
  stopCallCount = 0;
  disposeCallCount = 0;

  #snapshot: TimerSnapshot = {
    configuredMilliseconds: 0,
    remainingMilliseconds: 0,
    status: 'IDLE',
  };
  readonly #listeners = new Set<TimerEventListener>();

  getSnapshot(): TimerSnapshot {
    return { ...this.#snapshot };
  }

  subscribe(listener: TimerEventListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  start(durationMilliseconds: number): void {
    this.startRequests.push(durationMilliseconds);
    this.#snapshot = {
      configuredMilliseconds: durationMilliseconds,
      remainingMilliseconds: durationMilliseconds,
      status: 'RUNNING',
    };
    this.emit('STATE_CHANGED');
  }

  pause(): void {
    this.pauseCallCount += 1;
    this.#snapshot = { ...this.#snapshot, status: 'PAUSED' };
    this.emit('STATE_CHANGED');
  }

  resume(): void {
    this.resumeCallCount += 1;
    this.#snapshot = { ...this.#snapshot, status: 'RUNNING' };
    this.emit('STATE_CHANGED');
  }

  restart(): void {
    this.restartCallCount += 1;
    this.#snapshot = {
      ...this.#snapshot,
      remainingMilliseconds: this.#snapshot.configuredMilliseconds,
      status: 'RUNNING',
    };
    this.emit('STATE_CHANGED');
  }

  adjust(deltaMilliseconds: number): void {
    this.adjustmentRequests.push(deltaMilliseconds);
    this.#snapshot = {
      ...this.#snapshot,
      remainingMilliseconds: Math.max(0, this.#snapshot.remainingMilliseconds + deltaMilliseconds),
    };
    this.emit('STATE_CHANGED');
  }

  disable(): void {
    this.disableCallCount += 1;
    this.#snapshot = { ...this.#snapshot, status: 'DISABLED' };
    this.emit('STATE_CHANGED');
  }

  stop(): void {
    this.stopCallCount += 1;
    this.#snapshot = { ...this.#snapshot, status: 'COMPLETED' };
    this.emit('STATE_CHANGED');
  }

  restorePaused(state: PausedTimerRestoreState): void {
    this.#snapshot = { ...state, status: 'PAUSED' };
    this.emit('STATE_CHANGED');
  }

  expire(): void {
    this.#snapshot = { ...this.#snapshot, remainingMilliseconds: 0, status: 'EXPIRED' };
    this.emit('EXPIRED');
  }

  dispose(): void {
    this.disposeCallCount += 1;
    this.#listeners.clear();
  }

  private emit(type: TimerEvent['type']): void {
    const event: TimerEvent = { type, snapshot: this.getSnapshot() };
    this.#listeners.forEach((listener) => listener(event));
  }
}

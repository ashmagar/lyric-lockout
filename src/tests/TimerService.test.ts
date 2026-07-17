import { describe, expect, it } from 'vitest';

import { BrowserTimerService, type TimerClock, type TimerScheduler } from '../services/timer';

class ManualClock implements TimerClock {
  currentMilliseconds = 0;

  now(): number {
    return this.currentMilliseconds;
  }

  advance(milliseconds: number): void {
    this.currentMilliseconds += milliseconds;
  }
}

class ManualTimerScheduler implements TimerScheduler {
  readonly intervals: number[] = [];
  readonly #tasks = new Set<() => void>();

  scheduleRepeating(task: () => void, intervalMilliseconds: number): () => void {
    this.intervals.push(intervalMilliseconds);
    this.#tasks.add(task);
    return () => this.#tasks.delete(task);
  }

  run(): void {
    [...this.#tasks].forEach((task) => task());
  }

  get activeTaskCount(): number {
    return this.#tasks.size;
  }
}

describe('BrowserTimerService', () => {
  it('uses elapsed wall-clock time when scheduled ticks drift', () => {
    const clock = new ManualClock();
    const scheduler = new ManualTimerScheduler();
    const timer = new BrowserTimerService(clock, scheduler);

    timer.start(5_000);
    clock.advance(2_300);
    scheduler.run();

    expect(timer.getSnapshot()).toEqual({
      configuredMilliseconds: 5_000,
      remainingMilliseconds: 2_700,
      status: 'RUNNING',
    });
    expect(scheduler.intervals).toEqual([100]);
  });

  it('emits expiration once and cancels further ticking', () => {
    const clock = new ManualClock();
    const scheduler = new ManualTimerScheduler();
    const timer = new BrowserTimerService(clock, scheduler);
    let expirationCount = 0;
    timer.subscribe((event) => {
      if (event.type === 'EXPIRED') expirationCount += 1;
    });

    timer.start(1_000);
    clock.advance(1_500);
    scheduler.run();
    scheduler.run();

    expect(timer.getSnapshot()).toMatchObject({
      remainingMilliseconds: 0,
      status: 'EXPIRED',
    });
    expect(expirationCount).toBe(1);
    expect(scheduler.activeTaskCount).toBe(0);
  });

  it('adds and subtracts time from the current wall-clock remainder', () => {
    const clock = new ManualClock();
    const scheduler = new ManualTimerScheduler();
    const timer = new BrowserTimerService(clock, scheduler);

    timer.start(10_000);
    clock.advance(2_000);
    timer.adjust(5_000);
    expect(timer.getSnapshot().remainingMilliseconds).toBe(13_000);

    timer.adjust(-3_500);
    expect(timer.getSnapshot()).toMatchObject({
      remainingMilliseconds: 9_500,
      status: 'RUNNING',
    });
  });

  it('restores in a paused state and waits for an explicit resume', () => {
    const clock = new ManualClock();
    const scheduler = new ManualTimerScheduler();
    const timer = new BrowserTimerService(clock, scheduler);

    timer.restorePaused({
      configuredMilliseconds: 45_000,
      remainingMilliseconds: 52_500,
    });
    clock.advance(10_000);
    scheduler.run();

    expect(timer.getSnapshot()).toEqual({
      configuredMilliseconds: 45_000,
      remainingMilliseconds: 52_500,
      status: 'PAUSED',
    });
    expect(scheduler.activeTaskCount).toBe(0);

    timer.resume();
    clock.advance(500);
    scheduler.run();
    expect(timer.getSnapshot().remainingMilliseconds).toBe(52_000);
  });

  it('supports pause, restart, disable, and stop host controls', () => {
    const clock = new ManualClock();
    const scheduler = new ManualTimerScheduler();
    const timer = new BrowserTimerService(clock, scheduler);

    timer.start(30_000);
    clock.advance(2_000);
    timer.pause();
    expect(timer.getSnapshot()).toMatchObject({
      remainingMilliseconds: 28_000,
      status: 'PAUSED',
    });

    timer.restart();
    expect(timer.getSnapshot()).toMatchObject({
      remainingMilliseconds: 30_000,
      status: 'RUNNING',
    });

    timer.disable();
    expect(timer.getSnapshot().status).toBe('DISABLED');
    timer.stop();
    expect(timer.getSnapshot().status).toBe('COMPLETED');
  });

  it('cancels scheduled work and listeners when disposed', () => {
    const clock = new ManualClock();
    const scheduler = new ManualTimerScheduler();
    const timer = new BrowserTimerService(clock, scheduler);
    let expirationCount = 0;
    timer.subscribe((event) => {
      if (event.type === 'EXPIRED') expirationCount += 1;
    });

    timer.start(1_000);
    timer.dispose();
    clock.advance(2_000);
    scheduler.run();

    expect(scheduler.activeTaskCount).toBe(0);
    expect(expirationCount).toBe(0);
  });
});

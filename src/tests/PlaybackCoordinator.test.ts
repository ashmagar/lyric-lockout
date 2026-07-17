import { describe, expect, it } from 'vitest';

import {
  ChallengePlaybackCoordinator,
  FakeVideoPlayerService,
  type PlaybackChallengeConfig,
  type PollingScheduler,
} from '../services/video';

const CONFIG: PlaybackChallengeConfig = {
  videoId: 'video-test',
  playbackStartSeconds: 5,
  pauseAtSeconds: 10,
  verifyFromSeconds: 7,
  verifyToSeconds: 12,
};

class ManualPollingScheduler implements PollingScheduler {
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

describe('ChallengePlaybackCoordinator', () => {
  it('runs load, host play, automatic pause, verification, and restart', async () => {
    const player = new FakeVideoPlayerService();
    const scheduler = new ManualPollingScheduler();
    const coordinator = new ChallengePlaybackCoordinator(player, scheduler);
    const container = document.createElement('div');

    await coordinator.initialize(container, CONFIG);

    expect(coordinator.getSnapshot().status).toBe('READY');
    expect(player.loadRequests).toEqual([{ videoId: 'video-test', startSeconds: 5 }]);
    expect(player.playCallCount).toBe(0);

    coordinator.playChallenge();
    expect(player.seekRequests).toEqual([5]);
    expect(player.playCallCount).toBe(1);
    expect(scheduler.intervals).toEqual([100]);

    player.setCurrentTime(9.84);
    scheduler.run();
    expect(player.pauseCallCount).toBe(0);

    player.setCurrentTime(9.86);
    scheduler.run();
    expect(player.pauseCallCount).toBe(1);
    expect(coordinator.getSnapshot()).toMatchObject({
      status: 'PAUSED_AT_CHALLENGE',
      actualPauseTimeSeconds: 9.86,
    });
    expect(scheduler.activeTaskCount).toBe(0);
    scheduler.run();
    expect(player.pauseCallCount).toBe(1);

    coordinator.playVerification();
    expect(player.seekRequests.at(-1)).toBe(7);
    expect(player.playCallCount).toBe(2);
    player.setCurrentTime(11.86);
    scheduler.run();
    expect(player.pauseCallCount).toBe(2);
    expect(coordinator.getSnapshot().status).toBe('VERIFICATION_COMPLETE');

    coordinator.restart();
    expect(player.seekRequests.at(-1)).toBe(5);
    expect(player.playCallCount).toBe(3);
    expect(coordinator.getSnapshot().status).toBe('PLAYING_CHALLENGE');

    coordinator.dispose();
    expect(player.destroyCallCount).toBe(1);
    expect(scheduler.activeTaskCount).toBe(0);
  });

  it('reports player errors and retries loading without automatic playback', async () => {
    const player = new FakeVideoPlayerService();
    const coordinator = new ChallengePlaybackCoordinator(player, new ManualPollingScheduler());
    await coordinator.initialize(document.createElement('div'), CONFIG);

    player.emitError({
      code: 'HTML5_ERROR',
      message: 'Playback failed',
      recoverable: true,
    });

    expect(coordinator.getSnapshot()).toMatchObject({
      status: 'ERROR',
      error: { code: 'HTML5_ERROR' },
    });

    await coordinator.retry();
    expect(coordinator.getSnapshot().status).toBe('READY');
    expect(player.loadRequests).toHaveLength(2);
    expect(player.playCallCount).toBe(0);
  });

  it('supports host-controlled verification when no end timestamp exists', async () => {
    const player = new FakeVideoPlayerService();
    const scheduler = new ManualPollingScheduler();
    const coordinator = new ChallengePlaybackCoordinator(player, scheduler);
    await coordinator.initialize(document.createElement('div'), {
      ...CONFIG,
      verifyToSeconds: undefined,
    });

    coordinator.playVerification();
    player.setCurrentTime(40);
    scheduler.run();
    expect(coordinator.getSnapshot().status).toBe('PLAYING_VERIFICATION');

    coordinator.pauseVerification();
    expect(coordinator.getSnapshot().status).toBe('VERIFICATION_COMPLETE');
    expect(scheduler.activeTaskCount).toBe(0);
  });

  it('keeps playback recoverable when API playback is blocked', async () => {
    const player = new FakeVideoPlayerService();
    const scheduler = new ManualPollingScheduler();
    const coordinator = new ChallengePlaybackCoordinator(player, scheduler);
    await coordinator.initialize(document.createElement('div'), CONFIG);

    player.emitError({
      code: 'AUTOPLAY_BLOCKED',
      message: 'Use a direct player gesture',
      recoverable: true,
    });
    expect(coordinator.getSnapshot()).toMatchObject({
      status: 'READY',
      error: { code: 'AUTOPLAY_BLOCKED' },
    });

    player.play();
    expect(coordinator.getSnapshot()).toMatchObject({
      status: 'PLAYING_CHALLENGE',
      error: undefined,
    });
    expect(scheduler.activeTaskCount).toBe(1);
  });
});

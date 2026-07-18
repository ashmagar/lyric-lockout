import { describe, expect, it } from 'vitest';

import { FakeAudioService } from '../services/audio';
import { FakeTimerService } from '../services/timer';
import {
  calculateChallengePreviewStartSeconds,
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
  it.each([
    [65, 60],
    [5, 0],
    [3, 0],
    [0, 0],
  ])('calculates a five-second challenge preview lead from %ss', (pauseAtSeconds, expected) => {
    expect(calculateChallengePreviewStartSeconds(pauseAtSeconds)).toBe(expected);
  });

  it('jumps near the challenge and reuses automatic pause coordination', async () => {
    const player = new FakeVideoPlayerService();
    const scheduler = new ManualPollingScheduler();
    const coordinator = new ChallengePlaybackCoordinator(player, scheduler);
    const statuses: string[] = [];
    coordinator.subscribe((snapshot) => statuses.push(snapshot.status));
    await coordinator.initialize(document.createElement('div'), {
      ...CONFIG,
      pauseAtSeconds: 65,
      verifyToSeconds: 67,
    });

    coordinator.playChallengePreview();

    expect(player.seekRequests).toEqual([60]);
    expect(player.playCallCount).toBe(1);
    expect(statuses).toContain('SEEKING_CHALLENGE_PREVIEW');
    expect(coordinator.getSnapshot()).toMatchObject({
      status: 'PLAYING_CHALLENGE',
      requestedStartTimeSeconds: 60,
    });

    player.setCurrentTime(62);
    coordinator.pauseChallengePreview();
    expect(player.pauseCallCount).toBe(1);
    expect(scheduler.activeTaskCount).toBe(0);
    expect(coordinator.getSnapshot()).toMatchObject({
      status: 'PAUSED_BY_HOST',
      currentTimeSeconds: 62,
    });

    coordinator.playChallengePreview();
    player.setCurrentTime(64.86);
    scheduler.run();
    expect(player.pauseCallCount).toBe(2);
    expect(coordinator.getSnapshot()).toMatchObject({
      status: 'PAUSED_AT_CHALLENGE',
      actualPauseTimeSeconds: 64.86,
    });
  });

  it('reports unloaded, out-of-duration, and seek failures as visible coordinator errors', async () => {
    const unloaded = new ChallengePlaybackCoordinator(
      new FakeVideoPlayerService(),
      new ManualPollingScheduler(),
    );
    unloaded.playChallengePreview();
    const unloadedSnapshot = unloaded.getSnapshot();
    expect(unloadedSnapshot).toMatchObject({
      status: 'ERROR',
      error: { code: 'NOT_INITIALIZED' },
    });
    expect(unloadedSnapshot.error?.message).toContain('still loading');

    const shortPlayer = new FakeVideoPlayerService();
    shortPlayer.duration = 50;
    const beyondDuration = new ChallengePlaybackCoordinator(
      shortPlayer,
      new ManualPollingScheduler(),
    );
    await beyondDuration.initialize(document.createElement('div'), {
      ...CONFIG,
      pauseAtSeconds: 65,
      verifyToSeconds: 67,
    });
    beyondDuration.playChallengePreview();
    const beyondDurationSnapshot = beyondDuration.getSnapshot();
    expect(beyondDurationSnapshot).toMatchObject({
      status: 'ERROR',
      error: { code: 'INVALID_PARAMETER' },
    });
    expect(beyondDurationSnapshot.error?.message).toContain('beyond');

    class FailingSeekPlayer extends FakeVideoPlayerService {
      override seek(): void {
        throw new Error('Seek failed');
      }
    }
    const failingSeek = new ChallengePlaybackCoordinator(
      new FailingSeekPlayer(),
      new ManualPollingScheduler(),
    );
    await failingSeek.initialize(document.createElement('div'), CONFIG);
    failingSeek.playChallengePreview();
    expect(failingSeek.getSnapshot()).toMatchObject({
      status: 'ERROR',
      error: { code: 'UNKNOWN', message: 'Seek failed' },
    });
  });

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

  it('coordinates suspense and timer services without letting audio failure block answering', async () => {
    const player = new FakeVideoPlayerService();
    const scheduler = new ManualPollingScheduler();
    const audio = new FakeAudioService();
    const timer = new FakeTimerService();
    const coordinator = new ChallengePlaybackCoordinator(player, scheduler, {
      audio,
      timer,
      suspenseAssetId: 'countdown',
    });
    await coordinator.initialize(document.createElement('div'), {
      ...CONFIG,
      timerDurationMilliseconds: 30_000,
    });
    audio.failNext({
      operation: 'PLAY_SUSPENSE',
      channel: 'SUSPENSE',
      assetId: 'countdown',
      message: 'Audio unavailable',
      recoverable: true,
    });
    coordinator.playChallenge();
    player.setCurrentTime(9.86);
    scheduler.run();

    expect(coordinator.getSnapshot().status).toBe('PAUSED_AT_CHALLENGE');
    expect(audio.preloadCallCount).toBe(1);
    expect(audio.suspensePlayRequests).toEqual(['countdown']);
    expect(timer.startRequests).toEqual([30_000]);

    coordinator.playVerification();
    expect(timer.stopCallCount).toBeGreaterThan(0);
    expect(audio.stopSuspenseCallCount).toBeGreaterThan(0);
    expect(coordinator.getSnapshot().status).toBe('PLAYING_VERIFICATION');

    coordinator.dispose();
    expect(timer.disposeCallCount).toBe(1);
    expect(audio.disposeCallCount).toBe(1);
  });
});

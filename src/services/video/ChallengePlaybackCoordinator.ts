import type { PollingScheduler } from './PollingScheduler';
import type {
  VideoPlayerError,
  VideoPlayerEvent,
  VideoPlayerService,
  VideoPlayerState,
} from './VideoPlayerService';

export const PLAYBACK_COORDINATOR_STATES = [
  'IDLE',
  'INITIALIZING',
  'READY',
  'PLAYING_CHALLENGE',
  'PAUSED_AT_CHALLENGE',
  'PLAYING_VERIFICATION',
  'VERIFICATION_COMPLETE',
  'ERROR',
  'DISPOSED',
] as const;

export type PlaybackCoordinatorState = (typeof PLAYBACK_COORDINATOR_STATES)[number];

export interface PlaybackChallengeConfig {
  videoId: string;
  playbackStartSeconds: number;
  pauseAtSeconds: number;
  verifyFromSeconds: number;
  verifyToSeconds?: number | undefined;
}

export interface PlaybackSnapshot {
  status: PlaybackCoordinatorState;
  playerState: VideoPlayerState;
  currentTimeSeconds: number;
  durationSeconds: number;
  actualPauseTimeSeconds?: number | undefined;
  error?: VideoPlayerError | undefined;
}

export type PlaybackSnapshotListener = (snapshot: PlaybackSnapshot) => void;

const POLL_INTERVAL_MILLISECONDS = 100;
const PAUSE_TOLERANCE_SECONDS = 0.15;

function unexpectedError(error: unknown): VideoPlayerError {
  return {
    code: 'UNKNOWN',
    message: error instanceof Error ? error.message : 'Unexpected playback failure',
    recoverable: true,
  };
}

function validateConfig(config: PlaybackChallengeConfig): void {
  if (
    !config.videoId.trim() ||
    config.playbackStartSeconds < 0 ||
    config.verifyFromSeconds < 0 ||
    config.pauseAtSeconds <= config.playbackStartSeconds ||
    config.pauseAtSeconds <= config.verifyFromSeconds ||
    (config.verifyToSeconds !== undefined && config.verifyToSeconds <= config.pauseAtSeconds)
  ) {
    throw new Error('Playback challenge configuration is invalid');
  }
}

export class ChallengePlaybackCoordinator {
  readonly #player: VideoPlayerService;
  readonly #scheduler: PollingScheduler;
  readonly #listeners = new Set<PlaybackSnapshotListener>();
  #config?: PlaybackChallengeConfig | undefined;
  #status: PlaybackCoordinatorState = 'IDLE';
  #currentTimeSeconds = 0;
  #durationSeconds = 0;
  #actualPauseTimeSeconds?: number | undefined;
  #error?: VideoPlayerError | undefined;
  #cancelPolling?: (() => void) | undefined;
  #unsubscribePlayer?: (() => void) | undefined;
  #container?: HTMLElement | undefined;
  #playerInitialized = false;
  #challengePauseTriggered = false;
  #verificationEndTriggered = false;

  constructor(player: VideoPlayerService, scheduler: PollingScheduler) {
    this.#player = player;
    this.#scheduler = scheduler;
  }

  getSnapshot(): PlaybackSnapshot {
    return {
      status: this.#status,
      playerState: this.#player.getState(),
      currentTimeSeconds: this.#currentTimeSeconds,
      durationSeconds: this.#durationSeconds,
      actualPauseTimeSeconds: this.#actualPauseTimeSeconds,
      error: this.#error,
    };
  }

  subscribe(listener: PlaybackSnapshotListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async initialize(container: HTMLElement, config: PlaybackChallengeConfig): Promise<void> {
    try {
      validateConfig(config);
      this.#config = { ...config };
      this.#container = container;
      this.#status = 'INITIALIZING';
      this.#error = undefined;
      this.#unsubscribePlayer = this.#player.subscribe((event) => this.handlePlayerEvent(event));
      this.notify();
      await this.#player.initialize(container);
      this.#playerInitialized = true;
      await this.loadConfiguredVideo();
      if (this.#error === undefined) {
        this.#status = 'READY';
        this.#currentTimeSeconds = config.playbackStartSeconds;
        this.#durationSeconds = this.#player.getDuration();
        this.notify();
      }
    } catch (error) {
      this.fail(unexpectedError(error));
    }
  }

  playChallenge(): void {
    const config = this.requireConfig();
    try {
      this.stopPolling();
      this.#challengePauseTriggered = false;
      this.#verificationEndTriggered = false;
      this.#actualPauseTimeSeconds = undefined;
      this.#error = undefined;
      this.#player.seek(config.playbackStartSeconds);
      this.#player.play();
      this.#status = 'PLAYING_CHALLENGE';
      this.#currentTimeSeconds = config.playbackStartSeconds;
      this.startPolling();
      this.notify();
    } catch (error) {
      this.fail(unexpectedError(error));
    }
  }

  playVerification(): void {
    const config = this.requireConfig();
    try {
      this.stopPolling();
      this.#verificationEndTriggered = false;
      this.#error = undefined;
      this.#player.seek(config.verifyFromSeconds);
      this.#player.play();
      this.#status = 'PLAYING_VERIFICATION';
      this.#currentTimeSeconds = config.verifyFromSeconds;
      this.startPolling();
      this.notify();
    } catch (error) {
      this.fail(unexpectedError(error));
    }
  }

  pauseVerification(): void {
    if (this.#status !== 'PLAYING_VERIFICATION') return;
    try {
      this.#player.pause();
      this.stopPolling();
      this.#status = 'VERIFICATION_COMPLETE';
      this.#currentTimeSeconds = this.#player.getCurrentTime();
      this.notify();
    } catch (error) {
      this.fail(unexpectedError(error));
    }
  }

  restart(): void {
    this.playChallenge();
  }

  async retry(): Promise<void> {
    try {
      this.stopPolling();
      this.#status = 'INITIALIZING';
      this.#error = undefined;
      this.notify();
      if (!this.#playerInitialized) {
        if (!this.#container) throw new Error('Playback container is unavailable');
        await this.#player.initialize(this.#container);
        this.#playerInitialized = true;
      }
      await this.loadConfiguredVideo();
      if (this.#error === undefined) {
        const config = this.requireConfig();
        this.#status = 'READY';
        this.#currentTimeSeconds = config.playbackStartSeconds;
        this.#durationSeconds = this.#player.getDuration();
        this.notify();
      }
    } catch (error) {
      this.fail(unexpectedError(error));
    }
  }

  dispose(): void {
    this.stopPolling();
    this.#unsubscribePlayer?.();
    this.#unsubscribePlayer = undefined;
    this.#player.destroy();
    this.#playerInitialized = false;
    this.#container = undefined;
    this.#status = 'DISPOSED';
    this.notify();
    this.#listeners.clear();
  }

  private async loadConfiguredVideo(): Promise<void> {
    const config = this.requireConfig();
    await this.#player.load({
      videoId: config.videoId,
      startSeconds: config.playbackStartSeconds,
    });
  }

  private requireConfig(): PlaybackChallengeConfig {
    if (!this.#config) throw new Error('Playback coordinator is not initialized');
    return this.#config;
  }

  private startPolling(): void {
    if (this.#cancelPolling) return;
    this.#cancelPolling = this.#scheduler.scheduleRepeating(
      () => this.pollPlayback(),
      POLL_INTERVAL_MILLISECONDS,
    );
  }

  private stopPolling(): void {
    this.#cancelPolling?.();
    this.#cancelPolling = undefined;
  }

  private pollPlayback(): void {
    const config = this.requireConfig();
    try {
      const currentTime = this.#player.getCurrentTime();
      this.#currentTimeSeconds = currentTime;
      this.#durationSeconds = this.#player.getDuration();

      if (
        this.#status === 'PLAYING_CHALLENGE' &&
        !this.#challengePauseTriggered &&
        currentTime >= config.pauseAtSeconds - PAUSE_TOLERANCE_SECONDS
      ) {
        this.#challengePauseTriggered = true;
        this.#actualPauseTimeSeconds = currentTime;
        this.#player.pause();
        this.stopPolling();
        this.#status = 'PAUSED_AT_CHALLENGE';
      } else if (
        this.#status === 'PLAYING_VERIFICATION' &&
        config.verifyToSeconds !== undefined &&
        !this.#verificationEndTriggered &&
        currentTime >= config.verifyToSeconds - PAUSE_TOLERANCE_SECONDS
      ) {
        this.#verificationEndTriggered = true;
        this.#player.pause();
        this.stopPolling();
        this.#status = 'VERIFICATION_COMPLETE';
      }
      this.notify();
    } catch (error) {
      this.fail(unexpectedError(error));
    }
  }

  private handlePlayerEvent(event: VideoPlayerEvent): void {
    if (event.type === 'ERROR') {
      if (event.error.code === 'AUTOPLAY_BLOCKED') {
        this.stopPolling();
        this.#error = event.error;
        this.#status = 'READY';
        this.notify();
        return;
      }
      this.fail(event.error);
      return;
    }
    if (event.state === 'PLAYING' && this.#status === 'READY') {
      this.#challengePauseTriggered = false;
      this.#verificationEndTriggered = false;
      this.#actualPauseTimeSeconds = undefined;
      this.#error = undefined;
      this.#status = 'PLAYING_CHALLENGE';
      this.startPolling();
    }
    this.notify();
  }

  private fail(error: VideoPlayerError): void {
    this.stopPolling();
    this.#error = error;
    this.#status = 'ERROR';
    this.notify();
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    this.#listeners.forEach((listener) => listener(snapshot));
  }
}

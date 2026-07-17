import type {
  LoadVideoRequest,
  VideoPlayerError,
  VideoPlayerEvent,
  VideoPlayerEventListener,
  VideoPlayerService,
  VideoPlayerState,
} from './VideoPlayerService';

export class FakeVideoPlayerService implements VideoPlayerService {
  readonly loadRequests: LoadVideoRequest[] = [];
  readonly seekRequests: number[] = [];
  playCallCount = 0;
  pauseCallCount = 0;
  destroyCallCount = 0;
  volume = 100;
  duration = 300;
  currentTime = 0;
  container?: HTMLElement | undefined;

  #state: VideoPlayerState = 'UNINITIALIZED';
  readonly #listeners = new Set<VideoPlayerEventListener>();

  async initialize(container: HTMLElement): Promise<void> {
    this.container = container;
    this.setState('READY');
    return Promise.resolve();
  }

  async load(request: LoadVideoRequest): Promise<void> {
    this.loadRequests.push({ ...request });
    this.currentTime = request.startSeconds;
    this.setState('CUED');
    return Promise.resolve();
  }

  play(): void {
    this.playCallCount += 1;
    this.setState('PLAYING');
  }

  pause(): void {
    this.pauseCallCount += 1;
    this.setState('PAUSED');
  }

  seek(seconds: number): void {
    this.seekRequests.push(seconds);
    this.currentTime = seconds;
  }

  getCurrentTime(): number {
    return this.currentTime;
  }

  getDuration(): number {
    return this.duration;
  }

  getState(): VideoPlayerState {
    return this.#state;
  }

  setVolume(volume: number): void {
    this.volume = volume;
  }

  subscribe(listener: VideoPlayerEventListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  destroy(): void {
    this.destroyCallCount += 1;
    this.setState('DESTROYED');
    this.#listeners.clear();
  }

  setCurrentTime(seconds: number): void {
    this.currentTime = seconds;
  }

  emitError(error: VideoPlayerError): void {
    this.#state = 'ERROR';
    this.emit({ type: 'ERROR', error });
  }

  private setState(state: VideoPlayerState): void {
    this.#state = state;
    this.emit({ type: 'STATE_CHANGED', state });
  }

  private emit(event: VideoPlayerEvent): void {
    this.#listeners.forEach((listener) => listener(event));
  }
}

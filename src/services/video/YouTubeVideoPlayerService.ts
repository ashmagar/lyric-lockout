import type {
  LoadVideoRequest,
  VideoPlayerError,
  VideoPlayerEvent,
  VideoPlayerEventListener,
  VideoPlayerService,
  VideoPlayerState,
} from './VideoPlayerService';

interface YouTubeEvent<T = undefined> {
  data: T;
}

interface YouTubePlayer {
  cueVideoById(request: { videoId: string; startSeconds: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  setVolume(volume: number): void;
  destroy(): void;
}

interface YouTubePlayerOptions {
  width: string;
  height: string;
  playerVars: {
    autoplay: 0;
    controls: 0;
    playsinline: 1;
    origin: string;
  };
  events: {
    onReady: () => void;
    onStateChange: (event: YouTubeEvent<number>) => void;
    onError: (event: YouTubeEvent<number>) => void;
    onAutoplayBlocked: () => void;
  };
}

interface YouTubeApi {
  Player: new (element: HTMLElement, options: YouTubePlayerOptions) => YouTubePlayer;
}

interface YouTubeWindow extends Window {
  YT?: YouTubeApi | undefined;
  onYouTubeIframeAPIReady?: (() => void) | undefined;
}

const API_SCRIPT_ID = 'youtube-iframe-api';
const API_SCRIPT_SOURCE = 'https://www.youtube.com/iframe_api';
let apiPromise: Promise<YouTubeApi> | undefined;

function loadYouTubeApi(): Promise<YouTubeApi> {
  const youtubeWindow = window as YouTubeWindow;
  if (youtubeWindow.YT?.Player) return Promise.resolve(youtubeWindow.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    const previousReadyCallback = youtubeWindow.onYouTubeIframeAPIReady;
    youtubeWindow.onYouTubeIframeAPIReady = () => {
      try {
        previousReadyCallback?.();
      } finally {
        if (youtubeWindow.YT?.Player) {
          resolve(youtubeWindow.YT);
        } else {
          reject(new Error('YouTube IFrame API loaded without a Player constructor'));
        }
      }
    };

    const existingScript = document.getElementById(API_SCRIPT_ID);
    if (existingScript) return;

    const script = document.createElement('script');
    script.id = API_SCRIPT_ID;
    script.src = API_SCRIPT_SOURCE;
    script.async = true;
    script.addEventListener('error', () => {
      script.remove();
      reject(new Error('Unable to load the YouTube IFrame API'));
    });
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    apiPromise = undefined;
    throw error;
  });

  return apiPromise;
}

function mapYouTubeState(state: number): VideoPlayerState {
  switch (state) {
    case 0:
      return 'ENDED';
    case 1:
      return 'PLAYING';
    case 2:
      return 'PAUSED';
    case 3:
      return 'BUFFERING';
    case 5:
      return 'CUED';
    default:
      return 'READY';
  }
}

function mapYouTubeError(code: number): VideoPlayerError {
  switch (code) {
    case 2:
      return {
        code: 'INVALID_PARAMETER',
        message: 'YouTube rejected the video ID or another player parameter.',
        recoverable: true,
      };
    case 5:
      return {
        code: 'HTML5_ERROR',
        message: 'The requested video could not play in the HTML5 player.',
        recoverable: true,
      };
    case 100:
      return {
        code: 'VIDEO_NOT_FOUND',
        message: 'The YouTube video was removed, is private, or could not be found.',
        recoverable: false,
      };
    case 101:
    case 150:
      return {
        code: 'EMBEDDING_DISABLED',
        message: 'The video owner does not allow embedded playback.',
        recoverable: false,
      };
    case 153:
      return {
        code: 'CLIENT_IDENTITY_REQUIRED',
        message: 'YouTube could not identify the embedding client. Check the page origin.',
        recoverable: true,
      };
    default:
      return {
        code: 'UNKNOWN',
        message: `YouTube playback failed with an unrecognized error (${code}).`,
        recoverable: true,
      };
  }
}

export class YouTubeVideoPlayerService implements VideoPlayerService {
  readonly #listeners = new Set<VideoPlayerEventListener>();
  #player?: YouTubePlayer | undefined;
  #container?: HTMLElement | undefined;
  #state: VideoPlayerState = 'UNINITIALIZED';

  async initialize(container: HTMLElement): Promise<void> {
    if (this.#player) return;
    this.#container = container;
    container.replaceChildren();
    const mount = document.createElement('div');
    container.appendChild(mount);

    try {
      const youtube = await loadYouTubeApi();
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        this.#player = new youtube.Player(mount, {
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 0,
            controls: 0,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              settled = true;
              this.setState('READY');
              resolve();
            },
            onStateChange: (event) => this.setState(mapYouTubeState(event.data)),
            onError: (event) => {
              const error = mapYouTubeError(event.data);
              this.emitError(error);
              if (!settled) reject(new Error(error.message));
            },
            onAutoplayBlocked: () => {
              this.emitError({
                code: 'AUTOPLAY_BLOCKED',
                message:
                  'The browser blocked API playback. Try Play challenge again or use the play control inside the video.',
                recoverable: true,
              });
            },
          },
        });
      });
    } catch (error) {
      this.emitError({
        code: 'API_LOAD_FAILED',
        message: error instanceof Error ? error.message : 'Unable to initialize YouTube playback.',
        recoverable: true,
      });
      throw error;
    }
  }

  async load(request: LoadVideoRequest): Promise<void> {
    const player = this.requirePlayer();
    if (!request.videoId.trim() || request.startSeconds < 0) {
      throw new Error('A valid video ID and nonnegative start time are required');
    }
    player.cueVideoById({
      videoId: request.videoId,
      startSeconds: request.startSeconds,
    });
    return Promise.resolve();
  }

  play(): void {
    this.requirePlayer().playVideo();
  }

  pause(): void {
    this.requirePlayer().pauseVideo();
  }

  seek(seconds: number): void {
    if (seconds < 0) throw new Error('Seek time cannot be negative');
    this.requirePlayer().seekTo(seconds, true);
  }

  getCurrentTime(): number {
    return this.#player?.getCurrentTime() ?? 0;
  }

  getDuration(): number {
    return this.#player?.getDuration() ?? 0;
  }

  getState(): VideoPlayerState {
    return this.#state;
  }

  setVolume(volume: number): void {
    if (!Number.isFinite(volume) || volume < 0 || volume > 100) {
      throw new Error('Volume must be between 0 and 100');
    }
    this.requirePlayer().setVolume(volume);
  }

  subscribe(listener: VideoPlayerEventListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  destroy(): void {
    this.#player?.destroy();
    this.#player = undefined;
    this.#container?.replaceChildren();
    this.#container = undefined;
    this.setState('DESTROYED');
    this.#listeners.clear();
  }

  private requirePlayer(): YouTubePlayer {
    if (!this.#player) {
      const error: VideoPlayerError = {
        code: 'NOT_INITIALIZED',
        message: 'Initialize the video player before controlling playback.',
        recoverable: true,
      };
      this.emitError(error);
      throw new Error(error.message);
    }
    return this.#player;
  }

  private setState(state: VideoPlayerState): void {
    this.#state = state;
    this.emit({ type: 'STATE_CHANGED', state });
  }

  private emitError(error: VideoPlayerError): void {
    this.#state = 'ERROR';
    this.emit({ type: 'ERROR', error });
  }

  private emit(event: VideoPlayerEvent): void {
    this.#listeners.forEach((listener) => listener(event));
  }
}

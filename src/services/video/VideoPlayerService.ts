export const VIDEO_PLAYER_STATES = [
  'UNINITIALIZED',
  'READY',
  'CUED',
  'PLAYING',
  'PAUSED',
  'BUFFERING',
  'ENDED',
  'DESTROYED',
  'ERROR',
] as const;

export type VideoPlayerState = (typeof VIDEO_PLAYER_STATES)[number];

export type VideoPlayerErrorCode =
  | 'INVALID_PARAMETER'
  | 'HTML5_ERROR'
  | 'VIDEO_NOT_FOUND'
  | 'EMBEDDING_DISABLED'
  | 'CLIENT_IDENTITY_REQUIRED'
  | 'AUTOPLAY_BLOCKED'
  | 'API_LOAD_FAILED'
  | 'NOT_INITIALIZED'
  | 'UNKNOWN';

export interface VideoPlayerError {
  code: VideoPlayerErrorCode;
  message: string;
  recoverable: boolean;
}

export type VideoPlayerEvent =
  { type: 'STATE_CHANGED'; state: VideoPlayerState } | { type: 'ERROR'; error: VideoPlayerError };

export interface LoadVideoRequest {
  videoId: string;
  startSeconds: number;
}

export type VideoPlayerEventListener = (event: VideoPlayerEvent) => void;

export interface VideoPlayerService {
  initialize(container: HTMLElement): Promise<void>;
  load(request: LoadVideoRequest): Promise<void>;
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getState(): VideoPlayerState;
  setVolume(volume: number): void;
  subscribe(listener: VideoPlayerEventListener): () => void;
  destroy(): void;
}

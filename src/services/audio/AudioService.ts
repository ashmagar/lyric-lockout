export type AudioChannel = 'SUSPENSE' | 'EFFECTS';

export interface AudioAssetManifest {
  suspense: Readonly<Record<string, string>>;
  effects: Readonly<Record<string, string>>;
}

export interface AudioServiceError {
  operation: 'PRELOAD' | 'PLAY_SUSPENSE' | 'PLAY_EFFECT';
  channel: AudioChannel;
  assetId?: string | undefined;
  message: string;
  recoverable: true;
}

export type AudioServiceEvent =
  | { type: 'ERROR'; error: AudioServiceError }
  | { type: 'SUSPENSE_STARTED'; assetId: string }
  | { type: 'SUSPENSE_STOPPED' }
  | { type: 'EFFECT_PLAYED'; assetId: string };

export type AudioServiceEventListener = (event: AudioServiceEvent) => void;

export interface AudioService {
  preload(): Promise<void>;
  playSuspense(assetId: string): Promise<void>;
  stopSuspense(): void;
  playEffect(assetId: string): Promise<void>;
  setSuspenseVolume(volume: number): void;
  setEffectsVolume(volume: number): void;
  subscribe(listener: AudioServiceEventListener): () => void;
  dispose(): void;
}

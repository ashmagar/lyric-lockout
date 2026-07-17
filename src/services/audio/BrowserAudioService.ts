import type {
  AudioAssetManifest,
  AudioChannel,
  AudioService,
  AudioServiceError,
  AudioServiceEvent,
  AudioServiceEventListener,
} from './AudioService';

function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) throw new Error('Audio volume must be finite');
  return Math.min(1, Math.max(0, volume));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Browser audio playback failed';
}

export class BrowserAudioService implements AudioService {
  readonly #manifest: AudioAssetManifest;
  readonly #listeners = new Set<AudioServiceEventListener>();
  readonly #suspense = new Map<string, HTMLAudioElement>();
  readonly #effects = new Map<string, HTMLAudioElement>();
  #activeSuspense?: HTMLAudioElement | undefined;
  #suspenseVolume = 1;
  #effectsVolume = 1;
  #disposed = false;

  constructor(manifest: AudioAssetManifest) {
    this.#manifest = manifest;
  }

  async preload(): Promise<void> {
    this.assertActive();
    this.createAssets(this.#manifest.suspense, 'SUSPENSE', this.#suspense);
    this.createAssets(this.#manifest.effects, 'EFFECTS', this.#effects);
    return Promise.resolve();
  }

  async playSuspense(assetId: string): Promise<void> {
    this.assertActive();
    try {
      const audio = this.getAsset(this.#suspense, this.#manifest.suspense, assetId, 'SUSPENSE');
      this.stopSuspense();
      this.#activeSuspense = audio;
      audio.loop = true;
      audio.volume = this.#suspenseVolume;
      audio.currentTime = 0;
      await audio.play();
      this.emit({ type: 'SUSPENSE_STARTED', assetId });
    } catch (error) {
      this.#activeSuspense = undefined;
      this.reportFailure('PLAY_SUSPENSE', 'SUSPENSE', error, assetId);
    }
  }

  stopSuspense(): void {
    if (!this.#activeSuspense) return;
    this.#activeSuspense.pause();
    this.#activeSuspense.currentTime = 0;
    this.#activeSuspense = undefined;
    this.emit({ type: 'SUSPENSE_STOPPED' });
  }

  async playEffect(assetId: string): Promise<void> {
    this.assertActive();
    try {
      const source = this.getAsset(this.#effects, this.#manifest.effects, assetId, 'EFFECTS');
      const audio = source.cloneNode(true) as HTMLAudioElement;
      audio.volume = this.#effectsVolume;
      await audio.play();
      this.emit({ type: 'EFFECT_PLAYED', assetId });
    } catch (error) {
      this.reportFailure('PLAY_EFFECT', 'EFFECTS', error, assetId);
    }
  }

  setSuspenseVolume(volume: number): void {
    this.assertActive();
    this.#suspenseVolume = clampVolume(volume);
    if (this.#activeSuspense) this.#activeSuspense.volume = this.#suspenseVolume;
  }

  setEffectsVolume(volume: number): void {
    this.assertActive();
    this.#effectsVolume = clampVolume(volume);
    this.#effects.forEach((audio) => {
      audio.volume = this.#effectsVolume;
    });
  }

  subscribe(listener: AudioServiceEventListener): () => void {
    this.assertActive();
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.stopSuspense();
    [...this.#suspense.values(), ...this.#effects.values()].forEach((audio) => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    });
    this.#suspense.clear();
    this.#effects.clear();
    this.#listeners.clear();
    this.#disposed = true;
  }

  private createAssets(
    assets: Readonly<Record<string, string>>,
    channel: AudioChannel,
    destination: Map<string, HTMLAudioElement>,
  ): void {
    Object.entries(assets).forEach(([assetId, source]) => {
      if (destination.has(assetId)) return;
      try {
        const audio = new Audio(source);
        audio.preload = 'auto';
        audio.loop = channel === 'SUSPENSE';
        audio.volume = channel === 'SUSPENSE' ? this.#suspenseVolume : this.#effectsVolume;
        audio.addEventListener('error', () => {
          this.reportFailure('PRELOAD', channel, new Error(`Unable to preload ${source}`), assetId);
        });
        audio.load();
        destination.set(assetId, audio);
      } catch (error) {
        this.reportFailure('PRELOAD', channel, error, assetId);
      }
    });
  }

  private getAsset(
    loaded: Map<string, HTMLAudioElement>,
    manifest: Readonly<Record<string, string>>,
    assetId: string,
    channel: AudioChannel,
  ): HTMLAudioElement {
    const existing = loaded.get(assetId);
    if (existing) return existing;
    const source = manifest[assetId];
    if (!source) throw new Error(`Unknown ${channel.toLowerCase()} audio asset: ${assetId}`);
    this.createAssets({ [assetId]: source }, channel, loaded);
    const created = loaded.get(assetId);
    if (!created) throw new Error(`Unable to prepare audio asset: ${assetId}`);
    return created;
  }

  private reportFailure(
    operation: AudioServiceError['operation'],
    channel: AudioChannel,
    error: unknown,
    assetId?: string,
  ): void {
    this.emit({
      type: 'ERROR',
      error: {
        operation,
        channel,
        assetId,
        message: errorMessage(error),
        recoverable: true,
      },
    });
  }

  private emit(event: AudioServiceEvent): void {
    this.#listeners.forEach((listener) => listener(event));
  }

  private assertActive(): void {
    if (this.#disposed) throw new Error('Audio service is disposed');
  }
}

import type {
  AudioService,
  AudioServiceError,
  AudioServiceEvent,
  AudioServiceEventListener,
} from './AudioService';

export class FakeAudioService implements AudioService {
  preloadCallCount = 0;
  readonly suspensePlayRequests: string[] = [];
  readonly effectPlayRequests: string[] = [];
  stopSuspenseCallCount = 0;
  disposeCallCount = 0;
  suspenseVolume = 1;
  effectsVolume = 1;
  nextFailure?: AudioServiceError | undefined;

  readonly #listeners = new Set<AudioServiceEventListener>();

  async preload(): Promise<void> {
    this.preloadCallCount += 1;
    this.consumeFailure();
    return Promise.resolve();
  }

  async playSuspense(assetId: string): Promise<void> {
    this.suspensePlayRequests.push(assetId);
    if (!this.consumeFailure()) this.emit({ type: 'SUSPENSE_STARTED', assetId });
    return Promise.resolve();
  }

  stopSuspense(): void {
    this.stopSuspenseCallCount += 1;
    this.emit({ type: 'SUSPENSE_STOPPED' });
  }

  async playEffect(assetId: string): Promise<void> {
    this.effectPlayRequests.push(assetId);
    if (!this.consumeFailure()) this.emit({ type: 'EFFECT_PLAYED', assetId });
    return Promise.resolve();
  }

  setSuspenseVolume(volume: number): void {
    this.suspenseVolume = volume;
  }

  setEffectsVolume(volume: number): void {
    this.effectsVolume = volume;
  }

  subscribe(listener: AudioServiceEventListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  dispose(): void {
    this.disposeCallCount += 1;
    this.#listeners.clear();
  }

  failNext(error: AudioServiceError): void {
    this.nextFailure = error;
  }

  private consumeFailure(): boolean {
    if (!this.nextFailure) return false;
    const error = this.nextFailure;
    this.nextFailure = undefined;
    this.emit({ type: 'ERROR', error });
    return true;
  }

  private emit(event: AudioServiceEvent): void {
    this.#listeners.forEach((listener) => listener(event));
  }
}

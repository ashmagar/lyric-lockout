import { describe, expect, it } from 'vitest';

import { FakeAudioService, type AudioServiceError } from '../services/audio';

const PLAYBACK_FAILURE: AudioServiceError = {
  operation: 'PLAY_SUSPENSE',
  channel: 'SUSPENSE',
  assetId: 'countdown',
  message: 'Playback permission denied',
  recoverable: true,
};

describe('AudioService', () => {
  it('keeps suspense playback failures recoverable and non-blocking', async () => {
    const audio = new FakeAudioService();
    const errors: AudioServiceError[] = [];
    audio.subscribe((event) => {
      if (event.type === 'ERROR') errors.push(event.error);
    });
    audio.failNext(PLAYBACK_FAILURE);

    await expect(audio.playSuspense('countdown')).resolves.toBeUndefined();

    expect(audio.suspensePlayRequests).toEqual(['countdown']);
    expect(errors).toEqual([PLAYBACK_FAILURE]);
  });

  it('preloads, separates channel volumes, plays effects, and cleans up', async () => {
    const audio = new FakeAudioService();

    await audio.preload();
    audio.setSuspenseVolume(0.35);
    audio.setEffectsVolume(0.8);
    await audio.playEffect('correct');
    audio.stopSuspense();
    audio.dispose();

    expect(audio.preloadCallCount).toBe(1);
    expect(audio.suspenseVolume).toBe(0.35);
    expect(audio.effectsVolume).toBe(0.8);
    expect(audio.effectPlayRequests).toEqual(['correct']);
    expect(audio.stopSuspenseCallCount).toBe(1);
    expect(audio.disposeCallCount).toBe(1);
  });
});

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GameplayVideoStage } from '../features/game/GameplayVideoStage';
import { resetRuntimeCatalog } from '../features/game/runtimeCatalog';
import { configureGameplayRepository, useGameplayStore } from '../store/gameplayStore';

interface YouTubePlayerEvents {
  onReady: () => void;
  onStateChange: (event: { data: number }) => void;
  onError: (event: { data: number }) => void;
  onAutoplayBlocked: () => void;
}

describe('GameplayVideoStage', () => {
  beforeEach(() => {
    localStorage.clear();
    configureGameplayRepository(undefined);
    resetRuntimeCatalog();
    useGameplayStore.getState().reset();
  });

  it('waits for confirmed YouTube playback and exposes native controls', async () => {
    let playerEvents: YouTubePlayerEvents | undefined;
    let playerVars: { controls?: number } | undefined;
    const playVideo = vi.fn();

    class MockYouTubePlayer {
      constructor(
        _element: HTMLElement,
        options: {
          playerVars: { controls?: number };
          events: YouTubePlayerEvents;
        },
      ) {
        playerEvents = options.events;
        playerVars = options.playerVars;
        queueMicrotask(options.events.onReady);
      }

      cueVideoById = vi.fn();
      playVideo = playVideo;
      pauseVideo = vi.fn();
      seekTo = vi.fn();
      getCurrentTime() {
        return 5;
      }
      getDuration() {
        return 120;
      }
      setVolume = vi.fn();
      destroy = vi.fn();
    }

    Object.defineProperty(window, 'YT', {
      configurable: true,
      value: { Player: MockYouTubePlayer },
    });

    const store = useGameplayStore.getState();
    store.startSetup('Alpha', 'Beta');
    useGameplayStore.getState().send({ type: 'VALIDATE_ROUND' });
    useGameplayStore.getState().send({ type: 'START_GAME' });
    useGameplayStore.getState().chooseFirstTeam('team-a');
    useGameplayStore.getState().assignCategory('90s-bollywood', 'SELF_SELECTED');
    useGameplayStore.getState().selectChallenge();
    useGameplayStore.getState().send({ type: 'CONFIRM_CHALLENGE' });
    useGameplayStore.getState().send({ type: 'MARK_VIDEO_READY' });
    const session = useGameplayStore.getState().session;
    if (!session) throw new Error('Expected a video-ready game session');

    const onPlay = vi.fn(() => true);
    render(
      <GameplayVideoStage
        fakeMedia={false}
        onCompleteVerification={vi.fn()}
        onPaused={vi.fn()}
        onPlay={onPlay}
        onReady={vi.fn()}
        session={session}
      />,
    );

    await waitFor(() => expect(playerEvents).toBeDefined());
    expect(playerVars?.controls).toBe(1);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Play challenge' }));
    expect(playVideo).toHaveBeenCalledOnce();
    expect(onPlay).not.toHaveBeenCalled();

    act(() => {
      playerEvents?.onStateChange({ data: 1 });
    });
    expect(onPlay).toHaveBeenCalledOnce();
  });
});

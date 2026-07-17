import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PlaybackSpikePage } from '../features/playback-spike/PlaybackSpikePage';
import { FakeVideoPlayerService, type PollingScheduler } from '../services/video';

class ManualPollingScheduler implements PollingScheduler {
  readonly #tasks = new Set<() => void>();

  scheduleRepeating(task: () => void): () => void {
    this.#tasks.add(task);
    return () => this.#tasks.delete(task);
  }

  run(): void {
    [...this.#tasks].forEach((task) => task());
  }
}

describe('PlaybackSpikePage', () => {
  it('requires host interaction and displays measured pause diagnostics', async () => {
    const player = new FakeVideoPlayerService();
    const scheduler = new ManualPollingScheduler();
    const user = userEvent.setup();
    render(<PlaybackSpikePage createPlayer={() => player} scheduler={scheduler} />);

    await waitFor(() => expect(player.loadRequests).toHaveLength(1));
    expect(player.playCallCount).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Play challenge' }));
    expect(player.playCallCount).toBe(1);
    expect(player.seekRequests.at(-1)).toBe(5);

    act(() => {
      player.setCurrentTime(9.9);
      scheduler.run();
    });
    expect(player.pauseCallCount).toBe(1);
    expect(screen.getAllByText('9.90s')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Replay verification' }));
    expect(player.seekRequests.at(-1)).toBe(7);
    act(() => {
      player.setCurrentTime(12);
      scheduler.run();
    });
    expect(player.pauseCallCount).toBe(2);
    expect(screen.getByText('VERIFICATION_COMPLETE')).toBeInTheDocument();
  });

  it('shows normalized errors and exposes Retry', async () => {
    const player = new FakeVideoPlayerService();
    const user = userEvent.setup();
    render(
      <PlaybackSpikePage createPlayer={() => player} scheduler={new ManualPollingScheduler()} />,
    );
    await waitFor(() => expect(player.loadRequests).toHaveLength(1));

    act(() => {
      player.emitError({
        code: 'EMBEDDING_DISABLED',
        message: 'Embedding is disabled for this video.',
        recoverable: false,
      });
    });

    expect(screen.getByRole('alert')).toHaveTextContent('EMBEDDING_DISABLED');
    await user.click(screen.getByRole('button', { name: 'Retry load' }));
    await waitFor(() => expect(player.loadRequests).toHaveLength(2));
    expect(player.playCallCount).toBe(0);
  });
});

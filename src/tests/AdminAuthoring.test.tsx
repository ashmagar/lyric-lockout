import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createChallengeDraft,
  createSongDraft,
  parseYouTubeVideoId,
  type Category,
  type Song,
} from '../domain';
import { AdminChallengePreview } from '../features/admin/AdminChallengePreview';
import { SongEditor } from '../features/admin/SongEditor';
import {
  ADMIN_ADDITIONAL_BATCH_SIZE,
  ADMIN_INITIAL_BATCH_SIZE,
  useContinuousList,
} from '../features/admin/useContinuousList';
import { songSchema } from '../schemas';
import { FakeVideoPlayerService, type PollingScheduler } from '../services/video';

const TIMESTAMP = '2026-07-17T08:00:00.000Z';
const CATEGORY: Category = {
  id: 'party-songs',
  schemaVersion: 1,
  name: 'Party Songs',
  displayOrder: 1,
  enabled: true,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
};

function validSong(id = 'song-one'): Song {
  return {
    ...createSongDraft({
      id,
      title: 'Test Anthem',
      artist: 'Test Artist',
      youtubeVideoId: 'M7lc1UVf-VE',
      createdAt: TIMESTAMP,
    }),
    categoryIds: [CATEGORY.id],
    challenges: [
      {
        ...createChallengeDraft(`challenge-${id}`, 1, TIMESTAMP),
        playbackStartSeconds: 5,
        verifyFromSeconds: 7,
        pauseAtSeconds: 10,
        verifyToSeconds: 12,
      },
    ],
  };
}

class ManualScheduler implements PollingScheduler {
  tasks = new Set<() => void>();
  scheduleRepeating(task: () => void) {
    this.tasks.add(task);
    return () => this.tasks.delete(task);
  }
  run() {
    this.tasks.forEach((task) => task());
  }
}

class MockIntersectionObserver implements IntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds = [0];
  constructor(private readonly callback: IntersectionObserverCallback) {
    MockIntersectionObserver.instances.push(this);
  }
  disconnect = vi.fn();
  observe = vi.fn();
  takeRecords = () => [];
  unobserve = vi.fn();
  trigger() {
    this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this);
  }
}

function ContinuousHarness({ items, resetKey }: { items: number[]; resetKey: string }) {
  const list = useContinuousList(items, resetKey);
  return (
    <>
      <output aria-label="rendered count">{list.visibleItems.length}</output>
      <div ref={list.sentinelRef} />
    </>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  MockIntersectionObserver.instances = [];
});

describe('Admin authoring domain and editor', () => {
  it.each([
    ['M7lc1UVf-VE', 'M7lc1UVf-VE'],
    ['https://www.youtube.com/watch?v=M7lc1UVf-VE', 'M7lc1UVf-VE'],
    ['https://youtu.be/M7lc1UVf-VE?t=4', 'M7lc1UVf-VE'],
    ['https://youtube.com/embed/M7lc1UVf-VE', 'M7lc1UVf-VE'],
  ])('parses YouTube input %s', (input, expected) => {
    expect(parseYouTubeVideoId(input)).toEqual({ ok: true, videoId: expected });
  });

  it('rejects invalid and lookalike YouTube URLs', () => {
    expect(parseYouTubeVideoId('not a url')).toMatchObject({ ok: false });
    expect(parseYouTubeVideoId('https://youtube.com.example/watch?v=M7lc1UVf-VE')).toMatchObject({
      ok: false,
    });
  });

  it('rejects invalid timestamp ordering', () => {
    const song = validSong();
    song.challenges[0]!.pauseAtSeconds = 4;

    const result = songSchema.safeParse(song);

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected invalid timestamp ordering');
    expect(result.error.issues.map((issue) => issue.message)).toContain(
      'Pause time must be after playback start time',
    );
  });

  it('keeps an unsaved form draft when the API save fails', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(false);
    render(
      <SongEditor
        categories={[CATEGORY]}
        fakeMedia
        initialSong={validSong()}
        nextId={(prefix) => `${prefix}-new`}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    const title = screen.getByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.type(title, 'Retained Draft Title');
    await user.click(screen.getByRole('button', { name: 'Save song' }));

    expect(onSave).toHaveBeenCalled();
    expect(title).toHaveValue('Retained Draft Title');
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('runs preview through the real playback lifecycle and reports pause deviation', async () => {
    const player = new FakeVideoPlayerService();
    const scheduler = new ManualScheduler();
    const user = userEvent.setup();
    const song = validSong();
    render(
      <AdminChallengePreview
        challenge={song.challenges[0]!}
        createPlayer={() => player}
        scheduler={scheduler}
        song={song}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Play challenge preview' }));
    act(() => {
      player.setCurrentTime(10.05);
      scheduler.run();
    });

    expect(player.pauseCallCount).toBe(1);
    expect(screen.getByText('PAUSED_AT_CHALLENGE')).toBeInTheDocument();
    expect(screen.getByText('0.05s')).toBeInTheDocument();
  });
});

describe('Admin continuous scrolling', () => {
  it('renders 40 initially, adds 30 at the sentinel, and resets on filter change', () => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    const items = Array.from({ length: 100 }, (_, index) => index);
    const { rerender } = render(<ContinuousHarness items={items} resetKey="all" />);
    expect(screen.getByLabelText('rendered count')).toHaveTextContent(
      String(ADMIN_INITIAL_BATCH_SIZE),
    );

    act(() => MockIntersectionObserver.instances.at(-1)?.trigger());
    expect(screen.getByLabelText('rendered count')).toHaveTextContent(
      String(ADMIN_INITIAL_BATCH_SIZE + ADMIN_ADDITIONAL_BATCH_SIZE),
    );

    rerender(<ContinuousHarness items={items} resetKey="filtered" />);
    expect(screen.getByLabelText('rendered count')).toHaveTextContent(
      String(ADMIN_INITIAL_BATCH_SIZE),
    );
  });
});

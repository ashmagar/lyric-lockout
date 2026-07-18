import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createCategoryDraft,
  createChallengeDraft,
  createSongDraft,
  duplicateChallenge,
  parseYouTubeVideoId,
  type Category,
  type Song,
} from '../domain';
import { AdminChallengePreview } from '../features/admin/AdminChallengePreview';
import { CategoryEditor } from '../features/admin/CategoryEditor';
import { SongEditor } from '../features/admin/SongEditor';
import {
  ADMIN_ADDITIONAL_BATCH_SIZE,
  ADMIN_INITIAL_BATCH_SIZE,
  useContinuousList,
} from '../features/admin/useContinuousList';
import { songSchema } from '../schemas';
import { FakeVideoPlayerService, type PollingScheduler } from '../services/video';
import { resolveCategoryIcon } from '../utils/categoryIcon';

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
  it('resolves catalog icon keys while preserving custom emoji', () => {
    expect(resolveCategoryIcon('cassette')).toBe('📼');
    expect(resolveCategoryIcon('microphone')).toBe('🎤');
    expect(resolveCategoryIcon('🛣️')).toBe('🛣️');
    expect(resolveCategoryIcon(undefined)).toBe('♪');
  });

  it('creates a category draft with a stable generated identity', () => {
    expect(
      createCategoryDraft({
        id: 'category-stable-id',
        displayOrder: 11,
        createdAt: TIMESTAMP,
      }),
    ).toMatchObject({
      id: 'category-stable-id',
      name: '',
      displayOrder: 11,
      enabled: true,
    });
  });

  it('duplicates every authored challenge value with a new stable identity', () => {
    const source = validSong().challenges[0]!;
    const duplicatedAt = '2026-07-18T10:00:00.000Z';
    const duplicate = duplicateChallenge(source, 'challenge-copy', duplicatedAt);

    expect(duplicate).toEqual({
      ...source,
      id: 'challenge-copy',
      hiddenWordIndexes: source.hiddenWordIndexes,
      createdAt: duplicatedAt,
      updatedAt: duplicatedAt,
    });
    expect(duplicate.hiddenWordIndexes).not.toBe(source.hiddenWordIndexes);
    expect(duplicate).toMatchObject({
      playbackStartSeconds: source.playbackStartSeconds,
      verifyFromSeconds: source.verifyFromSeconds,
      pauseAtSeconds: source.pauseAtSeconds,
      verifyToSeconds: source.verifyToSeconds,
      expectedLyrics: source.expectedLyrics,
      hiddenWordIndexes: source.hiddenWordIndexes,
      hintText: source.hintText,
      difficulty: source.difficulty,
      enabled: source.enabled,
    });
  });

  it('validates category fields before calling the save boundary', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
    render(
      <CategoryEditor
        categories={[CATEGORY]}
        initialCategory={createCategoryDraft({
          id: 'new-category',
          displayOrder: 2,
          createdAt: TIMESTAMP,
        })}
        isNew
        onCancel={vi.fn()}
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Save category' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Value must not be blank');
  });

  it('saves category edits with the original ID and cancel discards local changes', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
    const onCancel = vi.fn();
    const { rerender } = render(
      <CategoryEditor
        categories={[CATEGORY]}
        initialCategory={CATEGORY}
        isNew={false}
        onCancel={onCancel}
        onSave={onSave}
      />,
    );

    const name = screen.getByRole('textbox', { name: 'Display name' });
    await user.clear(name);
    await user.type(name, 'Celebration Songs');
    await user.click(screen.getByRole('button', { name: 'Save category' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: CATEGORY.id, name: 'Celebration Songs' }),
      false,
    );
    expect(CATEGORY.name).toBe('Party Songs');

    rerender(
      <CategoryEditor
        categories={[CATEGORY]}
        initialCategory={CATEGORY}
        isNew={false}
        onCancel={onCancel}
        onSave={onSave}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    expect(CATEGORY.name).toBe('Party Songs');
  });

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

  it('duplicates the selected challenge and saves both independent records', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
    const source = validSong();
    render(
      <SongEditor
        categories={[CATEGORY]}
        fakeMedia
        initialSong={source}
        nextId={(prefix) => `${prefix}-copy`}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Duplicate selected challenge' }));

    expect(screen.getByRole('button', { name: 'Level 1 challenge 1' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Level 1 challenge 2' }).className).toContain(
      'activeChallenge',
    );
    expect(screen.getByRole('textbox', { name: 'Challenge ID' })).toHaveValue('challenge-copy');
    expect(screen.getByRole('spinbutton', { name: 'Playback start' })).toHaveValue(5);
    expect(screen.getByRole('spinbutton', { name: 'Verification start' })).toHaveValue(7);
    expect(screen.getByRole('spinbutton', { name: 'Challenge pause' })).toHaveValue(10);
    expect(screen.getByRole('spinbutton', { name: 'Verification end' })).toHaveValue(12);

    await user.click(screen.getByRole('button', { name: 'Save song' }));

    const savedSong = onSave.mock.calls[0]?.[0] as Song;
    expect(savedSong.challenges).toHaveLength(2);
    const originalChallenge = savedSong.challenges[0]!;
    const copiedChallenge = savedSong.challenges[1]!;
    expect(savedSong.challenges[1]).toMatchObject({
      id: 'challenge-copy',
      difficulty: originalChallenge.difficulty,
      playbackStartSeconds: originalChallenge.playbackStartSeconds,
      verifyFromSeconds: originalChallenge.verifyFromSeconds,
      pauseAtSeconds: originalChallenge.pauseAtSeconds,
      verifyToSeconds: originalChallenge.verifyToSeconds,
      expectedLyrics: originalChallenge.expectedLyrics,
      hiddenWordIndexes: originalChallenge.hiddenWordIndexes,
      missingWordCount: originalChallenge.missingWordCount,
      hintText: originalChallenge.hintText,
      enabled: originalChallenge.enabled,
    });
    expect(copiedChallenge.createdAt).not.toBe(originalChallenge.createdAt);
    expect(copiedChallenge.updatedAt).toBe(copiedChallenge.createdAt);
    expect(copiedChallenge.hiddenWordIndexes).not.toBe(originalChallenge.hiddenWordIndexes);
  });

  it('clears stale hidden indexes after lyric edits and saves independently selected words', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
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

    const lyrics = screen.getByRole('textbox', { name: 'Acceptable lyrics' });
    await user.clear(lyrics);
    await user.type(lyrics, "Maybe this time I'll be lucky!");

    expect(screen.getByLabelText('Hidden word count')).toHaveTextContent('0 hidden words');
    expect(screen.getByRole('alert')).toHaveTextContent('Select at least one hidden word');

    await user.click(screen.getByRole('button', { name: 'Word 2: this' }));
    await user.click(screen.getByRole('button', { name: 'Word 6: lucky!' }));

    expect(screen.getByLabelText('Hidden word count')).toHaveTextContent('2 hidden words');
    expect(within(screen.getByLabelText('Lyric puzzle display')).getAllByText('____')).toHaveLength(
      2,
    );

    await user.click(screen.getByRole('button', { name: 'Save song' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        challenges: [
          expect.objectContaining({
            expectedLyrics: "Maybe this time I'll be lucky!",
            hiddenWordIndexes: [1, 5],
            missingWordCount: 2,
          }),
        ],
      }),
    );
  });

  it('jumps five seconds before the challenge through the real pause lifecycle', async () => {
    const player = new FakeVideoPlayerService();
    const scheduler = new ManualScheduler();
    const user = userEvent.setup();
    const song = validSong();
    song.challenges[0]!.pauseAtSeconds = 65;
    song.challenges[0]!.verifyToSeconds = 67;
    render(
      <AdminChallengePreview
        challenge={song.challenges[0]!}
        createPlayer={() => player}
        scheduler={scheduler}
        song={song}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Jump to challenge (-5s)' }));

    expect(player.seekRequests).toEqual([60]);
    expect(
      within(screen.getByText('Requested start').parentElement!).getByText('60.00s'),
    ).toBeInTheDocument();
    expect(screen.getByText('PLAYING_CHALLENGE')).toBeInTheDocument();

    act(() => {
      player.setCurrentTime(65.05);
      scheduler.run();
    });

    expect(player.pauseCallCount).toBe(1);
    expect(screen.getByText('PAUSED_AT_CHALLENGE')).toBeInTheDocument();
    expect(screen.getByText('0.05s')).toBeInTheDocument();
  });

  it('shows a useful error when the challenge pause is beyond the video duration', async () => {
    const player = new FakeVideoPlayerService();
    player.duration = 50;
    const user = userEvent.setup();
    const song = validSong();
    song.challenges[0]!.pauseAtSeconds = 65;
    song.challenges[0]!.verifyToSeconds = 67;
    render(
      <AdminChallengePreview
        challenge={song.challenges[0]!}
        createPlayer={() => player}
        scheduler={new ManualScheduler()}
        song={song}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Jump to challenge (-5s)' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Challenge pause 65.00s is beyond the 50.00s video duration.',
    );
    expect(screen.getByRole('button', { name: 'Retry preview' })).toBeVisible();
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

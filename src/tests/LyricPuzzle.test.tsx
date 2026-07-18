import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LyricPuzzle } from '../components/LyricPuzzle/LyricPuzzle';
import {
  allLyricWordIndexes,
  isLyricWordToken,
  tokenizeLyrics,
  withExplicitHiddenWordSelection,
  type Challenge,
} from '../domain';

const TIMESTAMP = '2026-07-17T08:00:00.000Z';

function challenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: 'challenge-lyrics',
    difficulty: 1,
    playbackStartSeconds: 5,
    verifyFromSeconds: 7,
    pauseAtSeconds: 10,
    verifyToSeconds: 12,
    expectedLyrics: "Maybe this time I'll be lucky!",
    missingWordCount: 2,
    hintText: 'Try the chorus',
    enabled: true,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

describe('lyric tokenization', () => {
  it('keeps punctuation and apostrophes attached while indexing repeated words independently', () => {
    const tokens = tokenizeLyrics("Oh, oh... I'll go!");
    const words = tokens.filter(isLyricWordToken);

    expect(words).toEqual([
      { prefix: '', text: 'Oh', suffix: ',', wordIndex: 0 },
      { prefix: '', text: 'oh', suffix: '...', wordIndex: 1 },
      { prefix: '', text: "I'll", suffix: '', wordIndex: 2 },
      { prefix: '', text: 'go', suffix: '!', wordIndex: 3 },
    ]);
  });

  it('does not count standalone punctuation as a selectable word', () => {
    expect(allLyricWordIndexes('Wait ... for me')).toEqual([0, 1, 2]);
  });

  it('migrates a legacy challenge to an explicit all-hidden selection', () => {
    expect(
      withExplicitHiddenWordSelection(
        challenge({ hiddenWordIndexes: undefined, missingWordCount: 1 }),
      ),
    ).toMatchObject({
      hiddenWordIndexes: [0, 1, 2, 3, 4, 5],
      missingWordCount: 6,
    });
  });
});

describe('LyricPuzzle', () => {
  it('renders non-contiguous hidden words as individual fixed blanks', () => {
    render(
      <LyricPuzzle expectedLyrics="Maybe this time I'll be lucky!" hiddenWordIndexes={[1, 2, 5]} />,
    );

    const puzzle = screen.getByLabelText('Lyrics to complete');
    expect(within(puzzle).getAllByText('____')).toHaveLength(3);
    expect(within(puzzle).getByText('Maybe')).toBeVisible();
    expect(within(puzzle).getByText("I'll")).toBeVisible();
    expect(within(puzzle).getByLabelText('Missing word 2')).toBeVisible();
    expect(within(puzzle).getByLabelText('Missing word 6')).toHaveTextContent('____');
  });

  it('renders one blank per word for explicit and legacy all-hidden challenges', () => {
    const { rerender } = render(
      <LyricPuzzle expectedLyrics="One two three" hiddenWordIndexes={[0, 1, 2]} />,
    );
    expect(screen.getAllByText('____')).toHaveLength(3);

    rerender(<LyricPuzzle expectedLyrics="One two three" />);
    expect(screen.getAllByText('____')).toHaveLength(3);
  });
});

import type { Challenge } from '../models/catalog';

export interface LyricWordToken {
  prefix: string;
  text: string;
  suffix: string;
  wordIndex: number;
}

export interface LyricPunctuationToken {
  text: string;
}

export type LyricToken = LyricWordToken | LyricPunctuationToken;

const WORD_BOUNDARIES = /^([^\p{L}\p{N}]*)(.*?[\p{L}\p{N}])([^\p{L}\p{N}]*)$/u;

export function isLyricWordToken(token: LyricToken): token is LyricWordToken {
  return 'wordIndex' in token;
}

export function tokenizeLyrics(lyrics: string): LyricToken[] {
  let wordIndex = 0;

  return lyrics
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .map((chunk) => {
      const match = WORD_BOUNDARIES.exec(chunk);
      if (!match) return { text: chunk };

      const token: LyricWordToken = {
        prefix: match[1] ?? '',
        text: match[2] ?? '',
        suffix: match[3] ?? '',
        wordIndex,
      };
      wordIndex += 1;
      return token;
    });
}

export function countLyricWords(lyrics: string): number {
  return tokenizeLyrics(lyrics).filter(isLyricWordToken).length;
}

export function allLyricWordIndexes(lyrics: string): number[] {
  return Array.from({ length: countLyricWords(lyrics) }, (_, index) => index);
}

export function resolveHiddenWordIndexes(
  expectedLyrics: string,
  hiddenWordIndexes: readonly number[] | undefined,
): readonly number[] {
  return hiddenWordIndexes ?? allLyricWordIndexes(expectedLyrics);
}

export function withExplicitHiddenWordSelection(challenge: Challenge): Challenge {
  if (challenge.hiddenWordIndexes !== undefined) {
    return {
      ...challenge,
      hiddenWordIndexes: [...challenge.hiddenWordIndexes],
    };
  }

  const hiddenWordIndexes = allLyricWordIndexes(challenge.expectedLyrics);
  return {
    ...challenge,
    hiddenWordIndexes,
    missingWordCount: hiddenWordIndexes.length,
  };
}

import { SCHEMA_VERSIONS } from '../constants';
import type { DifficultyLevel } from '../enums';
import type { Category, Challenge, Song } from '../models/catalog';

export type YouTubeParseResult = { ok: true; videoId: string } | { ok: false; message: string };

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTubeVideoId(input: string): YouTubeParseResult {
  const trimmed = input.trim();
  if (YOUTUBE_ID_PATTERN.test(trimmed)) return { ok: true, videoId: trimmed };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, message: 'Enter a valid YouTube URL or 11-character video ID.' };
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  let candidate: string | null = null;
  if (host === 'youtu.be') {
    candidate = url.pathname.split('/').find(Boolean) ?? null;
  } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (url.pathname === '/watch') {
      candidate = url.searchParams.get('v');
    } else {
      const [kind, id] = url.pathname.split('/').filter(Boolean);
      if (kind === 'embed' || kind === 'shorts' || kind === 'live') candidate = id ?? null;
    }
  }

  return candidate && YOUTUBE_ID_PATTERN.test(candidate)
    ? { ok: true, videoId: candidate }
    : { ok: false, message: 'The URL does not contain a valid YouTube video ID.' };
}

export interface CreateSongDraftInput {
  id: string;
  title: string;
  artist: string;
  youtubeVideoId: string;
  createdAt: string;
}

export interface CreateCategoryDraftInput {
  id: string;
  displayOrder: number;
  createdAt: string;
}

export function createCategoryDraft(input: CreateCategoryDraftInput): Category {
  return {
    id: input.id,
    schemaVersion: SCHEMA_VERSIONS.category,
    name: '',
    displayOrder: input.displayOrder,
    enabled: true,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
}

export function createSongDraft(input: CreateSongDraftInput): Song {
  return {
    id: input.id,
    schemaVersion: SCHEMA_VERSIONS.song,
    title: input.title,
    artist: input.artist,
    youtubeVideoId: input.youtubeVideoId,
    videoType: 'LYRIC',
    categoryIds: [],
    enabled: false,
    challenges: [],
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
}

export function createChallengeDraft(
  id: string,
  difficulty: DifficultyLevel,
  createdAt: string,
): Challenge {
  return {
    id,
    difficulty,
    playbackStartSeconds: 0,
    verifyFromSeconds: 0,
    pauseAtSeconds: 1,
    verifyToSeconds: 2,
    expectedLyrics: 'Enter the expected lyrics',
    hiddenWordIndexes: [0, 1, 2, 3],
    missingWordCount: 4,
    hintText: 'Enter a helpful hint',
    enabled: false,
    createdAt,
    updatedAt: createdAt,
  };
}

export function duplicateSong(
  source: Song,
  songId: string,
  challengeIds: readonly string[],
  duplicatedAt: string,
): Song {
  return {
    ...source,
    id: songId,
    title: `${source.title} Copy`,
    enabled: false,
    categoryIds: [...source.categoryIds],
    challenges: source.challenges.map((challenge, index) => ({
      ...challenge,
      id: challengeIds[index] ?? `${songId}-challenge-${index + 1}`,
      enabled: false,
      createdAt: duplicatedAt,
      updatedAt: duplicatedAt,
    })),
    createdAt: duplicatedAt,
    updatedAt: duplicatedAt,
  };
}

export interface SongAuthoringIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
  path?: string | undefined;
}

export function validateSongReferences(
  song: Song,
  categories: readonly Category[],
  otherSongs: readonly Song[],
): SongAuthoringIssue[] {
  const issues: SongAuthoringIssue[] = [];
  const categoryIds = new Set(categories.map((category) => category.id));
  const unknownCategories = song.categoryIds.filter((categoryId) => !categoryIds.has(categoryId));
  if (unknownCategories.length > 0) {
    issues.push({
      code: 'UNKNOWN_CATEGORY_REFERENCE',
      severity: 'ERROR',
      message: `Unknown categories: ${unknownCategories.join(', ')}`,
      path: 'categoryIds',
    });
  }
  if (new Set(song.categoryIds).size !== song.categoryIds.length) {
    issues.push({
      code: 'DUPLICATE_SONG_CATEGORY',
      severity: 'ERROR',
      message: 'A category may only be assigned once.',
      path: 'categoryIds',
    });
  }

  const otherChallengeIds = new Set(
    otherSongs
      .filter((candidate) => candidate.id !== song.id)
      .flatMap((candidate) => candidate.challenges.map((challenge) => challenge.id)),
  );
  const localChallengeIds = new Set<string>();
  song.challenges.forEach((challenge, index) => {
    if (localChallengeIds.has(challenge.id) || otherChallengeIds.has(challenge.id)) {
      issues.push({
        code: 'DUPLICATE_CHALLENGE_ID',
        severity: 'ERROR',
        message: `Challenge ID "${challenge.id}" is already in use.`,
        path: `challenges.${index}.id`,
      });
    }
    localChallengeIds.add(challenge.id);
  });

  if (song.enabled && song.challenges.every((challenge) => !challenge.enabled)) {
    issues.push({
      code: 'ENABLED_SONG_WITHOUT_ENABLED_CHALLENGE',
      severity: 'WARNING',
      message: 'This enabled song has no enabled challenges and cannot be selected.',
      path: 'challenges',
    });
  }
  return issues;
}

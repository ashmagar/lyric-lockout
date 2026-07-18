import { z } from 'zod';

import { SCHEMA_VERSIONS } from '../domain/constants';
import { countLyricWords } from '../domain/catalog/lyrics';
import type { CatalogData, Category, Challenge, Song } from '../domain/models/catalog';
import {
  difficultyLevelSchema,
  idSchema,
  nonBlankStringSchema,
  nonNegativeIntegerSchema,
  timestampSchema,
  videoTypeSchema,
} from './common';

export const challengeSchema: z.ZodType<Challenge> = z
  .object({
    id: idSchema,
    difficulty: difficultyLevelSchema,
    playbackStartSeconds: z.number().nonnegative(),
    pauseAtSeconds: z.number().nonnegative(),
    verifyFromSeconds: z.number().nonnegative(),
    verifyToSeconds: z.number().nonnegative().optional(),
    expectedLyrics: nonBlankStringSchema,
    hiddenWordIndexes: z.array(z.number().int().nonnegative()).min(1).optional(),
    missingWordCount: z.number().int().positive(),
    hintText: nonBlankStringSchema,
    enabled: z.boolean(),
    notes: nonBlankStringSchema.optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .superRefine((challenge, context) => {
    const lyricWordCount = countLyricWords(challenge.expectedLyrics);
    if (lyricWordCount === 0) {
      context.addIssue({
        code: 'custom',
        path: ['expectedLyrics'],
        message: 'Expected lyrics must contain at least one word',
      });
    }

    if (challenge.hiddenWordIndexes !== undefined) {
      const uniqueIndexes = new Set(challenge.hiddenWordIndexes);
      if (uniqueIndexes.size !== challenge.hiddenWordIndexes.length) {
        context.addIssue({
          code: 'custom',
          path: ['hiddenWordIndexes'],
          message: 'Hidden word selection cannot contain duplicate indexes',
        });
      }

      challenge.hiddenWordIndexes.forEach((index, selectionIndex) => {
        if (index >= lyricWordCount) {
          context.addIssue({
            code: 'custom',
            path: ['hiddenWordIndexes', selectionIndex],
            message: `Hidden word index ${index} is outside the expected lyrics`,
          });
        }
      });

      if (challenge.missingWordCount !== challenge.hiddenWordIndexes.length) {
        context.addIssue({
          code: 'custom',
          path: ['missingWordCount'],
          message: 'Missing word count must match the hidden word selection',
        });
      }
    }

    if (challenge.pauseAtSeconds <= challenge.playbackStartSeconds) {
      context.addIssue({
        code: 'custom',
        path: ['pauseAtSeconds'],
        message: 'Pause time must be after playback start time',
      });
    }

    if (challenge.pauseAtSeconds <= challenge.verifyFromSeconds) {
      context.addIssue({
        code: 'custom',
        path: ['pauseAtSeconds'],
        message: 'Pause time must be after verification start time',
      });
    }

    if (
      challenge.verifyToSeconds !== undefined &&
      challenge.verifyToSeconds <= challenge.pauseAtSeconds
    ) {
      context.addIssue({
        code: 'custom',
        path: ['verifyToSeconds'],
        message: 'Verification end time must be after pause time',
      });
    }
  });

export const songSchema: z.ZodType<Song> = z.object({
  id: idSchema,
  schemaVersion: z.literal(SCHEMA_VERSIONS.song),
  title: nonBlankStringSchema,
  artist: nonBlankStringSchema,
  youtubeVideoId: nonBlankStringSchema,
  videoType: videoTypeSchema,
  categoryIds: z.array(idSchema),
  language: nonBlankStringSchema.optional(),
  releaseYear: z.number().int().positive().optional(),
  movieOrAlbum: nonBlankStringSchema.optional(),
  thumbnailUrl: nonBlankStringSchema.optional(),
  enabled: z.boolean(),
  notes: nonBlankStringSchema.optional(),
  challenges: z.array(challengeSchema),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const categorySchema: z.ZodType<Category> = z.object({
  id: idSchema,
  schemaVersion: z.literal(SCHEMA_VERSIONS.category),
  name: nonBlankStringSchema,
  description: nonBlankStringSchema.optional(),
  icon: nonBlankStringSchema.optional(),
  displayOrder: nonNegativeIntegerSchema,
  enabled: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const categoryCollectionSchema = z.array(categorySchema);

export const catalogDataSchema: z.ZodType<CatalogData> = z
  .object({
    categories: z.array(categorySchema),
    songs: z.array(songSchema),
  })
  .superRefine((catalog, context) => {
    const challengeIds = new Map<string, { songIndex: number; challengeIndex: number }>();

    catalog.songs.forEach((song, songIndex) => {
      song.challenges.forEach((challenge, challengeIndex) => {
        const firstLocation = challengeIds.get(challenge.id);

        if (firstLocation) {
          context.addIssue({
            code: 'custom',
            path: ['songs', songIndex, 'challenges', challengeIndex, 'id'],
            message: `Duplicate challenge ID "${challenge.id}"`,
          });
          return;
        }

        challengeIds.set(challenge.id, { songIndex, challengeIndex });
      });
    });
  });

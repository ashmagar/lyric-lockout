import { z } from 'zod';

const timestampSchema = z.iso.datetime({ offset: true });
const idSchema = z.string().trim().min(1);
const difficultySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const challengeSchema = z
  .object({
    id: idSchema,
    difficulty: difficultySchema,
    playbackStartSeconds: z.number().nonnegative(),
    pauseAtSeconds: z.number().nonnegative(),
    verifyFromSeconds: z.number().nonnegative(),
    verifyToSeconds: z.number().nonnegative().optional(),
    expectedLyrics: z.string().trim().min(1),
    missingWordCount: z.number().int().positive(),
    hintText: z.string().trim().min(1),
    enabled: z.boolean(),
    notes: z.string().trim().min(1).optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .superRefine((challenge, context) => {
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

export const songSchema = z.object({
  id: idSchema,
  schemaVersion: z.literal(1),
  title: z.string().trim().min(1),
  artist: z.string().trim().min(1),
  youtubeVideoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  videoType: z.enum(['LYRIC', 'KARAOKE', 'OFFICIAL_VIDEO', 'OTHER']),
  categoryIds: z.array(idSchema),
  language: z.string().trim().min(1).optional(),
  releaseYear: z.number().int().positive().optional(),
  movieOrAlbum: z.string().trim().min(1).optional(),
  thumbnailUrl: z.string().trim().min(1).optional(),
  enabled: z.boolean(),
  notes: z.string().trim().min(1).optional(),
  challenges: z.array(challengeSchema),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const categorySchema = z.object({
  id: idSchema,
  schemaVersion: z.literal(1),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  icon: z.string().trim().min(1).optional(),
  displayOrder: z.number().int().nonnegative(),
  enabled: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type ServerSong = z.infer<typeof songSchema>;
export type ServerCategory = z.infer<typeof categorySchema>;

export interface ServerValidationIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
  path?: string | undefined;
  entityId?: string | undefined;
  source?: string | undefined;
}

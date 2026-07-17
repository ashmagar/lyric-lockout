import { buildCatalogIndex, buildRoundConfig, createCatalogSnapshot } from '../../domain/catalog';
import { SCHEMA_VERSIONS } from '../../domain/constants';
import { DIFFICULTY_LEVELS } from '../../domain/enums';
import type { Category, Challenge, Song } from '../../domain/models/catalog';
import type { RoundCreationConfig } from '../../domain/models/round';

const CATALOG_TIMESTAMP = '2026-07-16T00:00:00.000Z';
const SAMPLE_VIDEO_ID = 'M7lc1UVf-VE';

const CATEGORY_DEFINITIONS = [
  ['90s-bollywood', '90s Bollywood', '📼'],
  ['romantic', 'Romantic', '💛'],
  ['party-songs', 'Party Songs', '🎉'],
  ['female-vocals', 'Female Vocals', '🎤'],
  ['sad-songs', 'Sad Songs', '🌧️'],
  ['dance-hits', 'Dance Hits', '🪩'],
  ['classic-rock', 'Classic Rock', '🎸'],
  ['disney', 'Disney', '🏰'],
  ['tamil', 'Tamil', '🎵'],
  ['marathi', 'Marathi', '🎶'],
] as const;

function createCategory(
  definition: (typeof CATEGORY_DEFINITIONS)[number],
  index: number,
): Category {
  const [id, name, icon] = definition;
  return {
    id,
    schemaVersion: SCHEMA_VERSIONS.category,
    name,
    description: `A fictional ${name} challenge pool prepared for the playable local demo.`,
    icon,
    displayOrder: index + 1,
    enabled: true,
    createdAt: CATALOG_TIMESTAMP,
    updatedAt: CATALOG_TIMESTAMP,
  };
}

function createChallenge(
  category: Category,
  difficulty: 1 | 2 | 3 | 4 | 5,
  variant: number,
): Challenge {
  return {
    id: `challenge-${category.id}-${difficulty}-${variant}`,
    difficulty,
    playbackStartSeconds: 5,
    pauseAtSeconds: 10,
    verifyFromSeconds: 7,
    verifyToSeconds: 12,
    expectedLyrics: `${category.name} level ${difficulty}: carry the melody into the night`,
    missingWordCount: difficulty + variant + 2,
    hintText: `The final word rhymes with light.`,
    enabled: true,
    createdAt: CATALOG_TIMESTAMP,
    updatedAt: CATALOG_TIMESTAMP,
  };
}

function createSong(category: Category): Song {
  return {
    id: `song-${category.id}`,
    schemaVersion: SCHEMA_VERSIONS.song,
    title: `${category.name} Spotlight`,
    artist: 'Lyric Lockout Demo Ensemble',
    youtubeVideoId: SAMPLE_VIDEO_ID,
    videoType: 'LYRIC',
    categoryIds: [category.id],
    language: 'Fictional',
    enabled: true,
    notes: 'Milestone 8 fictional gameplay content using the official YouTube API sample video.',
    challenges: DIFFICULTY_LEVELS.flatMap((difficulty) => [
      createChallenge(category, difficulty, 1),
      createChallenge(category, difficulty, 2),
    ]),
    createdAt: CATALOG_TIMESTAMP,
    updatedAt: CATALOG_TIMESTAMP,
  };
}

export const GAMEPLAY_CATEGORIES = CATEGORY_DEFINITIONS.map(createCategory);
const gameplaySongs = GAMEPLAY_CATEGORIES.map(createSong);

export const GAMEPLAY_CATALOG_INDEX = buildCatalogIndex(
  createCatalogSnapshot(GAMEPLAY_CATEGORIES, gameplaySongs),
);

function createGameplayRoundConfig(): RoundCreationConfig {
  const result = buildRoundConfig(
    {
      categorySelectionMode: 'MANUAL',
      songSelectionMode: 'FULL_CATALOG',
      manualCategoryIds: GAMEPLAY_CATEGORIES.map((category) => category.id),
      manualChallengePools: [],
      preventChallengeReuse: true,
      preventSongReuse: true,
      allowRuntimeReroll: true,
      randomSeed: 'milestone-8-gameplay',
    },
    GAMEPLAY_CATALOG_INDEX,
    () => 0,
  );
  if (!result.ok) {
    throw new Error(result.diagnostics.map((diagnostic) => diagnostic.message).join('; '));
  }
  return result.config;
}

export const GAMEPLAY_ROUND_CONFIG = createGameplayRoundConfig();

import type { DifficultyLevel } from '../enums';
import type { Category, Challenge, Song } from '../models/catalog';
import type { CatalogIndex, CatalogSnapshot, ChallengeCandidate, IndexedChallenge } from './types';

function cloneChallenge(challenge: Challenge): Challenge {
  return {
    ...challenge,
    hiddenWordIndexes:
      challenge.hiddenWordIndexes === undefined ? undefined : [...challenge.hiddenWordIndexes],
  };
}

function cloneSong(song: Song): Song {
  return {
    ...song,
    categoryIds: [...song.categoryIds],
    challenges: song.challenges.map(cloneChallenge),
  };
}

function cloneCategory(category: Category): Category {
  return { ...category };
}

export function createCatalogSnapshot(
  categories: readonly Category[],
  songs: readonly Song[],
): CatalogSnapshot {
  return {
    categories: categories.map(cloneCategory),
    songs: songs.map(cloneSong),
  };
}

export function catalogCandidateKey(categoryId: string, difficulty: DifficultyLevel): string {
  return `${categoryId}:${difficulty}`;
}

export function buildCatalogIndex(snapshot: CatalogSnapshot): CatalogIndex {
  const categoryById = new Map(snapshot.categories.map((category) => [category.id, category]));
  const songById = new Map(snapshot.songs.map((song) => [song.id, song]));
  const challengeById = new Map<string, IndexedChallenge>();
  const candidatesByCategoryAndDifficulty = new Map<string, ChallengeCandidate[]>();

  for (const song of snapshot.songs) {
    for (const challenge of song.challenges) {
      challengeById.set(challenge.id, { song, challenge });
      if (!song.enabled || !challenge.enabled) continue;

      for (const categoryId of song.categoryIds) {
        const category = categoryById.get(categoryId);
        if (!category?.enabled) continue;
        const key = catalogCandidateKey(categoryId, challenge.difficulty);
        const candidate: ChallengeCandidate = {
          song,
          category,
          challenge,
          reference: {
            songId: song.id,
            challengeId: challenge.id,
            categoryId,
            difficulty: challenge.difficulty,
          },
        };
        const candidates = candidatesByCategoryAndDifficulty.get(key) ?? [];
        candidates.push(candidate);
        candidatesByCategoryAndDifficulty.set(key, candidates);
      }
    }
  }

  return {
    snapshot,
    categoryById,
    songById,
    challengeById,
    candidatesByCategoryAndDifficulty,
  };
}

export function getCatalogCandidates(
  index: CatalogIndex,
  categoryId: string,
  difficulty: DifficultyLevel,
): readonly ChallengeCandidate[] {
  return (
    index.candidatesByCategoryAndDifficulty.get(catalogCandidateKey(categoryId, difficulty)) ?? []
  );
}

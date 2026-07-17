import { GameRuleError, selectRandomItem, type RandomSource } from '../engine';
import type { ChallengeSelectionRequest } from '../models/game';
import { getCatalogCandidates } from './indexing';
import type { CatalogIndex, ChallengeCandidate, ValidationDiagnostic } from './types';

export interface ChallengeSelectionCounts {
  indexed: number;
  approved: number;
  afterChallengeExclusions: number;
  afterSongExclusions: number;
}

export interface ChallengeSelectionSuccess {
  ok: true;
  candidate: ChallengeCandidate;
  usedSongReuseFallback: boolean;
  diagnostics: ValidationDiagnostic[];
  counts: ChallengeSelectionCounts;
}

export interface ChallengeSelectionFailure {
  ok: false;
  diagnostics: ValidationDiagnostic[];
  counts: ChallengeSelectionCounts;
}

export type ChallengeSelectionResult = ChallengeSelectionSuccess | ChallengeSelectionFailure;

function unavailable(
  code: string,
  message: string,
  counts: ChallengeSelectionCounts,
): ChallengeSelectionFailure {
  return {
    ok: false,
    counts,
    diagnostics: [
      {
        code,
        severity: 'ERROR',
        kind: 'AVAILABILITY',
        message,
      },
    ],
  };
}

export function selectChallenge(
  index: CatalogIndex,
  request: ChallengeSelectionRequest,
  random: RandomSource,
): ChallengeSelectionResult {
  const indexed = [...getCatalogCandidates(index, request.categoryId, request.difficulty)];
  const approvedIds = new Set(request.approvedChallengeIds ?? []);
  const approved =
    request.songSelectionMode === 'CURATED_POOL'
      ? indexed.filter((candidate) => approvedIds.has(candidate.challenge.id))
      : indexed;
  const excludedChallenges = new Set(request.excludedChallengeIds);
  const afterChallengeExclusions = approved.filter(
    (candidate) => !excludedChallenges.has(candidate.challenge.id),
  );
  const excludedSongs = new Set(request.excludedSongIds);
  const afterSongExclusions = afterChallengeExclusions.filter(
    (candidate) => !excludedSongs.has(candidate.song.id),
  );
  const counts: ChallengeSelectionCounts = {
    indexed: indexed.length,
    approved: approved.length,
    afterChallengeExclusions: afterChallengeExclusions.length,
    afterSongExclusions: afterSongExclusions.length,
  };

  if (indexed.length === 0) {
    return unavailable(
      'NO_INDEXED_CHALLENGES',
      `No enabled challenges exist for category "${request.categoryId}" at Level ${request.difficulty}`,
      counts,
    );
  }
  if (request.songSelectionMode === 'CURATED_POOL' && approved.length === 0) {
    return unavailable(
      'NO_APPROVED_CHALLENGES',
      'The curated pool contains no eligible challenge for this category and level',
      counts,
    );
  }
  if (afterChallengeExclusions.length === 0) {
    return unavailable(
      'ALL_CHALLENGES_EXCLUDED',
      'Every eligible challenge was already played or rejected for this turn',
      counts,
    );
  }

  const usedSongReuseFallback = afterSongExclusions.length === 0 && request.allowSongReuseFallback;
  const selectable = usedSongReuseFallback ? afterChallengeExclusions : afterSongExclusions;
  if (selectable.length === 0) {
    return unavailable(
      'ALL_SONGS_EXCLUDED',
      'Eligible challenges exist only on previously played songs and fallback is disabled',
      counts,
    );
  }

  try {
    return {
      ok: true,
      candidate: selectRandomItem(selectable, random),
      usedSongReuseFallback,
      diagnostics: usedSongReuseFallback
        ? [
            {
              code: 'SONG_REUSE_FALLBACK_USED',
              severity: 'WARNING',
              kind: 'AVAILABILITY',
              message:
                'No unplayed song remained, so selection reused a song without reusing a challenge',
            },
          ]
        : [],
      counts,
    };
  } catch (error) {
    if (error instanceof GameRuleError && error.code === 'INVALID_RANDOM_VALUE') {
      return unavailable('INVALID_RANDOM_VALUE', error.message, counts);
    }
    throw error;
  }
}

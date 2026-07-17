import type { DifficultyLevel, ValidationIssueSeverity } from '../enums';
import type { Category, Challenge, Song } from '../models/catalog';
import type { ChallengeReference } from '../models/game';

export type ValidationIssueKind =
  'STRUCTURAL' | 'REFERENTIAL' | 'SEMANTIC' | 'DUPLICATE' | 'AVAILABILITY';

export interface ValidationDiagnostic {
  code: string;
  severity: ValidationIssueSeverity;
  kind: ValidationIssueKind;
  message: string;
  path?: string | undefined;
  entityId?: string | undefined;
}

export interface CatalogValidationIssue extends ValidationDiagnostic {
  source: string;
}

export interface CatalogSnapshot {
  categories: readonly Category[];
  songs: readonly Song[];
}

export interface IndexedChallenge {
  song: Song;
  challenge: Challenge;
}

export interface ChallengeCandidate extends IndexedChallenge {
  category: Category;
  reference: ChallengeReference;
}

export interface CatalogIndex {
  snapshot: CatalogSnapshot;
  categoryById: ReadonlyMap<string, Category>;
  songById: ReadonlyMap<string, Song>;
  challengeById: ReadonlyMap<string, IndexedChallenge>;
  candidatesByCategoryAndDifficulty: ReadonlyMap<string, readonly ChallengeCandidate[]>;
}

export interface CoverageCell {
  categoryId: string;
  difficulty: DifficultyLevel;
  challengeCount: number;
  hasMinimum: boolean;
  hasRecommendedDepth: boolean;
}

export interface CategoryCoverage {
  categoryId: string;
  categoryName: string;
  enabled: boolean;
  byDifficulty: Readonly<Record<DifficultyLevel, CoverageCell>>;
  isReady: boolean;
  hasRecommendedDepth: boolean;
}

export interface CatalogCoverage {
  categories: readonly CategoryCoverage[];
  readyCategoryCount: number;
}

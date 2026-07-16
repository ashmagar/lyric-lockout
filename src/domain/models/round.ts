import type { DifficultyLevel, SelectionMode, SongSelectionMode } from '../enums';

export interface ManualChallengePool {
  categoryId: string;
  approvedChallengeIdsByDifficulty: Partial<Record<DifficultyLevel, string[] | undefined>>;
}

export interface RoundCreationConfig {
  categorySelectionMode: SelectionMode;
  songSelectionMode: SongSelectionMode;
  categoryCount: 10;
  difficultyLevels: [1, 2, 3, 4, 5];
  selectedCategoryIds: string[];
  manualChallengePools: ManualChallengePool[];
  preventChallengeReuse: boolean;
  preventSongReuse: boolean;
  allowRuntimeReroll: boolean;
  randomSeed?: string | undefined;
}

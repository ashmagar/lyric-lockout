import type { GamePlanStatus, ThemeName, ValidationIssueSeverity } from '../enums';
import type { GameConfig } from './game';
import type { RoundCreationConfig } from './round';

export interface GamePlanValidationIssue {
  code: string;
  severity: ValidationIssueSeverity;
  message: string;
  path?: string | undefined;
}

export interface GamePlan {
  schemaVersion: number;
  id: string;
  name: string;
  description?: string | undefined;
  status: GamePlanStatus;
  roundConfig: RoundCreationConfig;
  gameConfig: GameConfig;
  preferredTheme: ThemeName;
  revealSongBeforePlayback: boolean;
  validationIssues: GamePlanValidationIssue[];
  createdAt: string;
  updatedAt: string;
}

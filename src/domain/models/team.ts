export interface TeamLifelineState {
  hintUseCount: number;
  teamHuddleUseCount: number;
}

export interface TeamState {
  id: string;
  name: string;
  score: number;
  lifelines: TeamLifelineState;
  primaryChallengeCount: number;
  stealAttemptCount: number;
  correctPrimaryCount: number;
  mostlyCorrectPrimaryCount: number;
  wrongPrimaryCount: number;
  successfulStealCount: number;
}

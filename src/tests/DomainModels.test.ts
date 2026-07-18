import { describe, expect, it } from 'vitest';

import categoriesData from '../../data/categories.json';
import demoChallengeData from '../../data/demo/demo-challenge.json';
import sampleGamePlanData from '../../data/game-plans/sample-game-plan.json';
import starlightSongData from '../../data/songs/starlight-parade.json';
import summerSongData from '../../data/songs/summer-radio.json';
import {
  ADDITIONAL_LIFELINE_PENALTY_POINTS,
  DEFAULT_GAME_CONFIG,
  DEFAULT_THEME,
  DIFFICULTY_CONFIG,
  FREE_TEAM_HUDDLE_USES_PER_TEAM,
  FREE_HINT_USES_PER_TEAM,
  SCHEMA_VERSIONS,
} from '../domain/constants';
import { THEME_NAMES } from '../domain/enums';
import type { TeamState } from '../domain/models/team';
import {
  catalogDataSchema,
  categoryCollectionSchema,
  challengeSchema,
  gamePlanSchema,
  gameSessionSchema,
  songSchema,
} from '../schemas';

const TIMESTAMP = '2026-07-15T00:00:00.000Z';

function createTeam(id: string, name: string): TeamState {
  return {
    id,
    name,
    score: 0,
    lifelines: {
      hintUseCount: 0,
      teamHuddleUseCount: 0,
    },
    primaryChallengeCount: 0,
    stealAttemptCount: 0,
    correctPrimaryCount: 0,
    mostlyCorrectPrimaryCount: 0,
    wrongPrimaryCount: 0,
    successfulStealCount: 0,
  };
}

describe('sample data', () => {
  it('parses every Milestone 2 sample', () => {
    const categories = categoryCollectionSchema.parse(categoriesData);
    const songs = [songSchema.parse(starlightSongData), songSchema.parse(summerSongData)];

    expect(categories).toHaveLength(categoriesData.length);
    expect(categories.length).toBeGreaterThanOrEqual(10);
    expect(songs).toHaveLength(2);
    expect(catalogDataSchema.parse({ categories, songs }).songs).toHaveLength(2);
    expect(gamePlanSchema.parse(sampleGamePlanData).roundConfig.selectedCategoryIds).toHaveLength(
      10,
    );
    expect(challengeSchema.parse(demoChallengeData).difficulty).toBe(3);
  });

  it('parses a structurally valid draft GameSession', () => {
    const plan = gamePlanSchema.parse(sampleGamePlanData);
    const session = gameSessionSchema.parse({
      schemaVersion: SCHEMA_VERSIONS.gameSession,
      id: 'session-sample',
      status: 'DRAFT',
      phase: 'GAME_SETUP',
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
      roundConfig: plan.roundConfig,
      gameConfig: plan.gameConfig,
      teams: [createTeam('team-a', 'Team A'), createTeam('team-b', 'Team B')],
      currentDifficulty: 1,
      currentLevelState: {
        difficulty: 1,
        primaryTurnsCompleted: 0,
      },
      consumedCategoryIds: [],
      categoryHistory: [],
      playedSongIds: [],
      playedChallengeIds: [],
      rejectedChallengeIds: [],
      turnHistory: [],
      levelHistory: [],
      processedCommandIds: [],
    });

    expect(session.teams).toHaveLength(2);
    expect(session.phase).toBe('GAME_SETUP');
  });
});

describe('challenge validation', () => {
  it.each([
    ['pause before playback', { pauseAtSeconds: 20, playbackStartSeconds: 20 }],
    ['pause before verification start', { pauseAtSeconds: 43, verifyFromSeconds: 43 }],
    ['verification end before pause', { pauseAtSeconds: 48, verifyToSeconds: 48 }],
  ])('rejects %s', (_scenario, invalidTimes) => {
    const result = challengeSchema.safeParse({
      ...demoChallengeData,
      ...invalidTimes,
    });

    expect(result.success).toBe(false);
  });

  it('rejects blank expected lyrics', () => {
    const result = challengeSchema.safeParse({
      ...demoChallengeData,
      expectedLyrics: '   ',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path.includes('expectedLyrics'))).toBe(true);
  });

  it('rejects missing expected lyrics', () => {
    const missingLyrics: Record<string, unknown> = { ...demoChallengeData };
    delete missingLyrics.expectedLyrics;

    const result = challengeSchema.safeParse(missingLyrics);

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path.includes('expectedLyrics'))).toBe(true);
  });

  it.each([
    ['an empty selection', []],
    ['a duplicate selection', [1, 1]],
    ['an out-of-range selection', [99]],
  ])('rejects %s of hidden words', (_scenario, hiddenWordIndexes) => {
    const result = challengeSchema.safeParse({
      ...demoChallengeData,
      hiddenWordIndexes,
      missingWordCount: hiddenWordIndexes.length,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path.includes('hiddenWordIndexes'))).toBe(
      true,
    );
  });

  it('rejects hidden selections that disagree with the derived missing word count', () => {
    const result = challengeSchema.safeParse({
      ...demoChallengeData,
      hiddenWordIndexes: [0, 2],
      missingWordCount: 1,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path.includes('missingWordCount'))).toBe(
      true,
    );
  });

  it('rejects lyrics made only from punctuation', () => {
    const result = challengeSchema.safeParse({
      ...demoChallengeData,
      expectedLyrics: '... !!!',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path.includes('expectedLyrics'))).toBe(true);
  });

  it('rejects an invalid difficulty', () => {
    const result = challengeSchema.safeParse({
      ...demoChallengeData,
      difficulty: 6,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path.includes('difficulty'))).toBe(true);
  });
});

describe('catalog validation boundary', () => {
  it('detects duplicate challenge IDs across songs', () => {
    const duplicateChallengeSong = {
      ...summerSongData,
      challenges: [
        {
          ...summerSongData.challenges[0],
          id: 'challenge-starlight-level-1',
        },
      ],
    };
    const result = catalogDataSchema.safeParse({
      categories: categoriesData,
      songs: [starlightSongData, duplicateChallengeSong],
    });

    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some((issue) => issue.message.includes('Duplicate challenge ID')),
    ).toBe(true);
  });
});

describe('Game Plan validation', () => {
  it('accepts Game Night as an optional preferred theme', () => {
    const plan = gamePlanSchema.parse({
      ...sampleGamePlanData,
      preferredTheme: 'GAME_NIGHT',
    });

    expect(plan.preferredTheme).toBe('GAME_NIGHT');
  });

  it('rejects an unknown status', () => {
    const result = gamePlanSchema.safeParse({
      ...sampleGamePlanData,
      status: 'ARCHIVED',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path.includes('status'))).toBe(true);
  });
});

describe('frozen defaults', () => {
  it('uses the exact level timers and point values', () => {
    expect(DIFFICULTY_CONFIG).toEqual({
      1: { fullPoints: 100, answerSeconds: 30 },
      2: { fullPoints: 200, answerSeconds: 45 },
      3: { fullPoints: 300, answerSeconds: 60 },
      4: { fullPoints: 400, answerSeconds: 90 },
      5: { fullPoints: 500, answerSeconds: 120 },
    });
    expect(DEFAULT_GAME_CONFIG.fullPointsByDifficulty).toEqual({
      1: 100,
      2: 200,
      3: 300,
      4: 400,
      5: 500,
    });
    expect(DEFAULT_GAME_CONFIG.answerSecondsByDifficulty).toEqual({
      1: 30,
      2: 45,
      3: 60,
      4: 90,
      5: 120,
    });
  });

  it('uses the exact theme and lifeline defaults', () => {
    expect(DEFAULT_THEME).toBe('DAY_PARTY');
    expect(THEME_NAMES).toEqual(['DAY_PARTY', 'GAME_NIGHT']);
    expect(FREE_HINT_USES_PER_TEAM).toBe(1);
    expect(FREE_TEAM_HUDDLE_USES_PER_TEAM).toBe(1);
    expect(ADDITIONAL_LIFELINE_PENALTY_POINTS).toBe(25);
    expect(DEFAULT_GAME_CONFIG.freeHintUsesPerTeam).toBe(1);
    expect(DEFAULT_GAME_CONFIG.freeTeamHuddleUsesPerTeam).toBe(1);
    expect(DEFAULT_GAME_CONFIG.additionalLifelinePenaltyPoints).toBe(25);
  });

  it('uses independent schema versions', () => {
    expect(SCHEMA_VERSIONS).toEqual({
      category: 1,
      song: 1,
      gamePlan: 2,
      gameSession: 2,
      settings: 1,
    });
  });
});

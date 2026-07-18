import { describe, expect, it } from 'vitest';

import sampleGamePlanData from '../../data/game-plans/sample-game-plan.json';
import { DEFAULT_GAME_CONFIG } from '../domain/constants';
import {
  applyTurnScore,
  assignCategory,
  calculateTurnScore,
  classifyPrimaryAnswer,
  classifyStealAnswer,
  completeTurn,
  confirmChallenge,
  createGame,
  GameRuleError,
  getCategoryConsumptionRecord,
  overrideTurnScore,
  recommendTurnScore,
  recordLevelOrder,
  selectRandomAvailableCategory,
  startPrimaryTurn,
  startStealAttempt,
  useLifeline,
  type PrimaryAnswerResult,
} from '../domain/engine';
import type { AnswerResult, CategoryAssignmentMode } from '../domain/enums';
import type { GameSession } from '../domain/models/game';
import { gamePlanSchema, gameSessionSchema } from '../schemas';

const TIMESTAMP = '2026-07-16T00:00:00.000Z';
const PLAN = gamePlanSchema.parse(sampleGamePlanData);
const CATEGORY_IDS = PLAN.roundConfig.selectedCategoryIds;

function createSession(): GameSession {
  return createGame({
    id: 'game-test',
    createdAt: TIMESTAMP,
    teams: [
      { id: 'team-a', name: 'Team A' },
      { id: 'team-b', name: 'Team B' },
    ],
    roundConfig: PLAN.roundConfig,
    gameConfig: PLAN.gameConfig,
  });
}

function getOtherTeamId(session: GameSession, teamId: string): string {
  const other = session.teams.find((team) => team.id !== teamId);
  if (!other) throw new Error('Test session is missing its opposing team');
  return other.id;
}

function beginLevel(session: GameSession, firstPlayingTeamId = 'team-a'): GameSession {
  return recordLevelOrder(session, 'team-a', firstPlayingTeamId, TIMESTAMP);
}

function beginExpectedTurn(
  session: GameSession,
  assignmentMode: CategoryAssignmentMode = 'HOST_ASSIGNED',
): GameSession {
  const firstPlayingTeamId = session.currentLevelState.firstPlayingTeamId;
  if (!firstPlayingTeamId) throw new Error('Test must record level order before starting a turn');

  const primaryTeamId =
    session.currentLevelState.primaryTurnsCompleted === 0
      ? firstPlayingTeamId
      : getOtherTeamId(session, firstPlayingTeamId);
  const turnNumber = session.turnHistory.length + 1;
  const categoryId = CATEGORY_IDS[session.consumedCategoryIds.length];
  if (!categoryId) throw new Error('Test ran out of categories');

  const started = startPrimaryTurn(session, {
    teamId: primaryTeamId,
    turnId: `turn-${turnNumber}`,
    attemptId: `primary-${turnNumber}`,
    startedAt: TIMESTAMP,
  });

  return confirmChallenge(started, {
    assignmentRecordId: `assignment-${turnNumber}`,
    assignmentMode,
    challengeReference: {
      songId: `song-${turnNumber}`,
      challengeId: `challenge-${turnNumber}`,
      categoryId,
      difficulty: session.currentDifficulty,
    },
    confirmedAt: TIMESTAMP,
  });
}

function resolveAndCompleteTurn(
  session: GameSession,
  primaryResult: PrimaryAnswerResult,
  stealResult?: AnswerResult,
): GameSession {
  let updated = classifyPrimaryAnswer(session, primaryResult, TIMESTAMP);

  if (primaryResult !== 'PERFECT') {
    updated = startStealAttempt(updated, {
      attemptId: `steal-${updated.turnHistory.length + 1}`,
      startedAt: TIMESTAMP,
    });
    updated = classifyStealAnswer(updated, stealResult ?? 'DECLINED', TIMESTAMP);
  }

  updated = recommendTurnScore(updated, TIMESTAMP);
  updated = applyTurnScore(updated, TIMESTAMP);
  return completeTurn(updated, TIMESTAMP);
}

function playPerfectLevel(session: GameSession, firstPlayingTeamId = 'team-a'): GameSession {
  let updated = beginLevel(session, firstPlayingTeamId);
  updated = resolveAndCompleteTurn(beginExpectedTurn(updated), 'PERFECT');
  return resolveAndCompleteTurn(beginExpectedTurn(updated), 'PERFECT');
}

function getRuleError(action: () => unknown): GameRuleError {
  try {
    action();
  } catch (error) {
    if (error instanceof GameRuleError) return error;
    throw error;
  }

  throw new Error('Expected a GameRuleError');
}

describe('game creation and category rules', () => {
  it('creates exactly two initialized teams and Level 1', () => {
    const session = createSession();

    expect(session.teams).toHaveLength(2);
    expect(session.teams.map((team) => team.name)).toEqual(['Team A', 'Team B']);
    expect(session.currentDifficulty).toBe(1);
    expect(session.currentLevelState.primaryTurnsCompleted).toBe(0);
    expect(session.status).toBe('IN_PROGRESS');
  });

  it('rejects any team count other than two', () => {
    const error = getRuleError(() =>
      createGame({
        id: 'bad-game',
        createdAt: TIMESTAMP,
        teams: [{ id: 'team-a', name: 'Team A' }],
        roundConfig: PLAN.roundConfig,
      }),
    );

    expect(error.code).toBe('INVALID_TEAM_COUNT');
  });

  it('rejects duplicate category selection at game creation', () => {
    const duplicateCategoryId = PLAN.roundConfig.selectedCategoryIds[0];
    if (!duplicateCategoryId) throw new Error('Sample plan must contain categories');
    const duplicateCategories = [
      ...PLAN.roundConfig.selectedCategoryIds.slice(0, 9),
      duplicateCategoryId,
    ];
    const error = getRuleError(() =>
      createGame({
        id: 'bad-categories',
        createdAt: TIMESTAMP,
        teams: [
          { id: 'team-a', name: 'Team A' },
          { id: 'team-b', name: 'Team B' },
        ],
        roundConfig: {
          ...PLAN.roundConfig,
          selectedCategoryIds: duplicateCategories,
        },
      }),
    );

    expect(error.code).toBe('DUPLICATE_CATEGORY');
  });

  it.each(['SELF_SELECTED', 'OPPONENT_ASSIGNED', 'HOST_ASSIGNED'] as const)(
    'records %s category assignment',
    (assignmentMode) => {
      const session = beginExpectedTurn(beginLevel(createSession()), assignmentMode);

      expect(session.categoryHistory[0]?.assignmentMode).toBe(assignmentMode);
      expect(session.consumedCategoryIds).toEqual([CATEGORY_IDS[0]]);
    },
  );

  it('derives team attribution only after the assigned category is committed', () => {
    let session = startPrimaryTurn(beginLevel(createSession()), {
      teamId: 'team-a',
      turnId: 'turn-consumption',
      attemptId: 'attempt-consumption',
      startedAt: TIMESTAMP,
    });
    session = assignCategory(session, {
      assignmentRecordId: 'assignment-consumption',
      assignmentMode: 'SELF_SELECTED',
      categoryId: CATEGORY_IDS[0]!,
      assignedAt: TIMESTAMP,
    });

    expect(getCategoryConsumptionRecord(session, CATEGORY_IDS[0]!)).toBeUndefined();

    session = confirmChallenge(session, {
      assignmentRecordId: 'assignment-consumption',
      assignmentMode: 'SELF_SELECTED',
      challengeReference: {
        songId: 'song-consumption',
        challengeId: 'challenge-consumption',
        categoryId: CATEGORY_IDS[0]!,
        difficulty: 1,
      },
      confirmedAt: TIMESTAMP,
    });

    expect(getCategoryConsumptionRecord(session, CATEGORY_IDS[0]!)).toMatchObject({
      categoryId: CATEGORY_IDS[0],
      teamId: 'team-a',
    });
  });

  it('never resets consumed categories between levels and rejects reuse', () => {
    let session = playPerfectLevel(createSession());
    expect(session.currentDifficulty).toBe(2);
    expect(session.consumedCategoryIds).toEqual(CATEGORY_IDS.slice(0, 2));

    session = beginLevel(session);
    session = startPrimaryTurn(session, {
      teamId: 'team-a',
      turnId: 'turn-3',
      attemptId: 'primary-3',
      startedAt: TIMESTAMP,
    });
    const error = getRuleError(() =>
      confirmChallenge(session, {
        assignmentRecordId: 'duplicate-assignment',
        assignmentMode: 'HOST_ASSIGNED',
        challengeReference: {
          songId: 'song-new',
          challengeId: 'challenge-new',
          categoryId: CATEGORY_IDS[0]!,
          difficulty: 2,
        },
        confirmedAt: TIMESTAMP,
      }),
    );

    expect(error.code).toBe('CATEGORY_ALREADY_CONSUMED');
  });

  it('rejects the same song for a different category when song reuse prevention is enabled', () => {
    let session = beginExpectedTurn(beginLevel(createSession()));
    const playedSongId = session.playedSongIds[0];
    if (!playedSongId) throw new Error('Expected the first challenge to consume a song');

    session = resolveAndCompleteTurn(session, 'PERFECT');
    session = startPrimaryTurn(session, {
      teamId: 'team-b',
      turnId: 'turn-shared-song',
      attemptId: 'primary-shared-song',
      startedAt: TIMESTAMP,
    });

    const error = getRuleError(() =>
      confirmChallenge(session, {
        assignmentRecordId: 'assignment-shared-song',
        assignmentMode: 'HOST_ASSIGNED',
        challengeReference: {
          songId: playedSongId,
          challengeId: 'challenge-shared-song-different-category',
          categoryId: CATEGORY_IDS[1]!,
          difficulty: 1,
        },
        confirmedAt: TIMESTAMP,
      }),
    );

    expect(error.code).toBe('SONG_ALREADY_PLAYED');
  });

  it('does not consume a category for a steal attempt', () => {
    let session = beginExpectedTurn(beginLevel(createSession()));
    const categoryCount = session.consumedCategoryIds.length;
    session = classifyPrimaryAnswer(session, 'WRONG', TIMESTAMP);
    session = startStealAttempt(session, { attemptId: 'steal-1', startedAt: TIMESTAMP });
    session = classifyStealAnswer(session, 'PERFECT', TIMESTAMP);

    expect(session.consumedCategoryIds).toHaveLength(categoryCount);
    expect(session.currentLevelState.primaryTurnsCompleted).toBe(0);
  });

  it('uses injected randomness for available-category choice', () => {
    const session = createSession();

    expect(selectRandomAvailableCategory(session, () => 0)).toBe(CATEGORY_IDS[0]);
    expect(selectRandomAvailableCategory(session, () => 0.999)).toBe(CATEGORY_IDS[9]);
    expect(getRuleError(() => selectRandomAvailableCategory(session, () => 1)).code).toBe(
      'INVALID_RANDOM_VALUE',
    );
  });
});

describe('scoring matrix', () => {
  const matrix = [
    {
      name: 'Perfect primary',
      primaryResult: 'PERFECT',
      stealResult: undefined,
      primaryFactor: 1,
      stealFactor: undefined,
    },
    {
      name: 'Mostly Correct with Perfect steal',
      primaryResult: 'MOSTLY_CORRECT',
      stealResult: 'PERFECT',
      primaryFactor: 0.5,
      stealFactor: 0.5,
    },
    {
      name: 'Mostly Correct with failed steal',
      primaryResult: 'MOSTLY_CORRECT',
      stealResult: 'WRONG',
      primaryFactor: 0.5,
      stealFactor: 0,
    },
    {
      name: 'Wrong with Perfect steal',
      primaryResult: 'WRONG',
      stealResult: 'PERFECT',
      primaryFactor: 0,
      stealFactor: 0.5,
    },
    {
      name: 'Wrong with failed steal',
      primaryResult: 'WRONG',
      stealResult: 'DECLINED',
      primaryFactor: 0,
      stealFactor: 0,
    },
  ] as const;

  it.each([1, 2, 3, 4, 5] as const)('applies every matrix branch at Level %i', (difficulty) => {
    const fullPoints = DEFAULT_GAME_CONFIG.fullPointsByDifficulty[difficulty];

    for (const branch of matrix) {
      const score = calculateTurnScore({
        difficulty,
        primaryResult: branch.primaryResult,
        stealResult: branch.stealResult,
        primaryPenaltyPoints: 0,
        stealPenaltyPoints: 0,
        gameConfig: { ...DEFAULT_GAME_CONFIG },
      });

      expect(score.primary.baseAllocatedPoints, branch.name).toBe(
        fullPoints * branch.primaryFactor,
      );
      if (branch.stealFactor === undefined) {
        expect(score.steal, branch.name).toBeUndefined();
      } else {
        expect(score.steal?.baseAllocatedPoints, branch.name).toBe(fullPoints * branch.stealFactor);
      }
    }
  });

  it('blocks a steal after a Perfect primary answer', () => {
    let session = beginExpectedTurn(beginLevel(createSession()));
    session = classifyPrimaryAnswer(session, 'PERFECT', TIMESTAMP);

    expect(
      getRuleError(() =>
        startStealAttempt(session, { attemptId: 'blocked-steal', startedAt: TIMESTAMP }),
      ).code,
    ).toBe('STEAL_NOT_ELIGIBLE');
  });

  it('rejects Declined as a primary classification', () => {
    const session = beginExpectedTurn(beginLevel(createSession()));

    expect(getRuleError(() => classifyPrimaryAnswer(session, 'DECLINED', TIMESTAMP)).code).toBe(
      'INVALID_PRIMARY_RESULT',
    );
  });
});

describe('lifelines', () => {
  it('keeps Hint and Ask a Friend counters separate with free then paid uses', () => {
    let session = beginExpectedTurn(beginLevel(createSession()));

    const firstHint = useLifeline(session, {
      teamId: 'team-a',
      type: 'HINT',
      usageId: 'hint-1',
      usedAt: TIMESTAMP,
    });
    session = firstHint.session;
    expect(firstHint.usage).toMatchObject({ usageNumber: 1, wasFree: true, penaltyPoints: 0 });

    const confirmationError = getRuleError(() =>
      useLifeline(session, {
        teamId: 'team-a',
        type: 'HINT',
        usageId: 'hint-2-unconfirmed',
        usedAt: TIMESTAMP,
      }),
    );
    expect(confirmationError.code).toBe('PAID_LIFELINE_CONFIRMATION_REQUIRED');

    const secondHint = useLifeline(session, {
      teamId: 'team-a',
      type: 'HINT',
      usageId: 'hint-2',
      usedAt: TIMESTAMP,
      confirmPaidUse: true,
    });
    session = secondHint.session;
    expect(secondHint.usage).toMatchObject({ usageNumber: 2, wasFree: false, penaltyPoints: 25 });

    const thirdHint = useLifeline(session, {
      teamId: 'team-a',
      type: 'HINT',
      usageId: 'hint-3',
      usedAt: TIMESTAMP,
      confirmPaidUse: true,
    });
    session = thirdHint.session;
    expect(thirdHint.usage).toMatchObject({ usageNumber: 3, wasFree: false, penaltyPoints: 25 });

    const firstFriend = useLifeline(session, {
      teamId: 'team-a',
      type: 'ASK_FRIEND',
      usageId: 'friend-1',
      usedAt: TIMESTAMP,
    });
    session = firstFriend.session;
    expect(firstFriend.usage).toMatchObject({ usageNumber: 1, wasFree: true, penaltyPoints: 0 });
    expect(session.teams[0].lifelines).toEqual({ hintUseCount: 3, askFriendUseCount: 1 });

    const secondFriend = useLifeline(session, {
      teamId: 'team-a',
      type: 'ASK_FRIEND',
      usageId: 'friend-2',
      usedAt: TIMESTAMP,
      confirmPaidUse: true,
    });
    expect(secondFriend.usage.penaltyPoints).toBe(25);

    const thirdFriend = useLifeline(secondFriend.session, {
      teamId: 'team-a',
      type: 'ASK_FRIEND',
      usageId: 'friend-3',
      usedAt: TIMESTAMP,
      confirmPaidUse: true,
    });
    expect(thirdFriend.usage).toMatchObject({ usageNumber: 3, wasFree: false, penaltyPoints: 25 });
  });

  it('applies paid lifeline penalties to the current score recommendation', () => {
    let session = beginExpectedTurn(beginLevel(createSession()));
    session = useLifeline(session, {
      teamId: 'team-a',
      type: 'HINT',
      usageId: 'hint-1',
      usedAt: TIMESTAMP,
    }).session;
    session = useLifeline(session, {
      teamId: 'team-a',
      type: 'HINT',
      usageId: 'hint-2',
      usedAt: TIMESTAMP,
      confirmPaidUse: true,
    }).session;
    session = classifyPrimaryAnswer(session, 'PERFECT', TIMESTAMP);
    session = recommendTurnScore(session, TIMESTAMP);

    expect(session.activeTurn?.score?.primary).toMatchObject({
      baseAllocatedPoints: 100,
      lifelinePenaltyPoints: 25,
      recommendedPoints: 75,
    });
  });

  it('persists lifeline counters across levels', () => {
    let session = beginExpectedTurn(beginLevel(createSession()));
    session = useLifeline(session, {
      teamId: 'team-a',
      type: 'HINT',
      usageId: 'level-1-hint',
      usedAt: TIMESTAMP,
    }).session;
    session = resolveAndCompleteTurn(session, 'PERFECT');
    session = resolveAndCompleteTurn(beginExpectedTurn(session), 'PERFECT');

    session = beginExpectedTurn(beginLevel(session));
    const levelTwoHint = useLifeline(session, {
      teamId: 'team-a',
      type: 'HINT',
      usageId: 'level-2-hint',
      usedAt: TIMESTAMP,
      confirmPaidUse: true,
    });

    expect(levelTwoHint.usage).toMatchObject({ usageNumber: 2, penaltyPoints: 25 });
    expect(levelTwoHint.session.teams[0].lifelines.hintUseCount).toBe(2);
  });
});

describe('overrides and score idempotency', () => {
  it('preserves recommendations while overriding each team independently', () => {
    let session = beginExpectedTurn(beginLevel(createSession()));
    session = classifyPrimaryAnswer(session, 'MOSTLY_CORRECT', TIMESTAMP);
    session = startStealAttempt(session, { attemptId: 'steal-1', startedAt: TIMESTAMP });
    session = classifyStealAnswer(session, 'PERFECT', TIMESTAMP);
    session = recommendTurnScore(session, TIMESTAMP);
    session = overrideTurnScore(session, {
      target: 'PRIMARY',
      finalAwardedPoints: 70,
      reason: 'Host ruling',
      overriddenAt: TIMESTAMP,
    });
    session = overrideTurnScore(session, {
      target: 'STEAL',
      finalAwardedPoints: 20,
      overriddenAt: TIMESTAMP,
    });

    expect(session.activeTurn?.score?.primary).toMatchObject({
      recommendedPoints: 50,
      finalAwardedPoints: 70,
      hostAdjustmentPoints: 20,
      overridden: true,
    });
    expect(session.activeTurn?.score?.steal).toMatchObject({
      recommendedPoints: 50,
      finalAwardedPoints: 20,
      hostAdjustmentPoints: -30,
      overridden: true,
    });
  });

  it('applies an active turn score only once', () => {
    let session = beginExpectedTurn(beginLevel(createSession()));
    session = classifyPrimaryAnswer(session, 'PERFECT', TIMESTAMP);
    session = recommendTurnScore(session, TIMESTAMP);
    const appliedOnce = applyTurnScore(session, TIMESTAMP);
    const appliedTwice = applyTurnScore(appliedOnce, TIMESTAMP);

    expect(appliedOnce.teams[0].score).toBe(100);
    expect(appliedTwice.teams[0].score).toBe(100);
    expect(appliedTwice).toBe(appliedOnce);
  });
});

describe('turn and level progression', () => {
  it('requires two primary turns before advancing a level', () => {
    let session = beginExpectedTurn(beginLevel(createSession()));
    session = resolveAndCompleteTurn(session, 'PERFECT');

    expect(session.currentDifficulty).toBe(1);
    expect(session.currentLevelState.primaryTurnsCompleted).toBe(1);
    expect(session.levelHistory).toHaveLength(0);

    session = resolveAndCompleteTurn(beginExpectedTurn(session), 'PERFECT');
    expect(session.currentDifficulty).toBe(2);
    expect(session.currentLevelState.primaryTurnsCompleted).toBe(0);
    expect(session.levelHistory).toHaveLength(1);
  });

  it('does not count a steal as a primary turn', () => {
    let session = beginExpectedTurn(beginLevel(createSession()));
    session = classifyPrimaryAnswer(session, 'WRONG', TIMESTAMP);
    session = startStealAttempt(session, { attemptId: 'steal-1', startedAt: TIMESTAMP });
    session = classifyStealAnswer(session, 'PERFECT', TIMESTAMP);
    session = recommendTurnScore(session, TIMESTAMP);
    session = applyTurnScore(session, TIMESTAMP);

    expect(session.currentLevelState.primaryTurnsCompleted).toBe(0);
    session = completeTurn(session, TIMESTAMP);
    expect(session.currentLevelState.primaryTurnsCompleted).toBe(1);
    expect(session.teams[1].stealAttemptCount).toBe(1);
    expect(session.teams[1].successfulStealCount).toBe(1);
  });

  it('simulates a full five-level game with ten permanent categories', () => {
    let session = createSession();

    for (const difficulty of [1, 2, 3, 4, 5] as const) {
      expect(session.currentDifficulty).toBe(difficulty);
      session = playPerfectLevel(session, difficulty % 2 === 0 ? 'team-b' : 'team-a');
    }

    expect(session.status).toBe('COMPLETED');
    expect(session.completedAt).toBe(TIMESTAMP);
    expect(session.currentDifficulty).toBe(5);
    expect(session.currentLevelState.primaryTurnsCompleted).toBe(2);
    expect(session.turnHistory).toHaveLength(10);
    expect(session.levelHistory).toHaveLength(5);
    expect(session.consumedCategoryIds).toEqual(CATEGORY_IDS);
    expect(new Set(session.consumedCategoryIds).size).toBe(10);
    expect(session.teams.map((team) => team.primaryChallengeCount)).toEqual([5, 5]);
    expect(session.teams.map((team) => team.score)).toEqual([1500, 1500]);
    expect(() => gameSessionSchema.parse(session)).not.toThrow();
  });
});

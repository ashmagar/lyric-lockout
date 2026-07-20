import { describe, expect, it } from 'vitest';

import sampleGamePlanData from '../../data/game-plans/sample-game-plan.json';
import { SCHEMA_VERSIONS } from '../domain/constants';
import { createGame } from '../domain/engine';
import type { AnswerResult, DifficultyLevel } from '../domain/enums';
import type { ActiveChallenge, GameSession } from '../domain/models/game';
import {
  getSafeRecoveryPhase,
  isLegalPhaseTransition,
  canRevealExpectedLyrics,
  processGameCommand,
  type CommandSuccess,
  type GameCommand,
} from '../domain/stateMachine';
import { gamePlanSchema, gameSessionSchema } from '../schemas';

const TIMESTAMP = '2026-07-16T12:00:00.000Z';
const PLAN = gamePlanSchema.parse(sampleGamePlanData);
const CATEGORY_IDS = PLAN.roundConfig.selectedCategoryIds;

function createSession(): GameSession {
  return createGame({
    id: 'state-machine-game',
    createdAt: TIMESTAMP,
    teams: [
      { id: 'team-a', name: 'Team A' },
      { id: 'team-b', name: 'Team B' },
    ],
    roundConfig: PLAN.roundConfig,
    gameConfig: PLAN.gameConfig,
  });
}

function command<T extends GameCommand['type']>(
  type: T,
  sequence: number,
  payload: Omit<Extract<GameCommand, { type: T }>, 'type' | 'commandId' | 'issuedAt'>,
): Extract<GameCommand, { type: T }> {
  return {
    type,
    commandId: `command-${sequence}`,
    issuedAt: TIMESTAMP,
    ...payload,
  } as Extract<GameCommand, { type: T }>;
}

function dispatch(session: GameSession, nextCommand: GameCommand): CommandSuccess {
  const result = processGameCommand(session, nextCommand);
  if (!result.ok) {
    throw new Error(`${result.failure.code}: ${result.failure.message}`);
  }
  return result;
}

function createChallenge(
  categoryId: string,
  difficulty: DifficultyLevel,
  turnNumber: number,
): ActiveChallenge {
  const challengeId = `challenge-${turnNumber}`;
  const songId = `song-${turnNumber}`;
  const challenge = {
    id: challengeId,
    difficulty,
    playbackStartSeconds: 10,
    pauseAtSeconds: 20,
    verifyFromSeconds: 18,
    verifyToSeconds: 28,
    expectedLyrics: `Expected lyrics for turn ${turnNumber}`,
    missingWordCount: difficulty + 2,
    hintText: `Hint for turn ${turnNumber}`,
    enabled: true,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };

  return {
    reference: { songId, challengeId, categoryId, difficulty },
    song: {
      id: songId,
      schemaVersion: SCHEMA_VERSIONS.song,
      title: `Song ${turnNumber}`,
      artist: 'Test Artist',
      youtubeVideoId: `video${String(turnNumber).padStart(6, '0')}`,
      videoType: 'LYRIC',
      categoryIds: [categoryId],
      enabled: true,
      challenges: [challenge],
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    },
    category: {
      id: categoryId,
      schemaVersion: SCHEMA_VERSIONS.category,
      name: `Category ${turnNumber}`,
      displayOrder: turnNumber,
      enabled: true,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    },
    challenge,
    selectedAt: TIMESTAMP,
  };
}

function enterFirstTurn(sequence = 1): { session: GameSession; sequence: number } {
  let session = createSession();
  session = dispatch(session, command('ENTER_ROUND_BUILDING', sequence++, {})).session;
  session = dispatch(session, command('VALIDATE_ROUND', sequence++, {})).session;
  session = dispatch(session, command('START_GAME', sequence++, {})).session;
  session = dispatch(session, command('BEGIN_TRIVIA', sequence++, {})).session;
  session = dispatch(
    session,
    command('RECORD_TRIVIA_WINNER', sequence++, { teamId: 'team-a' }),
  ).session;
  session = dispatch(
    session,
    command('CONFIRM_TURN_ORDER', sequence++, {
      firstPlayingTeamId: 'team-a',
      turnId: 'turn-1',
      primaryAttemptId: 'primary-1',
    }),
  ).session;
  return { session, sequence };
}

function enterAnswering(
  initial = enterFirstTurn(),
  turnNumber = 1,
): { session: GameSession; sequence: number } {
  let { session, sequence } = initial;
  const categoryId = CATEGORY_IDS[turnNumber - 1];
  if (!categoryId) throw new Error('Test game ran out of categories');
  session = dispatch(
    session,
    command('ASSIGN_CATEGORY', sequence++, {
      categoryId,
      assignmentRecordId: `assignment-${turnNumber}`,
      assignmentMode: 'HOST_ASSIGNED',
    }),
  ).session;
  session = dispatch(
    session,
    command('SELECT_CHALLENGE', sequence++, {
      activeChallenge: createChallenge(categoryId, session.currentDifficulty, turnNumber),
    }),
  ).session;
  session = dispatch(session, command('CONFIRM_CHALLENGE', sequence++, {})).session;
  session = dispatch(session, command('MARK_VIDEO_READY', sequence++, {})).session;
  session = dispatch(session, command('PLAY_VIDEO', sequence++, {})).session;
  session = dispatch(session, command('MARK_VIDEO_PAUSED', sequence++, {})).session;
  return { session, sequence };
}

function enterFinalScoreReview(primaryResult: AnswerResult = 'PERFECT'): {
  session: GameSession;
  sequence: number;
} {
  let { session, sequence } = enterAnswering();
  session = dispatch(
    session,
    command('CLASSIFY_PRIMARY', sequence++, { result: primaryResult }),
  ).session;
  session = dispatch(session, command('CONFIRM_PRIMARY_RESULT', sequence++, {})).session;
  if (primaryResult !== 'PERFECT') {
    session = dispatch(
      session,
      command('ACCEPT_STEAL', sequence++, { stealAttemptId: 'steal-1' }),
    ).session;
    session = dispatch(
      session,
      command('CLASSIFY_STEAL', sequence++, { result: 'PERFECT' }),
    ).session;
    session = dispatch(session, command('CONFIRM_STEAL_RESULT', sequence++, {})).session;
  }
  session = dispatch(session, command('COMPLETE_VERIFICATION', sequence++, {})).session;
  return { session, sequence };
}

describe('phase transitions and command failures', () => {
  it('declares major legal transitions and rejects representative illegal edges', () => {
    expect(isLegalPhaseTransition('GAME_SETUP', 'ROUND_BUILDING')).toBe(true);
    expect(isLegalPhaseTransition('PRIMARY_RESULT_REVIEW', 'STEAL_OFFER')).toBe(true);
    expect(isLegalPhaseTransition('PRIMARY_RESULT_REVIEW', 'CHALLENGE_VERIFICATION')).toBe(true);
    expect(isLegalPhaseTransition('PRIMARY_ANSWERING', 'GAME_SUMMARY')).toBe(true);
    expect(isLegalPhaseTransition('TURN_SUMMARY', 'GAME_SUMMARY')).toBe(true);
    expect(isLegalPhaseTransition('GAME_SETUP', 'VIDEO_PLAYING')).toBe(false);
    expect(isLegalPhaseTransition('STEAL_ANSWERING', 'FINAL_SCORE_REVIEW')).toBe(false);
    expect(isLegalPhaseTransition('GAME_SUMMARY', 'LEVEL_INTRO')).toBe(false);
  });

  it('returns a structured failure without changing state for an illegal command', () => {
    const session = createSession();
    const result = processGameCommand(session, command('PLAY_VIDEO', 1, {}));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected command rejection');
    expect(result.failure).toMatchObject({
      kind: 'ILLEGAL_TRANSITION',
      code: 'ILLEGAL_PHASE',
      phase: 'GAME_SETUP',
      commandType: 'PLAY_VIDEO',
      recoverable: true,
    });
    expect(result.session).toBe(session);
    expect(result.events).toEqual([]);
  });

  it('rejects a duplicate command ID without replaying events or mutations', () => {
    const firstCommand = command('ENTER_ROUND_BUILDING', 1, {});
    const first = dispatch(createSession(), firstCommand);
    const duplicate = processGameCommand(first.session, firstCommand);

    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) throw new Error('Expected duplicate rejection');
    expect(duplicate.failure.kind).toBe('DUPLICATE_COMMAND');
    expect(duplicate.failure.code).toBe('DUPLICATE_COMMAND');
    expect(duplicate.session).toBe(first.session);
    expect(duplicate.events).toEqual([]);
  });

  it('lets the host finish an active game immediately', () => {
    const { session, sequence } = enterAnswering();
    session.teams[0].score = 300;
    const finished = dispatch(session, command('FINISH_GAME', sequence, {}));

    expect(finished.session).toMatchObject({
      phase: 'GAME_SUMMARY',
      status: 'COMPLETED',
      completedAt: TIMESTAMP,
      activeTurn: undefined,
      activeChallenge: undefined,
    });
    expect(finished.session.teams.map((team) => team.score)).toEqual([300, 0]);
    expect(finished.events.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        'VIDEO_PAUSE_REQUESTED',
        'SUSPENSE_STOP_REQUESTED',
        'TIMER_ACTION_REQUESTED',
        'GAME_COMPLETED',
        'PHASE_CHANGED',
      ]),
    );
    expect(() => gameSessionSchema.parse(finished.session)).not.toThrow();
  });

  it('blocks a steal after a Perfect primary answer', () => {
    let { session, sequence } = enterAnswering();
    session = dispatch(
      session,
      command('CLASSIFY_PRIMARY', sequence++, { result: 'PERFECT' }),
    ).session;
    session = dispatch(session, command('CONFIRM_PRIMARY_RESULT', sequence++, {})).session;

    expect(session.phase).toBe('CHALLENGE_VERIFICATION');
    const result = processGameCommand(
      session,
      command('ACCEPT_STEAL', sequence, { stealAttemptId: 'blocked-steal' }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected steal rejection');
    expect(result.failure.code).toBe('ILLEGAL_PHASE');
  });

  it('does not allow verification before an accepted steal is resolved', () => {
    let { session, sequence } = enterAnswering();
    session = dispatch(
      session,
      command('CLASSIFY_PRIMARY', sequence++, { result: 'WRONG' }),
    ).session;
    session = dispatch(session, command('CONFIRM_PRIMARY_RESULT', sequence++, {})).session;
    session = dispatch(
      session,
      command('ACCEPT_STEAL', sequence++, { stealAttemptId: 'steal-1' }),
    ).session;

    expect(canRevealExpectedLyrics(session.phase)).toBe(false);

    const result = processGameCommand(session, command('CONFIRM_STEAL_RESULT', sequence, {}));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected verification rejection');
    expect(result.failure).toMatchObject({ code: 'ILLEGAL_PHASE', phase: 'STEAL_ANSWERING' });
  });

  it('confirms a score only once even with different command IDs', () => {
    let { session, sequence } = enterFinalScoreReview();
    expect(canRevealExpectedLyrics(session.phase)).toBe(true);
    session = dispatch(session, command('CONFIRM_SCORE', sequence++, {})).session;
    const appliedScore = session.teams[0].score;

    const result = processGameCommand(session, command('CONFIRM_SCORE', sequence, {}));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected score rejection');
    expect(result.failure.code).toBe('ILLEGAL_PHASE');
    expect(result.session.teams[0].score).toBe(appliedScore);
  });
});

describe('recovery, timer, and reroll behavior', () => {
  it('maps media phases to a host-controlled ready state and resumes without autoplay effects', () => {
    expect(getSafeRecoveryPhase('VIDEO_LOADING')).toBe('VIDEO_READY');
    expect(getSafeRecoveryPhase('VIDEO_READY')).toBe('VIDEO_READY');
    expect(getSafeRecoveryPhase('VIDEO_PLAYING')).toBe('VIDEO_READY');

    let { session, sequence } = enterAnswering();
    const recovery = dispatch(
      session,
      command('ENTER_RECOVERY', sequence++, { reason: 'Browser refresh' }),
    );
    session = recovery.session;

    expect(session.phase).toBe('RECOVERY');
    expect(session.recovery).toMatchObject({
      previousPhase: 'PRIMARY_ANSWERING',
      safePhase: 'PRIMARY_ANSWERING',
    });
    expect(session.activeTurn?.primaryAttempt?.timer.status).toBe('PAUSED');
    expect(recovery.events.map((event) => event.type)).toContain('VIDEO_PAUSE_REQUESTED');

    const resumed = dispatch(session, command('RESUME_FROM_RECOVERY', sequence, {}));
    expect(resumed.session.phase).toBe('PRIMARY_ANSWERING');
    expect(resumed.session.activeTurn?.primaryAttempt?.timer.status).toBe('PAUSED');
    expect(resumed.events.some((event) => event.type === 'VIDEO_PLAY_REQUESTED')).toBe(false);
    expect(resumed.events.some((event) => event.type === 'TIMER_ACTION_REQUESTED')).toBe(false);
  });

  it('records timer expiry without classifying the answer as Wrong', () => {
    const { session, sequence } = enterAnswering();
    const expired = dispatch(session, command('TIMER_EXPIRED', sequence, {}));

    expect(expired.session.phase).toBe('PRIMARY_ANSWERING');
    expect(expired.session.activeTurn?.primaryAttempt?.timer.status).toBe('EXPIRED');
    expect(expired.session.activeTurn?.primaryAttempt?.result).toBeUndefined();
    expect(expired.events[0]?.type).toBe('TIMER_EXPIRED');
  });

  it('subtracts elapsed wall-clock time before pausing a running timer for recovery', () => {
    const { session, sequence } = enterAnswering();
    const originalRemaining = session.activeTurn?.primaryAttempt?.timer.remainingMilliseconds ?? 0;
    const recoveryCommand = command('ENTER_RECOVERY', sequence, {
      reason: 'Browser refresh',
    });
    recoveryCommand.issuedAt = '2026-07-16T12:00:05.000Z';

    const recovery = dispatch(session, recoveryCommand);

    expect(recovery.session.activeTurn?.primaryAttempt?.timer).toMatchObject({
      status: 'PAUSED',
      remainingMilliseconds: originalRemaining - 5_000,
    });
  });

  it('requests confirmation before applying a paid lifeline', () => {
    let { session, sequence } = enterAnswering();
    session = dispatch(
      session,
      command('USE_LIFELINE', sequence++, {
        teamId: 'team-a',
        lifelineType: 'HINT',
        usageId: 'free-hint',
      }),
    ).session;

    const confirmation = dispatch(
      session,
      command('USE_LIFELINE', sequence++, {
        teamId: 'team-a',
        lifelineType: 'HINT',
        usageId: 'paid-hint-pending',
      }),
    );
    expect(confirmation.session.teams[0].lifelines.hintUseCount).toBe(1);
    expect(confirmation.events[0]).toMatchObject({
      type: 'LIFELINE_CONFIRMATION_REQUESTED',
      penaltyPoints: 25,
    });

    const paid = dispatch(
      confirmation.session,
      command('USE_LIFELINE', sequence, {
        teamId: 'team-a',
        lifelineType: 'HINT',
        usageId: 'paid-hint-confirmed',
        confirmPaidUse: true,
      }),
    );
    expect(paid.session.teams[0].lifelines.hintUseCount).toBe(2);
    expect(paid.events[0]).toMatchObject({ type: 'LIFELINE_USED', penaltyPoints: 25 });
  });

  it('rerolls without changing the team, category, level, or turn', () => {
    let { session, sequence } = enterFirstTurn();
    const categoryId = CATEGORY_IDS[0]!;
    session = dispatch(
      session,
      command('ASSIGN_CATEGORY', sequence++, {
        categoryId,
        assignmentRecordId: 'assignment-1',
        assignmentMode: 'SELF_SELECTED',
      }),
    ).session;
    session = dispatch(
      session,
      command('SELECT_CHALLENGE', sequence++, {
        activeChallenge: createChallenge(categoryId, 1, 1),
      }),
    ).session;
    const before = session.activeTurn;
    session = dispatch(session, command('REROLL_CHALLENGE', sequence, {})).session;

    expect(session.phase).toBe('CHALLENGE_SELECTION');
    expect(session.activeTurn).toMatchObject({
      id: before?.id,
      primaryTeamId: before?.primaryTeamId,
      categoryId: before?.categoryId,
      difficulty: before?.difficulty,
    });
    expect(session.rejectedChallengeIds).toEqual(['challenge-1']);
    expect(session.consumedCategoryIds).toEqual([]);
  });
});

describe('complete command lifecycle', () => {
  it('plays all five levels and ten turns through commands', () => {
    let session = createSession();
    let sequence = 1;
    session = dispatch(session, command('ENTER_ROUND_BUILDING', sequence++, {})).session;
    session = dispatch(session, command('VALIDATE_ROUND', sequence++, {})).session;
    session = dispatch(session, command('START_GAME', sequence++, {})).session;

    for (const difficulty of [1, 2, 3, 4, 5] as const) {
      if (difficulty > 1) {
        session = dispatch(session, command('START_NEXT_LEVEL', sequence++, {})).session;
      }
      session = dispatch(session, command('BEGIN_TRIVIA', sequence++, {})).session;
      session = dispatch(
        session,
        command('RECORD_TRIVIA_WINNER', sequence++, { teamId: 'team-a' }),
      ).session;
      const firstTeamId = difficulty % 2 === 0 ? 'team-b' : 'team-a';
      const firstTurnNumber = (difficulty - 1) * 2 + 1;
      session = dispatch(
        session,
        command('CONFIRM_TURN_ORDER', sequence++, {
          firstPlayingTeamId: firstTeamId,
          turnId: `turn-${firstTurnNumber}`,
          primaryAttemptId: `primary-${firstTurnNumber}`,
        }),
      ).session;

      for (const turnOffset of [0, 1] as const) {
        const turnNumber = firstTurnNumber + turnOffset;
        const categoryId = CATEGORY_IDS[turnNumber - 1];
        if (!categoryId) throw new Error('Test game ran out of categories');
        session = dispatch(
          session,
          command('ASSIGN_CATEGORY', sequence++, {
            categoryId,
            assignmentRecordId: `assignment-${turnNumber}`,
            assignmentMode: turnOffset === 0 ? 'SELF_SELECTED' : 'OPPONENT_ASSIGNED',
          }),
        ).session;
        session = dispatch(
          session,
          command('SELECT_CHALLENGE', sequence++, {
            activeChallenge: createChallenge(categoryId, difficulty, turnNumber),
          }),
        ).session;
        session = dispatch(session, command('CONFIRM_CHALLENGE', sequence++, {})).session;
        session = dispatch(session, command('MARK_VIDEO_READY', sequence++, {})).session;
        session = dispatch(session, command('PLAY_VIDEO', sequence++, {})).session;
        session = dispatch(session, command('MARK_VIDEO_PAUSED', sequence++, {})).session;

        const includesSteal = difficulty === 1 && turnOffset === 0;
        session = dispatch(
          session,
          command('CLASSIFY_PRIMARY', sequence++, {
            result: includesSteal ? 'MOSTLY_CORRECT' : 'PERFECT',
          }),
        ).session;
        session = dispatch(session, command('CONFIRM_PRIMARY_RESULT', sequence++, {})).session;
        if (includesSteal) {
          session = dispatch(
            session,
            command('ACCEPT_STEAL', sequence++, { stealAttemptId: 'steal-1' }),
          ).session;
          session = dispatch(
            session,
            command('CLASSIFY_STEAL', sequence++, { result: 'PERFECT' }),
          ).session;
          session = dispatch(session, command('CONFIRM_STEAL_RESULT', sequence++, {})).session;
        }
        session = dispatch(session, command('COMPLETE_VERIFICATION', sequence++, {})).session;
        session = dispatch(session, command('CONFIRM_SCORE', sequence++, {})).session;
        session = dispatch(
          session,
          command('COMPLETE_TURN', sequence++, {
            ...(turnOffset === 0
              ? {
                  nextTurnId: `turn-${turnNumber + 1}`,
                  nextPrimaryAttemptId: `primary-${turnNumber + 1}`,
                }
              : {}),
          }),
        ).session;
      }

      expect(session.phase).toBe(difficulty === 5 ? 'GAME_SUMMARY' : 'LEVEL_SUMMARY');
    }

    expect(session.status).toBe('COMPLETED');
    expect(session.turnHistory).toHaveLength(10);
    expect(session.levelHistory).toHaveLength(5);
    expect(session.consumedCategoryIds).toEqual(CATEGORY_IDS);
    expect(session.processedCommandIds.length).toBeLessThanOrEqual(100);
    expect(() => gameSessionSchema.parse(session)).not.toThrow();
  });
});

import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { getWinningTeams } from '../../domain/engine';
import type { AnswerResult, CategoryAssignmentMode, LifelineType } from '../../domain/enums';
import type { GameSession } from '../../domain/models/game';
import type { ScoreBreakdown } from '../../domain/models/score';
import type { TimerSnapshot } from '../../services/timer';
import { useGameplayStore } from '../../store/gameplayStore';
import { GAMEPLAY_CATEGORIES } from './gameplayCatalog';
import { GameplayVideoStage } from './GameplayVideoStage';
import styles from './GamePage.module.css';
import { useGameplayRuntime } from './useGameplayRuntime';

const RESULT_LABELS: Record<AnswerResult, string> = {
  PERFECT: 'Perfect',
  MOSTLY_CORRECT: 'Mostly Correct',
  WRONG: 'Wrong',
  DECLINED: 'Declined',
};

const ASSIGNMENT_LABELS: Record<CategoryAssignmentMode, string> = {
  SELF_SELECTED: 'Playing team chooses',
  OPPONENT_ASSIGNED: 'Opponent assigns',
  HOST_ASSIGNED: 'Host assigns',
};

function downloadRecoveryData(data: string) {
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `lyric-lockout-recovery-${new Date().toISOString()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function TeamSetup() {
  const startSetup = useGameplayStore((state) => state.startSetup);
  const completedSummaries = useGameplayStore((state) => state.completedSummaries);
  const persistenceError = useGameplayStore((state) => state.persistenceError);
  const clearPersistenceError = useGameplayStore((state) => state.clearPersistenceError);
  const [teamOne, setTeamOne] = useState('Team Sunset');
  const [teamTwo, setTeamTwo] = useState('Team Starlight');
  const [validation, setValidation] = useState<string | undefined>();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!teamOne.trim() || !teamTwo.trim()) {
      setValidation('Both teams need a name.');
      return;
    }
    if (teamOne.trim().toLocaleLowerCase() === teamTwo.trim().toLocaleLowerCase()) {
      setValidation('Choose two different team names.');
      return;
    }
    startSetup(teamOne.trim(), teamTwo.trim());
  };

  return (
    <section className={styles.setup}>
      <div>
        <p className={styles.eyebrow}>New game</p>
        <h1>Bring two teams to the stage.</h1>
        <p>
          Ten categories, five levels, and one host who makes the final call. Active games are saved
          in this browser after every meaningful host action.
        </p>
        {completedSummaries.length > 0 && (
          <div className={styles.recentGames}>
            <h2>Recent games</h2>
            {completedSummaries.slice(0, 5).map((summary) => (
              <article key={summary.gameId}>
                <strong>
                  {summary.teams
                    .filter((team) => summary.winnerTeamIds.includes(team.id))
                    .map((team) => team.name)
                    .join(' & ')}
                </strong>
                <span>{summary.teams.map((team) => `${team.name} ${team.score}`).join(' · ')}</span>
              </article>
            ))}
          </div>
        )}
      </div>
      <form className={styles.setupForm} onSubmit={submit}>
        <label>
          Team one
          <input
            autoComplete="off"
            maxLength={40}
            onChange={(event) => setTeamOne(event.target.value)}
            value={teamOne}
          />
        </label>
        <label>
          Team two
          <input
            autoComplete="off"
            maxLength={40}
            onChange={(event) => setTeamTwo(event.target.value)}
            value={teamTwo}
          />
        </label>
        {validation && <p className={styles.formError}>{validation}</p>}
        <button className={styles.primaryButton} type="submit">
          Build the round
        </button>
        {persistenceError && (
          <div className={styles.inlineError} role="alert">
            <span>{persistenceError}</span>
            <button onClick={clearPersistenceError} type="button">
              Dismiss
            </button>
          </div>
        )}
      </form>
    </section>
  );
}

function SavedGamePrompt() {
  const {
    savedSession,
    savedSessionIssue,
    persistenceError,
    resumeSavedGame,
    discardSavedGame,
    exportRecoveryData,
    clearPersistenceError,
  } = useGameplayStore();

  const exportData = () => downloadRecoveryData(exportRecoveryData());

  if (savedSession) {
    const teamNames = savedSession.teams.map((team) => team.name).join(' vs ');
    return (
      <section className={styles.resumeShell}>
        <p className={styles.eyebrow}>Saved game found</p>
        <h1>Resume {teamNames}?</h1>
        <p>
          The game will reopen at a safe host-controlled phase. Media, suspense audio, and any
          answering timer will remain paused.
        </p>
        <div className={styles.actionRow}>
          <button className={styles.primaryButton} onClick={resumeSavedGame} type="button">
            Resume saved game
          </button>
          <button className={styles.secondaryButton} onClick={discardSavedGame} type="button">
            Discard saved game
          </button>
        </div>
        {persistenceError && (
          <div className={styles.inlineError} role="alert">
            <span>{persistenceError}</span>
            <button onClick={exportData} type="button">
              Export saved data
            </button>
            <button onClick={clearPersistenceError} type="button">
              Dismiss
            </button>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className={styles.resumeShell}>
      <p className={styles.eyebrow}>Recovery needed</p>
      <h1>Saved game needs attention.</h1>
      <p>{savedSessionIssue?.message}</p>
      <p>The original browser data has not been changed.</p>
      <div className={styles.actionRow}>
        <button className={styles.primaryButton} onClick={exportData} type="button">
          Export saved data
        </button>
        <button className={styles.secondaryButton} onClick={discardSavedGame} type="button">
          Discard saved game
        </button>
      </div>
      {persistenceError && (
        <div className={styles.inlineError} role="alert">
          <span>{persistenceError}</span>
          <button onClick={clearPersistenceError} type="button">
            Dismiss
          </button>
        </div>
      )}
    </section>
  );
}

function ScoreStrip({ session }: { session: GameSession }) {
  return (
    <footer className={styles.scoreStrip} aria-label="Team scores">
      {session.teams.map((team) => (
        <div
          className={team.id === session.activeTurn?.primaryTeamId ? styles.activeTeam : undefined}
          key={team.id}
        >
          <span>{team.name}</span>
          <strong>{team.score}</strong>
        </div>
      ))}
    </footer>
  );
}

function Stage({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string | undefined;
  children: ReactNode;
}) {
  return (
    <section className={styles.stage}>
      <header className={styles.stageHeader}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </header>
      <div className={styles.stageBody}>{children}</div>
    </section>
  );
}

function TimerPanel({
  snapshot,
  send,
  adjustTimer,
}: {
  snapshot: TimerSnapshot;
  send: ReturnType<typeof useGameplayStore.getState>['send'];
  adjustTimer: (deltaMilliseconds: number) => void;
}) {
  const seconds = Math.ceil(snapshot.remainingMilliseconds / 1000);
  return (
    <aside className={styles.timerPanel} aria-label="Host timer controls">
      <div>
        <span>Timer</span>
        <strong>{snapshot.status === 'DISABLED' ? 'Off' : `${seconds}s`}</strong>
        <small>{snapshot.status}</small>
      </div>
      <div className={styles.compactActions}>
        <button
          disabled={snapshot.status !== 'RUNNING'}
          onClick={() =>
            send({
              type: 'PAUSE_TIMER',
              remainingMilliseconds: snapshot.remainingMilliseconds,
            })
          }
          type="button"
        >
          Pause
        </button>
        <button
          disabled={snapshot.status !== 'PAUSED'}
          onClick={() => send({ type: 'RESUME_TIMER' })}
          type="button"
        >
          Resume
        </button>
        <button onClick={() => send({ type: 'RESTART_TIMER' })} type="button">
          Restart
        </button>
        <button onClick={() => adjustTimer(10_000)} type="button">
          +10 sec
        </button>
        <button onClick={() => adjustTimer(-10_000)} type="button">
          −10 sec
        </button>
        <button onClick={() => send({ type: 'DISABLE_TIMER' })} type="button">
          Disable
        </button>
        <button onClick={() => send({ type: 'END_TIMER' })} type="button">
          End
        </button>
      </div>
    </aside>
  );
}

function AnswerButtons({
  onClassify,
  includeDeclined = false,
}: {
  onClassify: (result: AnswerResult) => void;
  includeDeclined?: boolean;
}) {
  const results: AnswerResult[] = includeDeclined
    ? ['PERFECT', 'MOSTLY_CORRECT', 'WRONG', 'DECLINED']
    : ['PERFECT', 'MOSTLY_CORRECT', 'WRONG'];
  return (
    <div className={styles.resultGrid}>
      {results.map((result) => (
        <button
          className={result === 'PERFECT' ? styles.primaryButton : styles.secondaryButton}
          key={result}
          onClick={() => onClassify(result)}
          type="button"
        >
          {RESULT_LABELS[result]}
        </button>
      ))}
    </div>
  );
}

function LifelineButtons({
  session,
  teamId,
  activateLifeline,
}: {
  session: GameSession;
  teamId: string;
  activateLifeline: (teamId: string, lifelineType: LifelineType) => void;
}) {
  const team = session.teams.find((candidate) => candidate.id === teamId);
  if (!team) return null;
  const label = (type: LifelineType) => {
    const count = type === 'HINT' ? team.lifelines.hintUseCount : team.lifelines.askFriendUseCount;
    return `${type === 'HINT' ? 'Hint' : 'Ask a Friend'} · ${count === 0 ? 'Free' : '−25'}`;
  };
  return (
    <div className={styles.lifelineRow} aria-label="Contextual lifelines">
      <button onClick={() => activateLifeline(teamId, 'HINT')} type="button">
        {label('HINT')}
      </button>
      <button onClick={() => activateLifeline(teamId, 'ASK_FRIEND')} type="button">
        {label('ASK_FRIEND')}
      </button>
    </div>
  );
}

function ScoreCard({ label, score }: { label: string; score: ScoreBreakdown }) {
  return (
    <article className={styles.scoreCard}>
      <span>{label}</span>
      <strong>{score.finalAwardedPoints}</strong>
      <dl>
        <div>
          <dt>Base</dt>
          <dd>{score.baseAllocatedPoints}</dd>
        </div>
        <div>
          <dt>Lifelines</dt>
          <dd>−{score.lifelinePenaltyPoints}</dd>
        </div>
        <div>
          <dt>Recommended</dt>
          <dd>{score.recommendedPoints}</dd>
        </div>
        {score.overridden && (
          <div>
            <dt>Host adjustment</dt>
            <dd>{score.hostAdjustmentPoints}</dd>
          </div>
        )}
      </dl>
    </article>
  );
}

function ScoreReview({
  session,
  send,
}: {
  session: GameSession;
  send: ReturnType<typeof useGameplayStore.getState>['send'];
}) {
  const score = session.activeTurn?.score;
  const [primaryOverride, setPrimaryOverride] = useState('');
  const [stealOverride, setStealOverride] = useState('');
  if (!score) return <p>Score recommendation unavailable.</p>;

  const applyOverride = (target: 'PRIMARY' | 'STEAL', rawValue: string) => {
    const finalAwardedPoints = Number(rawValue);
    if (!Number.isInteger(finalAwardedPoints)) return;
    send({
      type: 'OVERRIDE_SCORE',
      target,
      finalAwardedPoints,
      reason: 'Host adjustment',
    });
  };

  return (
    <>
      <div className={styles.scoreCards}>
        <ScoreCard label="Primary team" score={score.primary} />
        {score.steal && <ScoreCard label="Stealing team" score={score.steal} />}
      </div>
      <details className={styles.overridePanel}>
        <summary>Host score override</summary>
        <div className={styles.overrideFields}>
          <label>
            Primary final points
            <input
              inputMode="numeric"
              onChange={(event) => setPrimaryOverride(event.target.value)}
              value={primaryOverride}
            />
          </label>
          <button
            disabled={!primaryOverride}
            onClick={() => applyOverride('PRIMARY', primaryOverride)}
            type="button"
          >
            Apply primary override
          </button>
          {score.steal && (
            <>
              <label>
                Steal final points
                <input
                  inputMode="numeric"
                  onChange={(event) => setStealOverride(event.target.value)}
                  value={stealOverride}
                />
              </label>
              <button
                disabled={!stealOverride}
                onClick={() => applyOverride('STEAL', stealOverride)}
                type="button"
              >
                Apply steal override
              </button>
            </>
          )}
        </div>
      </details>
      <button
        className={styles.primaryButton}
        onClick={() => send({ type: 'CONFIRM_SCORE' })}
        type="button"
      >
        Confirm and apply score
      </button>
    </>
  );
}

interface PhaseStageProps {
  session: GameSession;
  timerSnapshot: TimerSnapshot;
  fakeMedia: boolean;
  send: ReturnType<typeof useGameplayStore.getState>['send'];
  selectChallenge: () => void;
  assignCategory: (categoryId: string, assignmentMode: CategoryAssignmentMode) => void;
  confirmTurnOrder: (teamId: string) => void;
  activateLifeline: (teamId: string, lifelineType: LifelineType) => void;
  acceptSteal: () => void;
  declineSteal: () => void;
  completeTurn: () => void;
  adjustTimer: (deltaMilliseconds: number) => void;
  onVideoReady: () => void;
  onVideoPlay: () => boolean;
  onVideoPaused: () => void;
  onCompleteVerification: () => void;
}

function PhaseStage(props: PhaseStageProps) {
  const {
    session,
    timerSnapshot,
    fakeMedia,
    send,
    selectChallenge: chooseChallenge,
    assignCategory,
    confirmTurnOrder,
    activateLifeline,
    acceptSteal,
    declineSteal,
    completeTurn,
    adjustTimer,
    onVideoReady,
    onVideoPlay,
    onVideoPaused,
    onCompleteVerification,
  } = props;
  const [assignmentMode, setAssignmentMode] = useState<CategoryAssignmentMode>('SELF_SELECTED');
  const turn = session.activeTurn;
  const activeTeam = session.teams.find((team) => team.id === turn?.primaryTeamId);
  const opposingTeam = session.teams.find((team) => team.id === turn?.opposingTeamId);
  const challenge = session.activeChallenge;

  switch (session.phase) {
    case 'ROUND_BUILDING':
      return (
        <Stage
          eyebrow="Round builder"
          title="Ten categories are locked in."
          description="Every category has fictional demo challenges at all five levels."
        >
          <div className={styles.categoryGrid}>
            {GAMEPLAY_CATEGORIES.map((category) => (
              <article className={styles.categoryCard} key={category.id}>
                <span aria-hidden="true">{category.icon}</span>
                <strong>{category.name}</strong>
              </article>
            ))}
          </div>
          <button
            className={styles.primaryButton}
            onClick={() => send({ type: 'VALIDATE_ROUND' })}
            type="button"
          >
            Validate round
          </button>
        </Stage>
      );
    case 'ROUND_VALIDATION':
      return (
        <Stage
          eyebrow="Round ready"
          title="Coverage checked. Teams ready."
          description="Two teams will play one primary challenge each across five levels."
        >
          <button
            className={styles.primaryButton}
            onClick={() => send({ type: 'START_GAME' })}
            type="button"
          >
            Start game
          </button>
        </Stage>
      );
    case 'LEVEL_INTRO':
      return (
        <Stage
          eyebrow={`Level ${session.currentDifficulty} of 5`}
          title={`Level ${session.currentDifficulty}`}
          description={`${session.gameConfig.fullPointsByDifficulty[session.currentDifficulty]} points · ${session.gameConfig.answerSecondsByDifficulty[session.currentDifficulty]} seconds`}
        >
          <button
            className={styles.primaryButton}
            onClick={() => send({ type: 'BEGIN_TRIVIA' })}
            type="button"
          >
            Begin trivia
          </button>
        </Stage>
      );
    case 'TRIVIA_RESULT_ENTRY':
      return (
        <Stage
          eyebrow={`Level ${session.currentDifficulty} trivia`}
          title="Who won the trivia question?"
          description="The host records the result manually."
        >
          <div className={styles.teamChoice}>
            {session.teams.map((team) => (
              <button
                className={styles.secondaryButton}
                key={team.id}
                onClick={() => send({ type: 'RECORD_TRIVIA_WINNER', teamId: team.id })}
                type="button"
              >
                {team.name}
              </button>
            ))}
          </div>
        </Stage>
      );
    case 'TURN_ORDER_CONFIRMATION':
      return (
        <Stage
          eyebrow="Turn order"
          title="Who plays first this level?"
          description="The trivia winner decides; the host records the choice."
        >
          <div className={styles.teamChoice}>
            {session.teams.map((team) => (
              <button
                className={styles.secondaryButton}
                key={team.id}
                onClick={() => confirmTurnOrder(team.id)}
                type="button"
              >
                {team.name} plays first
              </button>
            ))}
          </div>
        </Stage>
      );
    case 'CATEGORY_ASSIGNMENT': {
      const availableCategories = GAMEPLAY_CATEGORIES.filter(
        (category) => !session.consumedCategoryIds.includes(category.id),
      );
      return (
        <Stage
          eyebrow={`${activeTeam?.name ?? 'Team'} · category`}
          title="Choose this turn’s category."
          description="Once selected, the category is consumed for the rest of the game."
        >
          <label className={styles.selectLabel}>
            Assignment method
            <select
              onChange={(event) => setAssignmentMode(event.target.value as CategoryAssignmentMode)}
              value={assignmentMode}
            >
              {Object.entries(ASSIGNMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.categoryGrid}>
            {availableCategories.map((category) => (
              <button
                className={styles.categoryButton}
                key={category.id}
                onClick={() => assignCategory(category.id, assignmentMode)}
                type="button"
              >
                <span aria-hidden="true">{category.icon}</span>
                {category.name}
              </button>
            ))}
          </div>
        </Stage>
      );
    }
    case 'CHALLENGE_SELECTION':
      return (
        <Stage
          eyebrow="Challenge selection"
          title="The next song is ready to draw."
          description="Played and rerolled challenges remain excluded."
        >
          <button className={styles.primaryButton} onClick={chooseChallenge} type="button">
            Select challenge
          </button>
        </Stage>
      );
    case 'CHALLENGE_PREVIEW':
      return (
        <Stage
          eyebrow={`${challenge?.category.name ?? 'Category'} · Level ${session.currentDifficulty}`}
          title={challenge?.song.title ?? 'Challenge preview'}
          description={challenge?.song.artist}
        >
          <div className={styles.previewStats}>
            <div>
              <span>Missing words</span>
              <strong>{challenge?.challenge.missingWordCount}</strong>
            </div>
            <div>
              <span>Playing team</span>
              <strong>{activeTeam?.name}</strong>
            </div>
          </div>
          <div className={styles.actionRow}>
            <button
              className={styles.secondaryButton}
              onClick={() => send({ type: 'REROLL_CHALLENGE' })}
              type="button"
            >
              Reroll song
            </button>
            <button
              className={styles.primaryButton}
              onClick={() => send({ type: 'CONFIRM_CHALLENGE' })}
              type="button"
            >
              Lock challenge
            </button>
          </div>
        </Stage>
      );
    case 'VIDEO_LOADING':
    case 'VIDEO_READY':
    case 'VIDEO_PLAYING':
      return (
        <Stage
          eyebrow={`${activeTeam?.name ?? 'Team'} · playback`}
          title="Listen for the lockout."
          description="Playback starts at the configured timestamp and pauses automatically."
        >
          <GameplayVideoStage
            fakeMedia={fakeMedia}
            onCompleteVerification={onCompleteVerification}
            onPaused={onVideoPaused}
            onPlay={onVideoPlay}
            onReady={onVideoReady}
            session={session}
          />
        </Stage>
      );
    case 'PRIMARY_ANSWERING': {
      const hintUsed = turn?.primaryAttempt?.lifelinesUsed.some((usage) => usage.type === 'HINT');
      const askFriendUsed = turn?.primaryAttempt?.lifelinesUsed.some(
        (usage) => usage.type === 'ASK_FRIEND',
      );
      return (
        <Stage
          eyebrow={`${activeTeam?.name ?? 'Team'} · primary answer`}
          title="Continue the lyrics."
          description="The host listens, then records the result. Timer expiry never decides it."
        >
          <TimerPanel adjustTimer={adjustTimer} send={send} snapshot={timerSnapshot} />
          <LifelineButtons
            session={session}
            teamId={turn?.primaryTeamId ?? ''}
            activateLifeline={activateLifeline}
          />
          {hintUsed && <p className={styles.reveal}>Hint: {challenge?.challenge.hintText}</p>}
          {askFriendUsed && (
            <p className={styles.reveal}>Ask a Friend is active — invite one helper now.</p>
          )}
          <AnswerButtons onClassify={(result) => send({ type: 'CLASSIFY_PRIMARY', result })} />
        </Stage>
      );
    }
    case 'PRIMARY_RESULT_REVIEW':
      return (
        <Stage
          eyebrow="Primary result"
          title={`${activeTeam?.name}: ${RESULT_LABELS[turn?.primaryAttempt?.result ?? 'WRONG']}`}
          description="Review the host classification before moving to steal eligibility."
        >
          <button
            className={styles.primaryButton}
            onClick={() => send({ type: 'CONFIRM_PRIMARY_RESULT' })}
            type="button"
          >
            Confirm primary result
          </button>
        </Stage>
      );
    case 'STEAL_OFFER':
      return (
        <Stage
          eyebrow="Steal opportunity"
          title={`${opposingTeam?.name}, want the steal?`}
          description="Only a Perfect steal earns points."
        >
          <div className={styles.actionRow}>
            <button className={styles.secondaryButton} onClick={declineSteal} type="button">
              Decline steal
            </button>
            <button className={styles.primaryButton} onClick={acceptSteal} type="button">
              Accept steal
            </button>
          </div>
        </Stage>
      );
    case 'STEAL_ANSWERING':
      return (
        <Stage
          eyebrow={`${opposingTeam?.name ?? 'Opposing team'} · steal`}
          title="Give the missing lyrics."
          description="The host records the steal result. Only Perfect will score."
        >
          <TimerPanel adjustTimer={adjustTimer} send={send} snapshot={timerSnapshot} />
          <AnswerButtons
            includeDeclined
            onClassify={(result) => send({ type: 'CLASSIFY_STEAL', result })}
          />
        </Stage>
      );
    case 'STEAL_RESULT_REVIEW':
      return (
        <Stage
          eyebrow="Steal result"
          title={`${opposingTeam?.name}: ${RESULT_LABELS[turn?.stealAttempt?.result ?? 'WRONG']}`}
          description="Review the host classification before revealing the expected lyrics."
        >
          <button
            className={styles.primaryButton}
            onClick={() => send({ type: 'CONFIRM_STEAL_RESULT' })}
            type="button"
          >
            Confirm steal result
          </button>
        </Stage>
      );
    case 'CHALLENGE_VERIFICATION':
      return (
        <Stage
          eyebrow="Verification"
          title="Reveal the lyric."
          description="Expected lyrics stay hidden until all steal decisions are resolved."
        >
          <blockquote className={styles.expectedLyrics}>
            {challenge?.challenge.expectedLyrics}
          </blockquote>
          <GameplayVideoStage
            fakeMedia={fakeMedia}
            onCompleteVerification={onCompleteVerification}
            onPaused={onVideoPaused}
            onPlay={onVideoPlay}
            onReady={onVideoReady}
            session={session}
          />
        </Stage>
      );
    case 'FINAL_SCORE_REVIEW':
      return (
        <Stage
          eyebrow="Final score review"
          title="Review before points are applied."
          description="Recommended and host-overridden values remain visible."
        >
          <ScoreReview send={send} session={session} />
        </Stage>
      );
    case 'TURN_SUMMARY':
      return (
        <Stage
          eyebrow="Turn summary"
          title={`${activeTeam?.name}’s turn is complete.`}
          description={`Primary: ${turn?.score?.primary.finalAwardedPoints ?? 0} · Steal: ${turn?.score?.steal?.finalAwardedPoints ?? 0}`}
        >
          <button className={styles.primaryButton} onClick={completeTurn} type="button">
            Continue
          </button>
        </Stage>
      );
    case 'LEVEL_SUMMARY': {
      const latestLevel = session.levelHistory.at(-1);
      return (
        <Stage
          eyebrow={`Level ${latestLevel?.difficulty ?? session.currentDifficulty} complete`}
          title="Level summary"
          description="Both teams completed one primary challenge."
        >
          <div className={styles.scoreCards}>
            {latestLevel?.teamScores.map((score) => (
              <article className={styles.scoreCard} key={score.teamId}>
                <span>{session.teams.find((team) => team.id === score.teamId)?.name}</span>
                <strong>+{score.pointsAwarded}</strong>
              </article>
            ))}
          </div>
          <button
            className={styles.primaryButton}
            onClick={() => send({ type: 'START_NEXT_LEVEL' })}
            type="button"
          >
            Start next level
          </button>
        </Stage>
      );
    }
    case 'GAME_SUMMARY': {
      const winners = getWinningTeams(session);
      return (
        <Stage
          eyebrow="Game complete"
          title={winners.length === 1 ? `${winners[0]?.name ?? 'A team'} wins!` : 'It’s a tie!'}
          description="All five levels and ten categories are complete."
        >
          <div className={styles.winnerScores}>
            {session.teams.map((team) => (
              <div key={team.id}>
                <span>{team.name}</span>
                <strong>{team.score}</strong>
              </div>
            ))}
          </div>
        </Stage>
      );
    }
    case 'RECOVERY':
      return (
        <Stage
          eyebrow="Recovery"
          title="The game is paused safely."
          description={session.recovery?.reason}
        >
          <button
            className={styles.primaryButton}
            onClick={() => send({ type: 'RESUME_FROM_RECOVERY' })}
            type="button"
          >
            Resume safely
          </button>
        </Stage>
      );
    case 'GAME_SETUP':
    case 'ERROR':
      return (
        <Stage eyebrow="Game setup" title="Preparing the stage.">
          <p>Please restart the local game if this screen does not advance.</p>
        </Stage>
      );
  }
}

function ActiveGame({ session }: { session: GameSession }) {
  const location = useLocation();
  const fakeMedia = new URLSearchParams(location.search).get('media') === 'fake';
  const {
    events,
    eventBatch,
    failure,
    pendingPaidLifeline,
    send,
    selectChallenge,
    assignCategory,
    confirmTurnOrder,
    activateLifeline,
    confirmPaidLifeline,
    dismissPaidLifeline,
    acceptSteal,
    declineSteal,
    completeTurn,
    adjustTimer,
    clearFailure,
    persistenceError,
    exportRecoveryData,
    clearPersistenceError,
    reset,
  } = useGameplayStore();

  const expireTimer = useCallback(() => {
    const phase = useGameplayStore.getState().session?.phase;
    if (phase === 'PRIMARY_ANSWERING' || phase === 'STEAL_ANSWERING') {
      useGameplayStore.getState().send({ type: 'TIMER_EXPIRED' });
    }
  }, []);
  const { timerSnapshot, audioError } = useGameplayRuntime(
    session,
    events,
    eventBatch,
    fakeMedia,
    expireTimer,
  );

  const onVideoReady = useCallback(() => {
    useGameplayStore.getState().send({ type: 'MARK_VIDEO_READY' });
  }, []);
  const onVideoPlay = useCallback(
    () => useGameplayStore.getState().send({ type: 'PLAY_VIDEO' }),
    [],
  );
  const onVideoPaused = useCallback(() => {
    useGameplayStore.getState().send({ type: 'MARK_VIDEO_PAUSED' });
  }, []);
  const onCompleteVerification = useCallback(() => {
    useGameplayStore.getState().send({ type: 'COMPLETE_VERIFICATION' });
  }, []);

  return (
    <section className={styles.gameplayShell}>
      <header className={styles.gameHeader}>
        <div>
          <span>Level {session.currentDifficulty}</span>
          <strong>{session.phase.replaceAll('_', ' ')}</strong>
        </div>
        <div className={styles.headerActions}>
          {fakeMedia && <span className={styles.fakeBadge}>Fake media</span>}
          <button onClick={reset} type="button">
            New game
          </button>
        </div>
      </header>

      <div className={styles.messages}>
        {failure && (
          <div className={styles.errorBanner} role="alert">
            <span>{failure}</span>
            <button onClick={clearFailure} type="button">
              Dismiss
            </button>
          </div>
        )}
        {audioError && (
          <div className={styles.notice} role="status">
            Audio is unavailable, but gameplay can continue: {audioError.message}
          </div>
        )}
        {persistenceError && (
          <div className={styles.errorBanner} role="alert">
            <span>{persistenceError} Gameplay can continue in memory.</span>
            <div className={styles.actionRow}>
              <button onClick={() => downloadRecoveryData(exportRecoveryData())} type="button">
                Export current game
              </button>
              <button onClick={clearPersistenceError} type="button">
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      <main className={styles.gameStage}>
        <PhaseStage
          acceptSteal={acceptSteal}
          adjustTimer={adjustTimer}
          assignCategory={assignCategory}
          completeTurn={completeTurn}
          confirmTurnOrder={confirmTurnOrder}
          declineSteal={declineSteal}
          fakeMedia={fakeMedia}
          onCompleteVerification={onCompleteVerification}
          onVideoPaused={onVideoPaused}
          onVideoPlay={onVideoPlay}
          onVideoReady={onVideoReady}
          selectChallenge={selectChallenge}
          send={send}
          session={session}
          timerSnapshot={timerSnapshot}
          activateLifeline={activateLifeline}
        />
      </main>

      <ScoreStrip session={session} />

      <details className={styles.hostDrawer}>
        <summary>Host controls</summary>
        <p>
          The host can resolve timer disputes from the answering screen and may safely pause the
          whole game.
        </p>
        {session.phase !== 'GAME_SUMMARY' && session.phase !== 'RECOVERY' && (
          <button
            onClick={() => send({ type: 'ENTER_RECOVERY', reason: 'Host paused the game' })}
            type="button"
          >
            Pause game safely
          </button>
        )}
      </details>

      {pendingPaidLifeline && (
        <div aria-labelledby="paid-lifeline-title" className={styles.modalBackdrop} role="dialog">
          <div className={styles.modal}>
            <p className={styles.eyebrow}>Paid lifeline</p>
            <h2 id="paid-lifeline-title">Confirm −{pendingPaidLifeline.penaltyPoints} points?</h2>
            <p>
              The team has already used its free{' '}
              {pendingPaidLifeline.lifelineType.toLowerCase().replace('_', ' ')}.
            </p>
            <div className={styles.actionRow}>
              <button
                className={styles.secondaryButton}
                onClick={dismissPaidLifeline}
                type="button"
              >
                Cancel
              </button>
              <button className={styles.primaryButton} onClick={confirmPaidLifeline} type="button">
                Confirm paid lifeline
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function GamePage() {
  const { session, persistenceStatus, savedSession, savedSessionIssue, initializePersistence } =
    useGameplayStore();

  useEffect(() => {
    initializePersistence();
  }, [initializePersistence]);

  if (persistenceStatus !== 'READY') {
    return (
      <section className={styles.resumeShell} aria-live="polite">
        <p className={styles.eyebrow}>Local game</p>
        <h1>Checking for a saved game…</h1>
      </section>
    );
  }
  if (!session && (savedSession || savedSessionIssue)) return <SavedGamePrompt />;
  return session ? <ActiveGame session={session} /> : <TeamSetup />;
}

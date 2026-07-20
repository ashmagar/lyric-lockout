import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { LyricPuzzle } from '../../components/LyricPuzzle/LyricPuzzle';
import { analyzeCatalogCoverage, buildRoundConfig, selectChallenge } from '../../domain/catalog';
import { createGame, getCategoryConsumptionRecord, getWinningTeams } from '../../domain/engine';
import type { AnswerResult, CategoryAssignmentMode, LifelineType } from '../../domain/enums';
import type { Category } from '../../domain/models/catalog';
import type { GameSession } from '../../domain/models/game';
import type { ScoreBreakdown } from '../../domain/models/score';
import type { TimerSnapshot } from '../../services/timer';
import { useAdminStore } from '../../store/adminStore';
import { useGameplayStore } from '../../store/gameplayStore';
import { resolveCategoryIcon } from '../../utils/categoryIcon';
import { GameplayVideoStage } from './GameplayVideoStage';
import { buildRuntimeChallengeSelectionRequest, getRuntimeCatalogIndex } from './runtimeCatalog';
import styles from './GamePage.module.css';
import { useGameplayRuntime } from './useGameplayRuntime';

const RESULT_LABELS: Record<AnswerResult, string> = {
  PERFECT: 'Perfect',
  MOSTLY_CORRECT: 'Mostly Correct',
  WRONG: 'Wrong',
  DECLINED: 'Declined',
};

interface CategoryAssignmentGridProps {
  assignmentMode: CategoryAssignmentMode;
  categories: readonly Category[];
  onAssign: (categoryId: string, assignmentMode: CategoryAssignmentMode) => void;
  session: GameSession;
}

export function CategoryAssignmentGrid({
  assignmentMode,
  categories,
  onAssign,
  session,
}: CategoryAssignmentGridProps) {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const configuredCategories = session.roundConfig.selectedCategoryIds.flatMap((categoryId) => {
    const category = categoriesById.get(categoryId);
    return category ? [category] : [];
  });

  return (
    <div className={styles.categoryGrid}>
      {configuredCategories.map((category, index) => {
        const isConsumed = session.consumedCategoryIds.includes(category.id);
        const availability = selectChallenge(
          getRuntimeCatalogIndex(),
          buildRuntimeChallengeSelectionRequest(session, category.id),
          () => 0,
        );
        const isAvailable = category.enabled && availability.ok;
        const onlyPlayedSongsRemain =
          !availability.ok &&
          availability.diagnostics.some((diagnostic) => diagnostic.code === 'ALL_SONGS_EXCLUDED');
        const consumption = getCategoryConsumptionRecord(session, category.id);
        const consumingTeam = session.teams.find((team) => team.id === consumption?.teamId);
        const isCurrent = !isConsumed && session.activeTurn?.categoryId === category.id;
        const state = isConsumed
          ? 'CONSUMED'
          : isCurrent
            ? 'CURRENT'
            : isAvailable
              ? 'AVAILABLE'
              : 'DISABLED';
        const statusLabel = isConsumed
          ? `Used by ${consumingTeam?.name ?? 'unknown team'}`
          : !isAvailable
            ? onlyPlayedSongsRemain
              ? 'No unused songs left'
              : 'Unavailable'
            : 'Available';
        return (
          <button
            aria-label={state === 'AVAILABLE' ? category.name : `${category.name} ${statusLabel}`}
            className={[
              styles.categoryButton,
              styles[`categoryTone${(index % 5) + 1}`] ?? '',
              isConsumed ? styles.consumedCategory : '',
              isCurrent ? styles.currentCategory : '',
            ]
              .filter(Boolean)
              .join(' ')}
            data-category-state={state}
            disabled={isConsumed || !isAvailable}
            key={category.id}
            onClick={() => onAssign(category.id, assignmentMode)}
            type="button"
          >
            <span aria-hidden="true" className={styles.categoryCardNumber}>
              {String(index + 1).padStart(2, '0')}
            </span>
            <span aria-hidden="true" className={styles.categoryCardIcon}>
              {resolveCategoryIcon(category.icon)}
            </span>
            <strong>{category.name}</strong>
            <small className={styles.categoryStatus}>
              {isConsumed && <span aria-hidden="true">✓</span>}
              {statusLabel}
            </small>
          </button>
        );
      })}
    </div>
  );
}

function downloadRecoveryData(data: string) {
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `lyric-lockout-recovery-${new Date().toISOString()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

interface CustomCategorySetupProps {
  onChange: (categoryIds: string[]) => void;
  onContinue: () => void;
  selectedCategoryIds: readonly string[];
}

function CustomCategorySetup({
  onChange,
  onContinue,
  selectedCategoryIds,
}: CustomCategorySetupProps) {
  const catalog = getRuntimeCatalogIndex();
  const categories = catalog.snapshot.categories;
  const coverageByCategoryId = useMemo(
    () =>
      new Map(
        analyzeCatalogCoverage(catalog).categories.map((coverage) => [
          coverage.categoryId,
          coverage,
        ]),
      ),
    [catalog],
  );
  const songCountByCategoryId = useMemo(
    () =>
      new Map(
        categories.map((category) => [
          category.id,
          catalog.snapshot.songs.filter(
            (song) => song.enabled && song.categoryIds.includes(category.id),
          ).length,
        ]),
      ),
    [catalog.snapshot.songs, categories],
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [coverageFilter, setCoverageFilter] = useState<'ALL' | 'READY' | 'NEEDS_WORK'>('ALL');
  const [activeAvailableId, setActiveAvailableId] = useState<string | undefined>();
  const [activeSelectedId, setActiveSelectedId] = useState<string | undefined>();
  const [showHelp, setShowHelp] = useState(false);

  const visibleCategories = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    return categories.filter((category) => {
      const isReady = coverageByCategoryId.get(category.id)?.isReady ?? false;
      if (coverageFilter === 'READY' && !isReady) return false;
      if (coverageFilter === 'NEEDS_WORK' && isReady) return false;
      return !normalizedQuery || category.name.toLocaleLowerCase().includes(normalizedQuery);
    });
  }, [categories, coverageByCategoryId, coverageFilter, searchQuery]);

  const selectedCategories = selectedCategoryIds.flatMap((categoryId) => {
    const category = categories.find((candidate) => candidate.id === categoryId);
    return category ? [category] : [];
  });

  const toggleCategory = (categoryId: string) => {
    if (selectedCategoryIds.includes(categoryId)) {
      onChange(selectedCategoryIds.filter((id) => id !== categoryId));
      return;
    }
    const category = categories.find((candidate) => candidate.id === categoryId);
    if (!category?.enabled || selectedCategoryIds.length >= 10) return;
    onChange([...selectedCategoryIds, categoryId]);
  };

  const addAllVisible = () => {
    const additions = visibleCategories
      .filter((category) => category.enabled && !selectedCategoryIds.includes(category.id))
      .map((category) => category.id);
    onChange([...selectedCategoryIds, ...additions].slice(0, 10));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedCategoryIds.length === 10) onContinue();
  };

  return (
    <form className={styles.categorySetup} onSubmit={submit}>
      <button className={styles.categoryHelpButton} onClick={() => setShowHelp(true)} type="button">
        <span aria-hidden="true">?</span>
        How it works
      </button>

      <header className={styles.categorySetupHeader}>
        <p aria-hidden="true">
          ♫ <span>✦</span> ♪
        </p>
        <h1>Custom Categories</h1>
        <span aria-hidden="true" />
        <p>Choose exactly 10 categories for today’s game</p>
      </header>

      <div className={styles.categoryPicker}>
        <section className={styles.availablePanel} aria-labelledby="all-categories-title">
          <h2 id="all-categories-title">All Categories ({categories.length})</h2>
          <div className={styles.categoryFilters}>
            <label className={styles.categorySearch}>
              <span className={styles.visuallyHidden}>Search categories</span>
              <input
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search categories…"
                type="search"
                value={searchQuery}
              />
              <span aria-hidden="true">⌕</span>
            </label>
            <label>
              <span className={styles.visuallyHidden}>Filter category readiness</span>
              <select
                onChange={(event) =>
                  setCoverageFilter(event.target.value as 'ALL' | 'READY' | 'NEEDS_WORK')
                }
                value={coverageFilter}
              >
                <option value="ALL">All categories</option>
                <option value="READY">Gameplay ready</option>
                <option value="NEEDS_WORK">Needs challenges</option>
              </select>
            </label>
          </div>

          <div aria-label="Available categories" className={styles.availableList} role="listbox">
            {visibleCategories.map((category) => {
              const isSelected = selectedCategoryIds.includes(category.id);
              const isReady = coverageByCategoryId.get(category.id)?.isReady ?? false;
              return (
                <button
                  aria-selected={activeAvailableId === category.id}
                  className={[
                    styles.availableRow,
                    activeAvailableId === category.id ? styles.activeAvailableRow : '',
                    isSelected ? styles.chosenAvailableRow : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={!category.enabled}
                  key={category.id}
                  onClick={() => setActiveAvailableId(category.id)}
                  onDoubleClick={() => toggleCategory(category.id)}
                  role="option"
                  type="button"
                >
                  <span aria-hidden="true">{resolveCategoryIcon(category.icon)}</span>
                  <strong>{category.name}</strong>
                  <small>
                    {songCountByCategoryId.get(category.id) ?? 0} songs ·{' '}
                    {category.enabled ? (isReady ? 'Ready' : 'Needs challenges') : 'Disabled'}
                  </small>
                  {isSelected && <b aria-label="Selected">✓</b>}
                </button>
              );
            })}
            {visibleCategories.length === 0 && (
              <p className={styles.noCategories}>No categories match these filters.</p>
            )}
          </div>
        </section>

        <div className={styles.transferControls} aria-label="Category selection controls">
          <button
            className={styles.activeTransfer}
            disabled={
              !activeAvailableId ||
              selectedCategoryIds.includes(activeAvailableId) ||
              selectedCategoryIds.length >= 10 ||
              !categories.find((category) => category.id === activeAvailableId)?.enabled
            }
            onClick={() => activeAvailableId && toggleCategory(activeAvailableId)}
            type="button"
          >
            <span aria-hidden="true">→</span>
            Add
          </button>
          <button
            disabled={!activeSelectedId}
            onClick={() => activeSelectedId && toggleCategory(activeSelectedId)}
            type="button"
          >
            <span aria-hidden="true">←</span>
            Remove
          </button>
          <button
            disabled={
              selectedCategoryIds.length >= 10 ||
              !visibleCategories.some(
                (category) => category.enabled && !selectedCategoryIds.includes(category.id),
              )
            }
            onClick={addAllVisible}
            type="button"
          >
            <span aria-hidden="true">≫</span>
            Add up to 10
          </button>
          <button
            disabled={selectedCategoryIds.length === 0}
            onClick={() => onChange([])}
            type="button"
          >
            <span aria-hidden="true">≪</span>
            Remove all
          </button>
          <p>
            <span aria-hidden="true">💡</span>
            Double-click a category to add or remove it.
          </p>
        </div>

        <section className={styles.selectedPanel} aria-labelledby="selected-categories-title">
          <header>
            <h2 id="selected-categories-title">Selected Categories</h2>
            <strong>{selectedCategoryIds.length} / 10</strong>
          </header>
          <p>You must select exactly 10 categories to continue.</p>
          <div className={styles.selectedList} role="list">
            {selectedCategories.map((category) => (
              <div
                className={activeSelectedId === category.id ? styles.activeSelectedRow : undefined}
                key={category.id}
                role="listitem"
              >
                <button
                  aria-pressed={activeSelectedId === category.id}
                  onClick={() => setActiveSelectedId(category.id)}
                  type="button"
                >
                  <span aria-hidden="true">{resolveCategoryIcon(category.icon)}</span>
                  <strong>{category.name}</strong>
                </button>
                <span aria-hidden="true" className={styles.dragHandle}>
                  ⠿
                </span>
                <button
                  aria-label={`Remove ${category.name}`}
                  className={styles.removeCategoryButton}
                  onClick={() => toggleCategory(category.id)}
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className={styles.selectionNotice} role="status">
            <span aria-hidden="true">ⓘ</span>
            {selectedCategoryIds.length === 10 ? (
              <p>
                <strong>Category limit reached (10/10).</strong>
                Remove one to add another.
              </p>
            ) : (
              <p>
                <strong>{10 - selectedCategoryIds.length} selections remaining.</strong>
                Add categories until the list reaches ten.
              </p>
            )}
          </div>
        </section>
      </div>

      <footer className={styles.categorySetupFooter}>
        <div>
          <span aria-hidden="true">▱</span>
          <p>
            <strong>{selectedCategoryIds.length} Categories</strong> Selected
          </p>
        </div>
        <button disabled={selectedCategoryIds.length !== 10} type="submit">
          Continue <span aria-hidden="true">→</span>
        </button>
      </footer>

      {showHelp && (
        <div
          aria-labelledby="category-help-title"
          aria-modal="true"
          className={styles.modalBackdrop}
          role="dialog"
        >
          <div className={styles.modal}>
            <p className={styles.eyebrow}>Custom categories</p>
            <h2 id="category-help-title">Build your ten-category game.</h2>
            <ol>
              <li>Search or filter the available category list.</li>
              <li>Add exactly ten enabled categories.</li>
              <li>Continue to name the teams and review the round.</li>
            </ol>
            <button
              className={styles.primaryButton}
              onClick={() => setShowHelp(false)}
              type="button"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

function TeamSetup() {
  const location = useLocation();
  const setupMode =
    new URLSearchParams(location.search).get('setup') === 'random' ? 'random' : 'custom';
  const startSetup = useGameplayStore((state) => state.startSetup);
  const completedSummaries = useGameplayStore((state) => state.completedSummaries);
  const persistenceError = useGameplayStore((state) => state.persistenceError);
  const clearPersistenceError = useGameplayStore((state) => state.clearPersistenceError);
  const gameplayFailure = useGameplayStore((state) => state.failure);
  const clearFailure = useGameplayStore((state) => state.clearFailure);
  const catalog = getRuntimeCatalogIndex();
  const categories = catalog.snapshot.categories;
  const [teamOne, setTeamOne] = useState('Team Sunset');
  const [teamTwo, setTeamTwo] = useState('Team Starlight');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(() => {
    if (setupMode === 'random') {
      const result = buildRoundConfig(
        {
          categorySelectionMode: 'RANDOM',
          songSelectionMode: 'FULL_CATALOG',
          manualCategoryIds: [],
          manualChallengePools: [],
          preventChallengeReuse: true,
          preventSongReuse: true,
          allowRuntimeReroll: true,
        },
        catalog,
        Math.random,
      );
      if (result.ok) return result.config.selectedCategoryIds;
    }
    return categories
      .filter((category) => category.enabled)
      .slice(0, 10)
      .map((category) => category.id);
  });
  const [validation, setValidation] = useState<string | undefined>();
  const [categoryStepComplete, setCategoryStepComplete] = useState(setupMode === 'random');

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
    if (selectedCategoryIds.length !== 10) {
      setValidation('Select exactly ten enabled categories.');
      return;
    }
    startSetup(
      teamOne.trim(),
      teamTwo.trim(),
      selectedCategoryIds,
      setupMode === 'random' ? 'RANDOM' : 'MANUAL',
    );
  };

  if (setupMode === 'custom' && !categoryStepComplete) {
    return (
      <CustomCategorySetup
        onChange={(categoryIds) => {
          setSelectedCategoryIds(categoryIds);
          setValidation(undefined);
        }}
        onContinue={() => setCategoryStepComplete(true)}
        selectedCategoryIds={selectedCategoryIds}
      />
    );
  }

  return (
    <section className={styles.setup}>
      <div>
        <p className={styles.eyebrow}>New game</p>
        <h1>Bring two teams to the stage.</h1>
        <p>
          {setupMode === 'random'
            ? 'Ten eligible categories have been selected at random. Name the teams, then review the round.'
            : 'Name two teams and choose exactly ten categories. Active games are saved after every meaningful host action.'}
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
        {setupMode === 'custom' ? (
          <div className={styles.setupCategories}>
            <strong>Custom category mix ready</strong>
            <p>{selectedCategoryIds.length} categories selected for this game.</p>
            <button
              className={styles.secondaryButton}
              onClick={() => setCategoryStepComplete(false)}
              type="button"
            >
              Change categories
            </button>
          </div>
        ) : (
          <div className={styles.setupCategories}>
            <strong>Random category mix ready</strong>
            <p>{selectedCategoryIds.length} eligible categories selected for this game.</p>
          </div>
        )}
        {validation && <p className={styles.formError}>{validation}</p>}
        {gameplayFailure && (
          <div className={styles.inlineError} role="alert">
            <span>{gameplayFailure}</span>
            <button onClick={clearFailure} type="button">
              Dismiss
            </button>
          </div>
        )}
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

type ChallengeSurfaceMode = 'DRAW' | 'PREVIEW' | 'VIDEO' | 'LYRICS' | 'DECISION' | 'REVEAL';

function ChallengeStage({
  session,
  teamName,
  eyebrow,
  title,
  description,
  surfaceMode,
  children,
  controls,
  controlLabel = 'Host controls',
}: {
  session: GameSession;
  teamName: string;
  eyebrow: string;
  title: string;
  description: string;
  surfaceMode: ChallengeSurfaceMode;
  children: ReactNode;
  controls?: ReactNode | undefined;
  controlLabel?: string | undefined;
}) {
  const catalog = getRuntimeCatalogIndex().snapshot;
  const category =
    session.activeChallenge?.category ??
    catalog.categories.find((candidate) => candidate.id === session.activeTurn?.categoryId);
  const points = session.gameConfig.fullPointsByDifficulty[session.currentDifficulty];

  return (
    <section className={styles.challengeStage} data-surface-mode={surfaceMode}>
      <header className={styles.challengeHeader}>
        <div>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <dl className={styles.challengeMeta} aria-label="Challenge context">
          <div>
            <dt>Playing</dt>
            <dd>{teamName}</dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>{category?.name ?? 'Pending draw'}</dd>
          </div>
          <div>
            <dt>Level</dt>
            <dd>{session.currentDifficulty}</dd>
          </div>
          <div>
            <dt>Worth</dt>
            <dd>{points} pts</dd>
          </div>
        </dl>
      </header>

      <div
        className={[styles.challengeWorkspace, controls ? '' : styles.challengeWorkspaceWide]
          .filter(Boolean)
          .join(' ')}
      >
        <div className={styles.challengeSurface} data-surface-mode={surfaceMode}>
          <div className={styles.challengeSurfaceGlow} aria-hidden="true" />
          <div className={styles.challengeSurfaceContent}>{children}</div>
        </div>
        {controls && (
          <aside className={styles.challengeControlRail} aria-label={controlLabel}>
            <header>
              <span aria-hidden="true">⌁</span>
              <div>
                <small>Game master</small>
                <h2>{controlLabel}</h2>
              </div>
            </header>
            {controls}
          </aside>
        )}
      </div>
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
    const count = type === 'HINT' ? team.lifelines.hintUseCount : team.lifelines.teamHuddleUseCount;
    return `${type === 'HINT' ? 'Hint' : 'Team Huddle'} · ${count === 0 ? 'Free' : '−25'}`;
  };
  return (
    <div className={styles.lifelineRow} aria-label="Contextual lifelines">
      <button onClick={() => activateLifeline(teamId, 'HINT')} type="button">
        {label('HINT')}
      </button>
      <button onClick={() => activateLifeline(teamId, 'TEAM_HUDDLE')} type="button">
        {label('TEAM_HUDDLE')}
      </button>
    </div>
  );
}

function ScoreCard({
  label,
  teamName,
  currentScore,
  score,
  tone,
}: {
  label: string;
  teamName: string;
  currentScore: number;
  score: ScoreBreakdown;
  tone: 'PRIMARY' | 'STEAL';
}) {
  const projectedScore = currentScore + score.finalAwardedPoints;
  return (
    <article
      className={[styles.scoreCard, tone === 'PRIMARY' ? styles.scorePrimary : styles.scoreSteal]
        .filter(Boolean)
        .join(' ')}
    >
      <header>
        <div>
          <span>{label}</span>
          <strong>{teamName}</strong>
        </div>
        <div>
          <small>Pending</small>
          <b>+{score.finalAwardedPoints}</b>
        </div>
      </header>
      <div className={styles.scoreProjection}>
        <span>{currentScore}</span>
        <i aria-hidden="true">→</i>
        <strong>{projectedScore}</strong>
      </div>
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

function ScoreboardStage({
  session,
  eyebrow,
  title,
  description,
  children,
}: {
  session: GameSession;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const challenge = session.activeChallenge;
  return (
    <section className={styles.scoreboardStage}>
      <div className={styles.scoreboardBackdrop} aria-hidden="true">
        <div>
          <span>
            {challenge?.category.name ?? 'Lyric Lockout'} · Level {session.currentDifficulty}
          </span>
          <strong>{challenge?.song.title ?? 'Challenge complete'}</strong>
          <p>{challenge?.challenge.expectedLyrics ?? 'The room is ready for the next score.'}</p>
        </div>
      </div>
      <section
        aria-label="Scoreboard overlay"
        className={styles.scoreboardOverlay}
        data-testid="scoreboard-overlay"
      >
        <header className={styles.scoreboardHeader}>
          <div>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <span>
            <i aria-hidden="true">●</i>
            Live scoreboard
          </span>
        </header>
        <div className={styles.scoreboardBody}>{children}</div>
      </section>
    </section>
  );
}

function TeamStanding({
  team,
  delta,
  rank,
  featured = false,
  label,
}: {
  team: GameSession['teams'][number];
  delta?: number | undefined;
  rank: number;
  featured?: boolean | undefined;
  label?: string | undefined;
}) {
  return (
    <article
      className={[styles.teamStanding, featured ? styles.featuredStanding : '']
        .filter(Boolean)
        .join(' ')}
    >
      <span className={styles.standingRank}>{String(rank).padStart(2, '0')}</span>
      <div>
        <small>{label ?? (featured ? 'Turn complete' : 'Standing')}</small>
        <strong>{team.name}</strong>
      </div>
      {delta !== undefined && (
        <span className={styles.standingDelta} aria-label={`${delta} points gained`}>
          +{delta}
        </span>
      )}
      <b>{team.score}</b>
      <small>points</small>
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
  const turn = session.activeTurn;
  const primaryTeam = session.teams.find((team) => team.id === turn?.primaryTeamId);
  const opposingTeam = session.teams.find((team) => team.id === turn?.opposingTeamId);
  const [primaryOverride, setPrimaryOverride] = useState('');
  const [stealOverride, setStealOverride] = useState('');
  if (!score || !primaryTeam) return <p>Score recommendation unavailable.</p>;

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
      <div className={styles.scoreReviewCards}>
        <ScoreCard
          currentScore={primaryTeam.score}
          label="Primary answer"
          score={score.primary}
          teamName={primaryTeam.name}
          tone="PRIMARY"
        />
        {score.steal && opposingTeam && (
          <ScoreCard
            currentScore={opposingTeam.score}
            label="Steal answer"
            score={score.steal}
            teamName={opposingTeam.name}
            tone="STEAL"
          />
        )}
      </div>
      <details className={styles.overridePanel}>
        <summary>
          <span>Host score override</span>
          <small>Use only to resolve a scoring dispute</small>
        </summary>
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
      <footer className={styles.scoreReviewFooter}>
        <p>
          <span aria-hidden="true">◆</span>
          Points remain pending until the host confirms.
        </p>
        <button
          className={styles.primaryButton}
          onClick={() => send({ type: 'CONFIRM_SCORE' })}
          type="button"
        >
          Confirm and apply score
        </button>
      </footer>
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
  chooseFirstTeam: (teamId: string) => void;
  confirmTurnOrder: (teamId: string) => void;
  activateLifeline: (teamId: string, lifelineType: LifelineType) => void;
  acceptSteal: () => void;
  declineSteal: () => void;
  completeTurn: () => void;
  resetGame: () => void;
  replayGame: () => void;
  adjustTimer: (deltaMilliseconds: number) => void;
  onVideoReady: () => void;
  onVideoPlay: () => boolean;
  onVideoPaused: () => void;
  onCompleteVerification: () => void;
}

function Backstage({ session, onStart }: { session: GameSession; onStart: () => void }) {
  const catalog = getRuntimeCatalogIndex();
  const categoriesById = new Map(
    catalog.snapshot.categories.map((category) => [category.id, category]),
  );
  const categories = session.roundConfig.selectedCategoryIds.flatMap((categoryId) => {
    const category = categoriesById.get(categoryId);
    return category ? [category] : [];
  });
  const difficultyLevels = session.roundConfig.difficultyLevels.length;
  const categorySelectionLabel =
    session.roundConfig.categorySelectionMode === 'RANDOM' ? 'Random mix' : 'Custom mix';

  return (
    <section className={styles.backstage}>
      <header className={styles.backstageHeader}>
        <div>
          <p className={styles.eyebrow}>Game Setup</p>
          <h1>Backstage</h1>
          <p>Review the teams, rules, lifelines, and category lineup before the game begins.</p>
        </div>
        <div className={styles.backstageStats} aria-label="Game summary">
          <div>
            <span aria-hidden="true">▱</span>
            <strong>{categories.length}</strong>
            <small>Categories</small>
          </div>
          <div>
            <span aria-hidden="true">▥</span>
            <strong>{difficultyLevels}</strong>
            <small>Levels</small>
          </div>
          <div>
            <span aria-hidden="true">✦</span>
            <strong>{categorySelectionLabel}</strong>
            <small>Selection</small>
          </div>
        </div>
      </header>

      <div className={styles.backstageLayout}>
        <aside className={styles.backstageSidebar} aria-label="Game details">
          <section className={styles.backstagePanel}>
            <h2>
              <span aria-hidden="true">♟</span> Teams
              <small>{session.teams.length} ready</small>
            </h2>
            <div className={styles.backstageTeams}>
              {session.teams.map((team, index) => (
                <article className={index === 0 ? styles.teamBlue : styles.teamRed} key={team.id}>
                  <span aria-hidden="true">{index === 0 ? '♚' : '◆'}</span>
                  <div>
                    <small>Team {index === 0 ? 'Blue' : 'Red'}</small>
                    <strong>{team.name}</strong>
                    <p>Ready to play</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.backstagePanel}>
            <h2>
              <span aria-hidden="true">💡</span> Lifelines
            </h2>
            <div className={styles.backstageLifelines}>
              {session.teams.map((team, index) => (
                <div key={team.id}>
                  <strong className={index === 0 ? styles.blueText : styles.redText}>
                    {team.name}
                  </strong>
                  <span>
                    <b aria-hidden="true">💡</b> Hint
                    <small>×{session.gameConfig.freeHintUsesPerTeam} free</small>
                  </span>
                  <span>
                    <b aria-hidden="true">☁</b> Team Huddle
                    <small>×{session.gameConfig.freeTeamHuddleUsesPerTeam} free</small>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.backstagePanel}>
            <h2>
              <span aria-hidden="true">◆</span> Rules Summary
            </h2>
            <ul className={styles.rulesList}>
              <li>
                <span aria-hidden="true">◎</span>
                {difficultyLevels} progressive levels
              </li>
              <li>
                <span aria-hidden="true">▱</span>
                {categories.length} single-use categories
              </li>
              <li>
                <span aria-hidden="true">♜</span>
                Perfect earns full points; mostly correct earns half
              </li>
              <li>
                <span aria-hidden="true">◉</span>
                Perfect steals earn half points
              </li>
              <li>
                <span aria-hidden="true">♧</span>
                Extra lifelines cost {session.gameConfig.additionalLifelinePenaltyPoints} points
              </li>
              <li>
                <span aria-hidden="true">⌁</span>
                Host controls results and timers
              </li>
            </ul>
          </section>
        </aside>

        <section
          className={styles.backstageCategories}
          aria-labelledby="backstage-categories-title"
        >
          <header>
            <div>
              <h2 id="backstage-categories-title">
                <span aria-hidden="true">♫</span> Categories ({categories.length})
              </h2>
              <p>These categories will be used once each during this game.</p>
            </div>
            <span>{categorySelectionLabel}</span>
          </header>
          <div className={styles.backstageCategoryGrid}>
            {categories.map((category, index) => {
              const songCount = catalog.snapshot.songs.filter(
                (song) => song.enabled && song.categoryIds.includes(category.id),
              ).length;
              return (
                <article className={styles[`backstageTone${(index % 5) + 1}`]} key={category.id}>
                  <span aria-hidden="true">{resolveCategoryIcon(category.icon)}</span>
                  <strong>{category.name}</strong>
                  <small>
                    {songCount} {songCount === 1 ? 'song' : 'songs'}
                  </small>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <footer className={styles.backstageFooter}>
        <div className={styles.readyCallout}>
          <span aria-hidden="true">▣</span>
          <div>
            <strong>Ready to play?</strong>
            <p>Review everything above and start when the room is ready.</p>
          </div>
        </div>
        <div className={styles.backstageFooterFacts}>
          <span>
            <strong>{categories.length}</strong> Categories
          </span>
          <span>
            <strong>{difficultyLevels}</strong> Levels
          </span>
        </div>
        <button onClick={onStart} type="button">
          <span aria-hidden="true">▶</span>
          Start Game
          <small>Let the battle of lyrics begin!</small>
        </button>
      </footer>
    </section>
  );
}

function CategorySelectionStage({
  categories,
  onAssign,
  session,
}: {
  categories: readonly Category[];
  onAssign: (categoryId: string, assignmentMode: CategoryAssignmentMode) => void;
  session: GameSession;
}) {
  const activeTeam = session.teams.find((team) => team.id === session.activeTurn?.primaryTeamId);
  const usedCount = session.consumedCategoryIds.length;
  const remainingCount = session.roundConfig.selectedCategoryIds.length - usedCount;

  return (
    <section className={styles.categorySelectionStage}>
      <header className={styles.categorySelectionHeader}>
        <div>
          <p className={styles.eyebrow}>Level {session.currentDifficulty} · Category Selection</p>
          <h1>Choose a category.</h1>
          <p>Each category can be played once. Completed categories stay visible but disabled.</p>
        </div>
        <div
          className={styles.categoryProgress}
          aria-label={`${remainingCount} categories remaining`}
        >
          <span>{usedCount}</span>
          <div>
            <strong>{remainingCount} remaining</strong>
            <small>{session.roundConfig.selectedCategoryIds.length} total categories</small>
          </div>
        </div>
      </header>

      <div className={styles.currentTeamPrompt}>
        <span aria-hidden="true">♚</span>
        <div>
          <small>Current team</small>
          <strong>{activeTeam?.name ?? 'Team'}</strong>
        </div>
        <p>Choose one available category to continue.</p>
      </div>

      <CategoryAssignmentGrid
        assignmentMode="SELF_SELECTED"
        categories={categories}
        onAssign={onAssign}
        session={session}
      />

      <footer className={styles.categorySelectionFooter}>
        <div>
          <span>
            <i className={styles.availableDot} /> Available
          </span>
          <span>
            <i className={styles.completedDot} /> Completed
          </span>
          <span>
            <i className={styles.unavailableDot} /> Unavailable
          </span>
        </div>
        <p>
          <strong>{usedCount}</strong> of {session.roundConfig.selectedCategoryIds.length} completed
        </p>
      </footer>
    </section>
  );
}

function PhaseStage(props: PhaseStageProps) {
  const {
    session,
    timerSnapshot,
    fakeMedia,
    send,
    selectChallenge: chooseChallenge,
    assignCategory,
    chooseFirstTeam,
    confirmTurnOrder,
    activateLifeline,
    acceptSteal,
    declineSteal,
    completeTurn,
    resetGame,
    replayGame,
    adjustTimer,
    onVideoReady,
    onVideoPlay,
    onVideoPaused,
    onCompleteVerification,
  } = props;
  const turn = session.activeTurn;
  const activeTeam = session.teams.find((team) => team.id === turn?.primaryTeamId);
  const opposingTeam = session.teams.find((team) => team.id === turn?.opposingTeamId);
  const challenge = session.activeChallenge;
  const categoriesById = new Map(
    getRuntimeCatalogIndex().snapshot.categories.map((category) => [category.id, category]),
  );
  const roundCategories = session.roundConfig.selectedCategoryIds.flatMap((categoryId) => {
    const category = categoriesById.get(categoryId);
    return category ? [category] : [];
  });

  switch (session.phase) {
    case 'ROUND_BUILDING':
      return (
        <Backstage
          onStart={() => {
            if (send({ type: 'VALIDATE_ROUND' })) {
              send({ type: 'START_GAME' });
            }
          }}
          session={session}
        />
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
          title="Who starts this level?"
          description={`The host chooses the first team. Level ${session.currentDifficulty} challenges are worth ${session.gameConfig.fullPointsByDifficulty[session.currentDifficulty]} points.`}
        >
          <div className={styles.teamChoice}>
            {session.teams.map((team) => (
              <button
                className={styles.secondaryButton}
                key={team.id}
                onClick={() => chooseFirstTeam(team.id)}
                type="button"
              >
                {team.name} starts
              </button>
            ))}
          </div>
        </Stage>
      );
    case 'TRIVIA_RESULT_ENTRY':
      return (
        <Stage
          eyebrow={`Level ${session.currentDifficulty} · first team`}
          title="Choose who starts this level."
          description="The host records the room’s decision."
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
          title="Confirm the starting team."
          description="This team will choose the first category."
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
      return (
        <CategorySelectionStage
          categories={roundCategories}
          onAssign={assignCategory}
          session={session}
        />
      );
    }
    case 'CHALLENGE_SELECTION':
      return (
        <ChallengeStage
          eyebrow="Challenge selection"
          session={session}
          surfaceMode="DRAW"
          teamName={activeTeam?.name ?? 'Team'}
          title="The next song is ready to draw."
          description="Played and rerolled challenges remain excluded."
          controls={
            <>
              <p className={styles.controlIntro}>
                Draw one eligible song from the selected category when the room is ready.
              </p>
              <button className={styles.primaryButton} onClick={chooseChallenge} type="button">
                <span aria-hidden="true">♫</span>
                Select challenge
              </button>
            </>
          }
        >
          <div className={styles.challengeCue}>
            <span aria-hidden="true">♫</span>
            <small>Category locked</small>
            <strong>
              {roundCategories.find((category) => category.id === turn?.categoryId)?.name ??
                'Selected category'}
            </strong>
            <p>The song stays concealed until the host draws the challenge.</p>
          </div>
        </ChallengeStage>
      );
    case 'CHALLENGE_PREVIEW':
      return (
        <ChallengeStage
          eyebrow={`${challenge?.category.name ?? 'Category'} · Level ${session.currentDifficulty}`}
          session={session}
          surfaceMode="PREVIEW"
          teamName={activeTeam?.name ?? 'Team'}
          title={
            session.gameConfig.revealSongBeforePlayback
              ? (challenge?.song.title ?? 'Challenge preview')
              : 'Mystery song challenge'
          }
          description={
            session.gameConfig.revealSongBeforePlayback
              ? (challenge?.song.artist ?? 'Artist concealed')
              : 'Song and artist stay hidden until verification.'
          }
          controls={
            <>
              <p className={styles.controlIntro}>
                Reroll to reject this draw, or lock it to prepare playback.
              </p>
              <div className={styles.challengeActionStack}>
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
            </>
          }
        >
          <div className={styles.challengeCue}>
            <span aria-hidden="true">
              {session.gameConfig.revealSongBeforePlayback ? '▶' : '?'}
            </span>
            <small>
              {session.gameConfig.revealSongBeforePlayback ? 'Now queued' : 'Mystery song'}
            </small>
            <strong>
              {session.gameConfig.revealSongBeforePlayback
                ? challenge?.song.title
                : 'Identity concealed'}
            </strong>
            <p>
              {session.gameConfig.revealSongBeforePlayback
                ? challenge?.song.artist
                : 'The title and artist will appear after both answer decisions.'}
            </p>
          </div>
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
        </ChallengeStage>
      );
    case 'VIDEO_LOADING':
    case 'VIDEO_READY':
    case 'VIDEO_PLAYING':
      return (
        <ChallengeStage
          eyebrow={`${activeTeam?.name ?? 'Team'} · playback`}
          session={session}
          surfaceMode="VIDEO"
          teamName={activeTeam?.name ?? 'Team'}
          title="Listen. Lock in."
          description="Playback starts and pauses automatically."
        >
          <GameplayVideoStage
            fakeMedia={fakeMedia}
            onCompleteVerification={onCompleteVerification}
            onPaused={onVideoPaused}
            onPlay={onVideoPlay}
            onReady={onVideoReady}
            session={session}
          />
        </ChallengeStage>
      );
    case 'PRIMARY_ANSWERING': {
      const hintUsed = turn?.primaryAttempt?.lifelinesUsed.some((usage) => usage.type === 'HINT');
      const teamHuddleUsed = turn?.primaryAttempt?.lifelinesUsed.some(
        (usage) => usage.type === 'TEAM_HUDDLE',
      );
      return (
        <ChallengeStage
          eyebrow={`${activeTeam?.name ?? 'Team'} · primary answer`}
          session={session}
          surfaceMode="LYRICS"
          teamName={activeTeam?.name ?? 'Team'}
          title="Continue the lyrics."
          description="The host listens, then records the result. Timer expiry never decides it."
          controls={
            <>
              <div className={styles.controlSection}>
                <h3>Answer timer</h3>
                <TimerPanel adjustTimer={adjustTimer} send={send} snapshot={timerSnapshot} />
              </div>
              <div className={styles.controlSection}>
                <h3>Lifelines</h3>
                <LifelineButtons
                  session={session}
                  teamId={turn?.primaryTeamId ?? ''}
                  activateLifeline={activateLifeline}
                />
                {hintUsed && <p className={styles.reveal}>Hint: {challenge?.challenge.hintText}</p>}
                {teamHuddleUsed && (
                  <p className={styles.reveal}>
                    Team Huddle is active — confer with your teammates now.
                  </p>
                )}
              </div>
              <div className={styles.controlSection}>
                <h3>Record result</h3>
                <AnswerButtons
                  onClassify={(result) => send({ type: 'CLASSIFY_PRIMARY', result })}
                />
              </div>
            </>
          }
        >
          {challenge && (
            <div className={styles.challengeLyrics}>
              <header>
                <span>Pick up from the pause</span>
                <small>{challenge.challenge.missingWordCount} missing words</small>
              </header>
              <LyricPuzzle
                expectedLyrics={challenge.challenge.expectedLyrics}
                hiddenWordIndexes={challenge.challenge.hiddenWordIndexes}
              />
            </div>
          )}
        </ChallengeStage>
      );
    }
    case 'PRIMARY_RESULT_REVIEW':
      return (
        <ChallengeStage
          eyebrow="Primary result"
          session={session}
          surfaceMode="DECISION"
          teamName={activeTeam?.name ?? 'Team'}
          title={`${activeTeam?.name}: ${RESULT_LABELS[turn?.primaryAttempt?.result ?? 'WRONG']}`}
          description="Review the host classification before moving to steal eligibility."
          controls={
            <>
              <p className={styles.controlIntro}>
                Confirming this result determines whether the opposing team receives a steal.
              </p>
              <button
                className={styles.primaryButton}
                onClick={() => send({ type: 'CONFIRM_PRIMARY_RESULT' })}
                type="button"
              >
                Confirm primary result
              </button>
            </>
          }
        >
          <div className={styles.resultSpotlight}>
            <span aria-hidden="true">{turn?.primaryAttempt?.result === 'PERFECT' ? '✓' : '◆'}</span>
            <small>Host classification</small>
            <strong>{RESULT_LABELS[turn?.primaryAttempt?.result ?? 'WRONG']}</strong>
            <p>No score is applied until the full turn is reviewed.</p>
          </div>
        </ChallengeStage>
      );
    case 'STEAL_OFFER':
      return (
        <ChallengeStage
          eyebrow="Steal opportunity"
          session={session}
          surfaceMode="DECISION"
          teamName={opposingTeam?.name ?? 'Opposing team'}
          title={`${opposingTeam?.name}, want the steal?`}
          description="Only a Perfect steal earns points."
          controlLabel="Steal decision"
          controls={
            <>
              <p className={styles.controlIntro}>
                Ask the opposing team, then record their choice. Declining moves directly to the
                reveal.
              </p>
              <div className={styles.challengeActionStack}>
                <button className={styles.secondaryButton} onClick={declineSteal} type="button">
                  Decline steal
                </button>
                <button className={styles.primaryButton} onClick={acceptSteal} type="button">
                  Accept steal
                </button>
              </div>
            </>
          }
        >
          <div className={styles.resultSpotlight}>
            <span aria-hidden="true">↗</span>
            <small>Steal value</small>
            <strong>
              {Math.floor(session.gameConfig.fullPointsByDifficulty[session.currentDifficulty] / 2)}{' '}
              pts
            </strong>
            <p>A steal scores only when the host marks the answer Perfect.</p>
          </div>
        </ChallengeStage>
      );
    case 'STEAL_ANSWERING':
      return (
        <ChallengeStage
          eyebrow={`${opposingTeam?.name ?? 'Opposing team'} · steal`}
          session={session}
          surfaceMode="LYRICS"
          teamName={opposingTeam?.name ?? 'Opposing team'}
          title="Give the missing lyrics."
          description="The host records the steal result. Only Perfect will score."
          controlLabel="Steal controls"
          controls={
            <>
              <div className={styles.controlSection}>
                <h3>Steal timer</h3>
                <TimerPanel adjustTimer={adjustTimer} send={send} snapshot={timerSnapshot} />
              </div>
              <div className={styles.controlSection}>
                <h3>Record result</h3>
                <AnswerButtons
                  includeDeclined
                  onClassify={(result) => send({ type: 'CLASSIFY_STEAL', result })}
                />
              </div>
            </>
          }
        >
          {challenge && (
            <div className={styles.challengeLyrics}>
              <header>
                <span>Steal the missing line</span>
                <small>Perfect answers score</small>
              </header>
              <LyricPuzzle
                expectedLyrics={challenge.challenge.expectedLyrics}
                hiddenWordIndexes={challenge.challenge.hiddenWordIndexes}
              />
            </div>
          )}
        </ChallengeStage>
      );
    case 'STEAL_RESULT_REVIEW':
      return (
        <ChallengeStage
          eyebrow="Steal result"
          session={session}
          surfaceMode="DECISION"
          teamName={opposingTeam?.name ?? 'Opposing team'}
          title={`${opposingTeam?.name}: ${RESULT_LABELS[turn?.stealAttempt?.result ?? 'WRONG']}`}
          description="Review the host classification before revealing the expected lyrics."
          controls={
            <>
              <p className={styles.controlIntro}>
                Confirm the steal classification before the missing words are revealed.
              </p>
              <button
                className={styles.primaryButton}
                onClick={() => send({ type: 'CONFIRM_STEAL_RESULT' })}
                type="button"
              >
                Confirm steal result
              </button>
            </>
          }
        >
          <div className={styles.resultSpotlight}>
            <span aria-hidden="true">{turn?.stealAttempt?.result === 'PERFECT' ? '✓' : '◆'}</span>
            <small>Steal classification</small>
            <strong>{RESULT_LABELS[turn?.stealAttempt?.result ?? 'WRONG']}</strong>
            <p>The lyric remains hidden until this result is confirmed.</p>
          </div>
        </ChallengeStage>
      );
    case 'CHALLENGE_VERIFICATION':
      return (
        <ChallengeStage
          eyebrow="Verification"
          session={session}
          surfaceMode="REVEAL"
          teamName={activeTeam?.name ?? 'Team'}
          title="Reveal the lyric."
          description="Expected lyrics stay hidden until all steal decisions are resolved."
        >
          <div className={styles.revealedLyrics}>
            <span>Expected lyric</span>
            <blockquote>{challenge?.challenge.expectedLyrics}</blockquote>
          </div>
          <GameplayVideoStage
            fakeMedia={fakeMedia}
            onCompleteVerification={onCompleteVerification}
            onPaused={onVideoPaused}
            onPlay={onVideoPlay}
            onReady={onVideoReady}
            session={session}
          />
        </ChallengeStage>
      );
    case 'FINAL_SCORE_REVIEW':
      return (
        <ScoreboardStage
          eyebrow="Final score review"
          session={session}
          title="Review before points are applied."
          description="Recommended and host-overridden values remain visible."
        >
          <ScoreReview send={send} session={session} />
        </ScoreboardStage>
      );
    case 'TURN_SUMMARY': {
      const primaryPoints = turn?.score?.primary.finalAwardedPoints ?? 0;
      const stealPoints = turn?.score?.steal?.finalAwardedPoints ?? 0;
      const standings = [...session.teams].sort((first, second) => second.score - first.score);
      const nextActionLabel =
        session.currentLevelState.primaryTurnsCompleted === 0
          ? 'Continue to next team'
          : session.currentDifficulty === 5
            ? 'View winner'
            : 'View level scoreboard';
      return (
        <ScoreboardStage
          eyebrow="Turn summary"
          session={session}
          title={`${activeTeam?.name}’s turn is complete.`}
          description="Points are applied. Review the live standings before continuing."
        >
          <div className={styles.standingsList} aria-label="Current standings">
            {standings.map((team, index) => {
              const delta =
                team.id === turn?.primaryTeamId
                  ? primaryPoints
                  : team.id === turn?.opposingTeamId
                    ? stealPoints
                    : 0;
              return (
                <TeamStanding
                  delta={delta}
                  featured={delta > 0}
                  key={team.id}
                  rank={index + 1}
                  team={team}
                />
              );
            })}
          </div>
          <footer className={styles.scoreboardFooter}>
            <p>
              Primary +{primaryPoints}
              {turn?.score?.steal ? ` · Steal +${stealPoints}` : ' · No steal points'}
            </p>
            <button className={styles.primaryButton} onClick={completeTurn} type="button">
              {nextActionLabel}
            </button>
          </footer>
        </ScoreboardStage>
      );
    }
    case 'LEVEL_SUMMARY': {
      const latestLevel = session.levelHistory.at(-1);
      const levelPointsByTeamId = new Map(
        latestLevel?.teamScores.map((score) => [score.teamId, score.pointsAwarded]) ?? [],
      );
      const standings = [...session.teams].sort((first, second) => second.score - first.score);
      return (
        <ScoreboardStage
          eyebrow={`Level ${latestLevel?.difficulty ?? session.currentDifficulty} complete`}
          session={session}
          title="Level scoreboard"
          description="Both teams completed a primary challenge. Level gains are shown beside the live totals."
        >
          <div className={styles.levelCompleteBadge}>
            <span aria-hidden="true">✓</span>
            <div>
              <small>Level complete</small>
              <strong>Both turns scored</strong>
            </div>
          </div>
          <div className={styles.standingsList} aria-label="Level standings">
            {standings.map((team, index) => (
              <TeamStanding
                delta={levelPointsByTeamId.get(team.id) ?? 0}
                featured={index === 0}
                key={team.id}
                label="Level gain"
                rank={index + 1}
                team={team}
              />
            ))}
          </div>
          <footer className={styles.scoreboardFooter}>
            <p>Level {latestLevel?.difficulty ?? session.currentDifficulty} is locked in.</p>
            <button
              className={styles.primaryButton}
              onClick={() => send({ type: 'START_NEXT_LEVEL' })}
              type="button"
            >
              Start level {session.currentDifficulty}
            </button>
          </footer>
        </ScoreboardStage>
      );
    }
    case 'GAME_SUMMARY': {
      const winners = getWinningTeams(session);
      const standings = [...session.teams].sort((first, second) => second.score - first.score);
      const isTie = winners.length > 1;
      return (
        <section className={styles.winnerStage}>
          <div className={styles.confetti} aria-hidden="true">
            {Array.from({ length: 18 }, (_, index) => (
              <i key={index} />
            ))}
          </div>
          <header className={styles.winnerHeader}>
            <p className={styles.eyebrow}>Game complete</p>
            <div className={styles.trophy} aria-hidden="true">
              {isTie ? '◎' : '♛'}
            </div>
            <span>{isTie ? 'Shared victory' : 'Lyric Lockout champion'}</span>
            <h1>{isTie ? 'It’s a tie!' : `${winners[0]?.name ?? 'A team'} wins!`}</h1>
            <p>Final scores include every point confirmed before the game ended.</p>
          </header>

          <div className={styles.finalStandings} aria-label="Final standings">
            {standings.map((team, index) => (
              <TeamStanding
                featured={winners.some((winner) => winner.id === team.id)}
                key={team.id}
                label={winners.some((winner) => winner.id === team.id) ? 'Winner' : 'Final score'}
                rank={index + 1}
                team={team}
              />
            ))}
          </div>

          <div className={styles.winnerStats} aria-label="Game totals">
            <span>
              <strong>{session.levelHistory.length}</strong>
              Levels
            </span>
            <span>
              <strong>{session.turnHistory.length}</strong>
              Challenges
            </span>
            <span>
              <strong>{session.consumedCategoryIds.length}</strong>
              Categories
            </span>
          </div>

          <footer className={styles.winnerActions}>
            <button className={styles.primaryButton} onClick={replayGame} type="button">
              Play again
            </button>
            <button className={styles.secondaryButton} onClick={resetGame} type="button">
              New game
            </button>
            <Link className={styles.winnerHomeLink} onClick={resetGame} to="/">
              Home
            </Link>
          </footer>
        </section>
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
  const isBackstage = session.phase === 'ROUND_BUILDING' || session.phase === 'ROUND_VALIDATION';
  const {
    events,
    eventBatch,
    failure,
    pendingPaidLifeline,
    send,
    selectChallenge,
    assignCategory,
    chooseFirstTeam,
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
    startSession,
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
    !isBackstage,
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
    <section
      className={[styles.gameplayShell, isBackstage ? styles.backstageShell : '']
        .filter(Boolean)
        .join(' ')}
    >
      {!isBackstage && (
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
            {session.phase !== 'GAME_SUMMARY' && (
              <button
                className={styles.finishGameButton}
                onClick={() => send({ type: 'FINISH_GAME' })}
                type="button"
              >
                Finish game
              </button>
            )}
          </div>
        </header>
      )}

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
          chooseFirstTeam={chooseFirstTeam}
          completeTurn={completeTurn}
          confirmTurnOrder={confirmTurnOrder}
          declineSteal={declineSteal}
          fakeMedia={fakeMedia}
          onCompleteVerification={onCompleteVerification}
          onVideoPaused={onVideoPaused}
          onVideoPlay={onVideoPlay}
          onVideoReady={onVideoReady}
          replayGame={() =>
            startSession(
              createGame({
                id: `${session.id}-replay-${Date.now()}`,
                createdAt: new Date().toISOString(),
                teams: session.teams.map(({ id, name }) => ({ id, name })),
                roundConfig: session.roundConfig,
                gameConfig: session.gameConfig,
              }),
            )
          }
          resetGame={reset}
          selectChallenge={selectChallenge}
          send={send}
          session={session}
          timerSnapshot={timerSnapshot}
          activateLifeline={activateLifeline}
        />
      </main>

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
  const catalogStatus = useAdminStore((state) => state.status);
  const initializeCatalog = useAdminStore((state) => state.initialize);

  useEffect(() => {
    initializePersistence();
    void initializeCatalog();
  }, [initializeCatalog, initializePersistence]);

  if (
    persistenceStatus !== 'READY' ||
    catalogStatus === 'UNINITIALIZED' ||
    catalogStatus === 'LOADING'
  ) {
    return (
      <section className={styles.resumeShell} aria-live="polite">
        <p className={styles.eyebrow}>Local game</p>
        <h1>Loading the saved game and catalog…</h1>
      </section>
    );
  }
  if (!session && (savedSession || savedSessionIssue)) return <SavedGamePrompt />;
  return session ? <ActiveGame session={session} /> : <TeamSetup />;
}

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getCatalogCandidates, type CatalogIndex } from '../../domain/catalog';
import { DIFFICULTY_LEVELS, type DifficultyLevel, type GamePlan } from '../../domain';
import type { Category } from '../../domain/models/catalog';
import { useAdminStore } from '../../store/adminStore';
import { useGamePlanStore } from '../../store/gamePlanStore';
import { resolveCategoryIcon } from '../../utils/categoryIcon';
import { useGameplayStore } from '../../store/gameplayStore';
import { useSettingsStore } from '../../store/settingsStore';
import { getRuntimeCatalogIndex } from '../game/runtimeCatalog';
import styles from './PlansPage.module.css';

const STATUS_LABELS: Record<GamePlan['status'], string> = {
  DRAFT: 'Draft',
  READY: 'Ready',
  READY_WITH_WARNINGS: 'Ready with warnings',
  INVALID: 'Invalid',
};

function PlanStatus({ plan }: { plan: GamePlan }) {
  return (
    <span className={`${styles.status} ${styles[plan.status.toLowerCase()]}`}>
      {STATUS_LABELS[plan.status]}
    </span>
  );
}

function PlanEditor({
  plan,
  categories,
  catalog,
  onClose,
}: {
  plan: GamePlan;
  categories: readonly Category[];
  catalog: CatalogIndex;
  onClose: () => void;
}) {
  const savePlan = useGamePlanStore((state) => state.savePlan);
  const validatePlan = useGamePlanStore((state) => state.validatePlan);
  const [draft, setDraft] = useState(plan);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(plan), [plan]);

  const updateDraft = (update: (current: GamePlan) => GamePlan) => {
    setSaved(false);
    setDraft((current) => ({
      ...update(current),
      status: 'DRAFT',
      validationIssues: [],
    }));
  };

  const toggleCategory = (categoryId: string) => {
    updateDraft((current) => {
      const isSelected = current.roundConfig.selectedCategoryIds.includes(categoryId);
      if (!isSelected && current.roundConfig.selectedCategoryIds.length >= 10) return current;
      const selected = isSelected
        ? current.roundConfig.selectedCategoryIds.filter((id) => id !== categoryId)
        : [...current.roundConfig.selectedCategoryIds, categoryId];
      return {
        ...current,
        roundConfig: { ...current.roundConfig, selectedCategoryIds: selected },
      };
    });
  };

  const toggleChallenge = (
    categoryId: string,
    difficulty: DifficultyLevel,
    challengeId: string,
  ) => {
    updateDraft((current) => {
      const existing = current.roundConfig.manualChallengePools.find(
        (pool) => pool.categoryId === categoryId,
      ) ?? {
        categoryId,
        approvedChallengeIdsByDifficulty: {},
      };
      const approved = existing.approvedChallengeIdsByDifficulty[difficulty] ?? [];
      const nextApproved = approved.includes(challengeId)
        ? approved.filter((id) => id !== challengeId)
        : [...approved, challengeId];
      const nextPool = {
        ...existing,
        approvedChallengeIdsByDifficulty: {
          ...existing.approvedChallengeIdsByDifficulty,
          [difficulty]: nextApproved,
        },
      };
      return {
        ...current,
        roundConfig: {
          ...current.roundConfig,
          manualChallengePools: [
            ...current.roundConfig.manualChallengePools.filter(
              (pool) => pool.categoryId !== categoryId,
            ),
            nextPool,
          ],
        },
      };
    });
  };

  const approveAllChallenges = () => {
    updateDraft((current) => ({
      ...current,
      roundConfig: {
        ...current.roundConfig,
        manualChallengePools: categories.map((category) => ({
          categoryId: category.id,
          approvedChallengeIdsByDifficulty: Object.fromEntries(
            DIFFICULTY_LEVELS.map((difficulty) => [
              difficulty,
              getCatalogCandidates(catalog, category.id, difficulty).map(
                (candidate) => candidate.challenge.id,
              ),
            ]),
          ),
        })),
      },
    }));
  };

  const save = () => {
    if (savePlan(draft)) setSaved(true);
  };

  const saveAndValidate = () => {
    if (!savePlan(draft)) return;
    const validated = validatePlan(draft.id);
    if (validated) {
      setDraft(validated);
      setSaved(true);
    }
  };

  return (
    <section className={styles.editor} aria-labelledby="plan-editor-title">
      <header className={styles.editorHeader}>
        <div>
          <p className={styles.eyebrow}>Plan editor</p>
          <h2 id="plan-editor-title">{draft.name}</h2>
        </div>
        <div className={styles.actions}>
          <PlanStatus plan={draft} />
          <button onClick={onClose} type="button">
            Close
          </button>
        </div>
      </header>

      <div className={styles.formGrid}>
        <label>
          Plan name
          <input
            maxLength={60}
            onChange={(event) =>
              updateDraft((current) => ({ ...current, name: event.target.value }))
            }
            value={draft.name}
          />
        </label>
        <label>
          Description
          <textarea
            maxLength={240}
            onChange={(event) =>
              updateDraft((current) => ({
                ...current,
                description: event.target.value || undefined,
              }))
            }
            rows={3}
            value={draft.description ?? ''}
          />
        </label>
        <label>
          Category selection
          <select
            onChange={(event) =>
              updateDraft((current) => ({
                ...current,
                roundConfig: {
                  ...current.roundConfig,
                  categorySelectionMode: event.target.value as 'MANUAL' | 'RANDOM',
                },
              }))
            }
            value={draft.roundConfig.categorySelectionMode}
          >
            <option value="MANUAL">Manual ten categories</option>
            <option value="RANDOM">Random eligible categories</option>
          </select>
        </label>
        <label>
          Song selection
          <select
            onChange={(event) =>
              updateDraft((current) => ({
                ...current,
                roundConfig: {
                  ...current.roundConfig,
                  songSelectionMode: event.target.value as 'FULL_CATALOG' | 'CURATED_POOL',
                },
              }))
            }
            value={draft.roundConfig.songSelectionMode}
          >
            <option value="FULL_CATALOG">Full catalog</option>
            <option value="CURATED_POOL">Curated challenge pools</option>
          </select>
        </label>
        <label>
          Preferred theme
          <select
            onChange={(event) =>
              updateDraft((current) => ({
                ...current,
                preferredTheme: event.target.value as 'DAY_PARTY' | 'GAME_NIGHT',
              }))
            }
            value={draft.preferredTheme}
          >
            <option value="DAY_PARTY">Day Party</option>
            <option value="GAME_NIGHT">Game Night</option>
          </select>
        </label>
        <label className={styles.checkboxLabel}>
          <input
            checked={draft.revealSongBeforePlayback}
            onChange={(event) =>
              updateDraft((current) => ({
                ...current,
                revealSongBeforePlayback: event.target.checked,
              }))
            }
            type="checkbox"
          />
          Reveal song before playback
        </label>
      </div>

      {draft.roundConfig.categorySelectionMode === 'MANUAL' && (
        <fieldset className={styles.fieldset}>
          <legend>Categories · {draft.roundConfig.selectedCategoryIds.length}/10 selected</legend>
          <div className={styles.categoryGrid}>
            {categories.map((category) => (
              <label className={styles.checkboxCard} key={category.id}>
                <input
                  checked={draft.roundConfig.selectedCategoryIds.includes(category.id)}
                  disabled={!category.enabled}
                  onChange={() => toggleCategory(category.id)}
                  type="checkbox"
                />
                <span aria-hidden="true">{resolveCategoryIcon(category.icon)}</span>
                {category.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {draft.roundConfig.songSelectionMode === 'CURATED_POOL' && (
        <fieldset className={styles.fieldset}>
          <legend>Curated challenge pools</legend>
          <p>
            Approve at least one challenge for every selected category and level. Choices remain
            attached to this plan when modes change.
          </p>
          <button className={styles.secondaryButton} onClick={approveAllChallenges} type="button">
            Approve all current catalog challenges
          </button>
          <div className={styles.poolList}>
            {categories.map((category) => (
              <details key={category.id}>
                <summary>{category.name}</summary>
                {DIFFICULTY_LEVELS.map((difficulty) => {
                  const approved =
                    draft.roundConfig.manualChallengePools.find(
                      (pool) => pool.categoryId === category.id,
                    )?.approvedChallengeIdsByDifficulty[difficulty] ?? [];
                  const candidates = getCatalogCandidates(catalog, category.id, difficulty);
                  return (
                    <div className={styles.poolLevel} key={difficulty}>
                      <strong>Level {difficulty}</strong>
                      {candidates.map((candidate) => (
                        <label className={styles.checkboxLabel} key={candidate.challenge.id}>
                          <input
                            checked={approved.includes(candidate.challenge.id)}
                            onChange={() =>
                              toggleChallenge(category.id, difficulty, candidate.challenge.id)
                            }
                            type="checkbox"
                          />
                          {candidate.song.title} · option{' '}
                          {candidate.challenge.id.endsWith('-2') ? '2' : '1'}
                        </label>
                      ))}
                    </div>
                  );
                })}
              </details>
            ))}
          </div>
        </fieldset>
      )}

      <details className={styles.fieldset}>
        <summary>Game configuration</summary>
        <div className={styles.configGrid}>
          <label>
            Free hints per team
            <input
              min="0"
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  gameConfig: {
                    ...current.gameConfig,
                    freeHintUsesPerTeam: Number(event.target.value),
                  },
                }))
              }
              type="number"
              value={draft.gameConfig.freeHintUsesPerTeam}
            />
          </label>
          <label>
            Free Team Huddle uses
            <input
              min="0"
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  gameConfig: {
                    ...current.gameConfig,
                    freeTeamHuddleUsesPerTeam: Number(event.target.value),
                  },
                }))
              }
              type="number"
              value={draft.gameConfig.freeTeamHuddleUsesPerTeam}
            />
          </label>
          <label>
            Additional lifeline penalty
            <input
              min="0"
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  gameConfig: {
                    ...current.gameConfig,
                    additionalLifelinePenaltyPoints: Number(event.target.value),
                  },
                }))
              }
              type="number"
              value={draft.gameConfig.additionalLifelinePenaltyPoints}
            />
          </label>
          <label>
            Steal timer seconds
            <input
              min="0"
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  gameConfig: {
                    ...current.gameConfig,
                    stealTimerSeconds: Number(event.target.value),
                  },
                }))
              }
              type="number"
              value={draft.gameConfig.stealTimerSeconds}
            />
          </label>
          <label>
            Steal timer mode
            <select
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  gameConfig: {
                    ...current.gameConfig,
                    stealTimerMode: event.target.value as GamePlan['gameConfig']['stealTimerMode'],
                  },
                }))
              }
              value={draft.gameConfig.stealTimerMode}
            >
              <option value="FIXED">Fixed</option>
              <option value="REMAINING_PRIMARY_TIME">Remaining primary time</option>
              <option value="FULL_LEVEL_TIME">Full level time</option>
              <option value="HOST_CONTROLLED">Host controlled</option>
            </select>
          </label>
        </div>
        <div className={styles.levelConfig}>
          <strong>Level</strong>
          <strong>Full points</strong>
          <strong>Answer seconds</strong>
          {DIFFICULTY_LEVELS.map((difficulty) => (
            <div className={styles.levelRow} key={difficulty}>
              <span>{difficulty}</span>
              <input
                aria-label={`Level ${difficulty} full points`}
                min="0"
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    gameConfig: {
                      ...current.gameConfig,
                      fullPointsByDifficulty: {
                        ...current.gameConfig.fullPointsByDifficulty,
                        [difficulty]: Number(event.target.value),
                      },
                    },
                  }))
                }
                type="number"
                value={draft.gameConfig.fullPointsByDifficulty[difficulty]}
              />
              <input
                aria-label={`Level ${difficulty} answer seconds`}
                min="0"
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    gameConfig: {
                      ...current.gameConfig,
                      answerSecondsByDifficulty: {
                        ...current.gameConfig.answerSecondsByDifficulty,
                        [difficulty]: Number(event.target.value),
                      },
                    },
                  }))
                }
                type="number"
                value={draft.gameConfig.answerSecondsByDifficulty[difficulty]}
              />
            </div>
          ))}
        </div>
        <div className={styles.toggleGrid}>
          {(
            [
              ['preventChallengeReuse', 'Prevent challenge reuse'],
              ['preventSongReuse', 'Prevent song reuse'],
              ['allowRuntimeReroll', 'Allow song rerolls'],
            ] as const
          ).map(([key, label]) => (
            <label className={styles.checkboxLabel} key={key}>
              <input
                checked={draft.roundConfig[key]}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    roundConfig: {
                      ...current.roundConfig,
                      [key]: event.target.checked,
                    },
                  }))
                }
                type="checkbox"
              />
              {label}
            </label>
          ))}
          {(
            [
              ['allowLifelinesDuringSteal', 'Allow lifelines during steals'],
              ['scoreFloorAtZero', 'Floor team scores at zero'],
              ['allowHostScoreOverride', 'Allow host score overrides'],
              ['allowHostTimerOverride', 'Allow host timer overrides'],
              ['allowSongReroll', 'Allow song rerolls in game config'],
            ] as const
          ).map(([key, label]) => (
            <label className={styles.checkboxLabel} key={key}>
              <input
                checked={draft.gameConfig[key]}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    gameConfig: {
                      ...current.gameConfig,
                      [key]: event.target.checked,
                    },
                  }))
                }
                type="checkbox"
              />
              {label}
            </label>
          ))}
        </div>
      </details>

      {draft.validationIssues.length > 0 && (
        <div className={styles.issues} role="status">
          <strong>Validation results</strong>
          <ul>
            {draft.validationIssues.map((issue, index) => (
              <li key={`${issue.code}-${index}`}>
                <span>{issue.severity}</span> {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <footer className={styles.editorFooter}>
        <button className={styles.secondaryButton} onClick={save} type="button">
          Save draft
        </button>
        <button className={styles.primaryButton} onClick={saveAndValidate} type="button">
          Save and validate
        </button>
        {saved && <span role="status">Saved locally.</span>}
      </footer>
    </section>
  );
}

function StartPlanDialog({ plan, onClose }: { plan: GamePlan; onClose: () => void }) {
  const navigate = useNavigate();
  const preparePlanStart = useGamePlanStore((state) => state.preparePlanStart);
  const startSession = useGameplayStore((state) => state.startSession);
  const existingSession = useGameplayStore(
    (state) => state.session ?? state.savedSession ?? state.savedSessionIssue,
  );
  const setTheme = useSettingsStore((state) => state.setTheme);
  const [teamOne, setTeamOne] = useState('Team Sunset');
  const [teamTwo, setTeamTwo] = useState('Team Starlight');
  const [acceptWarnings, setAcceptWarnings] = useState(false);
  const [replaceExistingGame, setReplaceExistingGame] = useState(false);
  const [showWarningAcceptance, setShowWarningAcceptance] = useState(
    plan.status === 'READY_WITH_WARNINGS',
  );
  const [message, setMessage] = useState<string | undefined>();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!teamOne.trim() || !teamTwo.trim() || teamOne.trim() === teamTwo.trim()) {
      setMessage('Enter two different team names.');
      return;
    }
    if (existingSession && !replaceExistingGame) {
      setMessage('Confirm replacement of the existing saved game before continuing.');
      return;
    }
    const result = preparePlanStart({
      planId: plan.id,
      teamOneName: teamOne.trim(),
      teamTwoName: teamTwo.trim(),
      acceptWarnings,
    });
    if (!result) return;
    if (!result.ok) {
      setMessage(result.message);
      setShowWarningAcceptance(result.code === 'WARNING_ACCEPTANCE_REQUIRED');
      return;
    }
    setTheme(result.plan.preferredTheme);
    startSession(result.session);
    void navigate('/game/play');
  };

  return (
    <div aria-labelledby="start-plan-title" className={styles.modalBackdrop} role="dialog">
      <form className={styles.modal} onSubmit={submit}>
        <p className={styles.eyebrow}>Start from plan</p>
        <h2 id="start-plan-title">{plan.name}</h2>
        <label>
          Team one
          <input onChange={(event) => setTeamOne(event.target.value)} value={teamOne} />
        </label>
        <label>
          Team two
          <input onChange={(event) => setTeamTwo(event.target.value)} value={teamTwo} />
        </label>
        {showWarningAcceptance && (
          <label className={styles.warningAcceptance}>
            <input
              checked={acceptWarnings}
              onChange={(event) => setAcceptWarnings(event.target.checked)}
              type="checkbox"
            />
            I reviewed and accept this plan’s warnings.
          </label>
        )}
        {existingSession && (
          <label className={styles.warningAcceptance}>
            <input
              checked={replaceExistingGame}
              onChange={(event) => setReplaceExistingGame(event.target.checked)}
              type="checkbox"
            />
            Replace the existing active or recoverable saved game.
          </label>
        )}
        {message && <p className={styles.formError}>{message}</p>}
        <div className={styles.actions}>
          <button className={styles.secondaryButton} onClick={onClose} type="button">
            Cancel
          </button>
          <button className={styles.primaryButton} type="submit">
            Start independent game
          </button>
        </div>
      </form>
    </div>
  );
}

export function PlansPage() {
  const {
    status,
    plans,
    storageIssue,
    error,
    initialize,
    createPlan,
    validatePlan,
    duplicatePlan,
    deletePlan,
    clearError,
  } = useGamePlanStore();
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [openMenuId, setOpenMenuId] = useState<string | undefined>();
  const [deleteId, setDeleteId] = useState<string | undefined>();
  const [startId, setStartId] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionFilter, setSelectionFilter] = useState<'ALL' | 'MANUAL' | 'RANDOM'>('ALL');
  const [sortMode, setSortMode] = useState<'RECENT' | 'OLDEST' | 'NAME'>('RECENT');
  const initializeGameplayPersistence = useGameplayStore((state) => state.initializePersistence);
  const catalogStatus = useAdminStore((state) => state.status);
  const initializeCatalog = useAdminStore((state) => state.initialize);

  useEffect(() => {
    initialize();
    initializeGameplayPersistence();
    void initializeCatalog();
  }, [initialize, initializeCatalog, initializeGameplayPersistence]);

  const catalog = getRuntimeCatalogIndex();
  const categories = catalog.snapshot.categories;

  const editingPlan = useMemo(
    () => plans.find((plan) => plan.id === editingId),
    [editingId, plans],
  );
  const startPlan = plans.find((plan) => plan.id === startId);
  const deletePlanTarget = plans.find((plan) => plan.id === deleteId);
  const visiblePlans = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    return plans
      .filter((plan) => {
        if (
          selectionFilter !== 'ALL' &&
          plan.roundConfig.categorySelectionMode !== selectionFilter
        ) {
          return false;
        }
        if (!normalizedQuery) return true;
        const categoryNames = plan.roundConfig.selectedCategoryIds
          .map(
            (categoryId) => categories.find((category) => category.id === categoryId)?.name ?? '',
          )
          .join(' ');
        return `${plan.name} ${plan.description ?? ''} ${categoryNames}`
          .toLocaleLowerCase()
          .includes(normalizedQuery);
      })
      .sort((first, second) => {
        if (sortMode === 'NAME') return first.name.localeCompare(second.name);
        const direction = sortMode === 'RECENT' ? -1 : 1;
        return direction * first.updatedAt.localeCompare(second.updatedAt);
      });
  }, [categories, plans, searchQuery, selectionFilter, sortMode]);

  const submitNew = (event: FormEvent) => {
    event.preventDefault();
    const plan = createPlan(newName);
    if (plan) {
      setNewName('');
      setIsCreating(false);
      setEditingId(plan.id);
    }
  };

  if (status !== 'READY' || catalogStatus === 'UNINITIALIZED' || catalogStatus === 'LOADING') {
    return <p className={styles.loading}>Loading Saved Game Plans and catalog…</p>;
  }

  return (
    <section className={styles.plansPage}>
      <header className={styles.pageHeader}>
        <div className={styles.titleLockup}>
          <span aria-hidden="true" className={styles.titleNote}>
            ♫
          </span>
          <div>
            <p className={styles.eyebrow}>Game Setup</p>
            <h1>Saved Game Plans</h1>
            <p>Your reusable game setups. Pick one and start playing.</p>
          </div>
          <span aria-hidden="true" className={styles.titleSpark}>
            ♪
          </span>
        </div>
        <button className={styles.createButton} onClick={() => setIsCreating(true)} type="button">
          <span aria-hidden="true">＋</span>
          Create new plan
        </button>
      </header>

      {storageIssue && (
        <div className={styles.errorBanner} role="alert">
          <strong>Saved plans need attention.</strong> {storageIssue.message} The original data was
          not changed.
        </div>
      )}
      {error && (
        <div className={styles.errorBanner} role="alert">
          <span>{error}</span>
          <button onClick={clearError} type="button">
            Dismiss
          </button>
        </div>
      )}

      <div className={styles.controls}>
        <label className={styles.searchField}>
          <span aria-hidden="true">⌕</span>
          <span className={styles.visuallyHidden}>Search game plans</span>
          <input
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search game plans…"
            type="search"
            value={searchQuery}
          />
        </label>
        <label className={styles.selectField}>
          <span className={styles.visuallyHidden}>Filter by category selection</span>
          <select
            onChange={(event) =>
              setSelectionFilter(event.target.value as 'ALL' | 'MANUAL' | 'RANDOM')
            }
            value={selectionFilter}
          >
            <option value="ALL">All plan types</option>
            <option value="MANUAL">Custom categories</option>
            <option value="RANDOM">Random categories</option>
          </select>
        </label>
        <label className={styles.selectField}>
          <span className={styles.visuallyHidden}>Sort game plans</span>
          <select
            onChange={(event) => setSortMode(event.target.value as 'RECENT' | 'OLDEST' | 'NAME')}
            value={sortMode}
          >
            <option value="RECENT">Sort: Recently updated</option>
            <option value="OLDEST">Sort: Oldest updated</option>
            <option value="NAME">Sort: Name</option>
          </select>
        </label>
      </div>

      <div className={styles.planList} aria-label="Saved plans">
        {plans.length === 0 && (
          <div className={styles.emptyState}>
            <span aria-hidden="true">♫</span>
            <h2>Your first game plan starts here.</h2>
            <p>Save a reusable set of categories, songs, and game rules for faster setup.</p>
            <button
              className={styles.createButton}
              onClick={() => setIsCreating(true)}
              type="button"
            >
              Create new plan
            </button>
          </div>
        )}

        {plans.length > 0 && visiblePlans.length === 0 && (
          <div className={styles.emptyState}>
            <span aria-hidden="true">⌕</span>
            <h2>No matching plans.</h2>
            <p>Try a different name or plan type.</p>
            <button
              className={styles.secondaryButton}
              onClick={() => {
                setSearchQuery('');
                setSelectionFilter('ALL');
              }}
              type="button"
            >
              Clear filters
            </button>
          </div>
        )}

        {visiblePlans.map((plan, index) => {
          const selectedCategories = plan.roundConfig.selectedCategoryIds
            .map((categoryId) => categories.find((category) => category.id === categoryId))
            .filter((category): category is Category => Boolean(category));
          const icon = selectedCategories[0]
            ? resolveCategoryIcon(selectedCategories[0].icon)
            : plan.roundConfig.categorySelectionMode === 'RANDOM'
              ? '🎲'
              : '♫';
          const categoryLabels =
            plan.roundConfig.categorySelectionMode === 'RANDOM'
              ? ['Random categories']
              : selectedCategories.slice(0, 3).map((category) => category.name);
          const remainingCategories = Math.max(
            0,
            selectedCategories.length - categoryLabels.length,
          );

          return (
            <article className={styles.planCard} key={plan.id}>
              <div className={`${styles.planArtwork} ${styles[`artwork${(index % 4) + 1}`]}`}>
                <span aria-hidden="true">{icon}</span>
              </div>

              <div className={styles.planSummary}>
                <div className={styles.planNameRow}>
                  <h2>{plan.name}</h2>
                  <PlanStatus plan={plan} />
                </div>
                <div className={styles.categoryTags}>
                  {categoryLabels.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                  {remainingCategories > 0 && <span>+{remainingCategories}</span>}
                </div>
                <div className={styles.planFacts}>
                  <span>
                    <b aria-hidden="true">♫</b>{' '}
                    {plan.roundConfig.songSelectionMode === 'FULL_CATALOG'
                      ? 'Full catalog'
                      : 'Curated songs'}
                  </span>
                  <span>
                    <b aria-hidden="true">▦</b> {plan.roundConfig.categoryCount} categories
                  </span>
                  <span>
                    <b aria-hidden="true">◈</b>{' '}
                    {plan.preferredTheme === 'DAY_PARTY' ? 'Day Party' : 'Game Night'}
                  </span>
                </div>
              </div>

              <div className={styles.planDate}>
                <span>Updated</span>
                <strong>
                  {new Intl.DateTimeFormat(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  }).format(new Date(plan.updatedAt))}
                </strong>
                <small>
                  Created{' '}
                  {new Intl.DateTimeFormat(undefined, {
                    month: 'short',
                    day: 'numeric',
                  }).format(new Date(plan.createdAt))}
                </small>
              </div>

              <div className={styles.planActions}>
                <button
                  className={styles.startButton}
                  onClick={() => setStartId(plan.id)}
                  type="button"
                >
                  <span aria-hidden="true">▶</span>
                  Start
                </button>
                <div className={styles.menuContainer}>
                  <button
                    aria-expanded={openMenuId === plan.id}
                    aria-haspopup="menu"
                    aria-label={`Actions for ${plan.name}`}
                    className={styles.menuButton}
                    onClick={() =>
                      setOpenMenuId((current) => (current === plan.id ? undefined : plan.id))
                    }
                    type="button"
                  >
                    ⋮
                  </button>
                  {openMenuId === plan.id && (
                    <div
                      aria-label={`${plan.name} actions`}
                      className={styles.planMenu}
                      role="menu"
                    >
                      <button
                        onClick={() => {
                          setEditingId(plan.id);
                          setOpenMenuId(undefined);
                        }}
                        role="menuitem"
                        type="button"
                      >
                        <span aria-hidden="true">✎</span> Edit plan
                      </button>
                      <button
                        onClick={() => {
                          validatePlan(plan.id);
                          setOpenMenuId(undefined);
                        }}
                        role="menuitem"
                        type="button"
                      >
                        <span aria-hidden="true">✓</span> Validate
                      </button>
                      <button
                        onClick={() => {
                          duplicatePlan(plan.id);
                          setOpenMenuId(undefined);
                        }}
                        role="menuitem"
                        type="button"
                      >
                        <span aria-hidden="true">▣</span> Duplicate
                      </button>
                      <button
                        className={styles.deleteAction}
                        onClick={() => {
                          setDeleteId(plan.id);
                          setOpenMenuId(undefined);
                        }}
                        role="menuitem"
                        type="button"
                      >
                        <span aria-hidden="true">♲</span> Delete plan
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <aside className={styles.tip}>
        <span aria-hidden="true">💡</span>
        <p>
          <strong>Tip:</strong> Create custom game plans with your favorite categories and songs for
          quick setup.
        </p>
      </aside>

      {isCreating && (
        <div
          aria-labelledby="create-plan-title"
          aria-modal="true"
          className={styles.modalBackdrop}
          role="dialog"
        >
          <form className={styles.modal} onSubmit={submitNew}>
            <p className={styles.eyebrow}>New game plan</p>
            <h2 id="create-plan-title">Name your plan.</h2>
            <p>You can choose categories, songs, and rules in the next step.</p>
            <label>
              Plan name
              <input
                autoFocus
                maxLength={60}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Friday karaoke crowd"
                value={newName}
              />
            </label>
            <div className={styles.actions}>
              <button
                className={styles.secondaryButton}
                onClick={() => {
                  setIsCreating(false);
                  setNewName('');
                }}
                type="button"
              >
                Cancel
              </button>
              <button className={styles.primaryButton} type="submit">
                Create and edit
              </button>
            </div>
          </form>
        </div>
      )}

      {editingPlan && (
        <div
          aria-label={`Edit ${editingPlan.name}`}
          aria-modal="true"
          className={styles.editorBackdrop}
          role="dialog"
        >
          <PlanEditor
            catalog={catalog}
            categories={categories}
            plan={editingPlan}
            onClose={() => setEditingId(undefined)}
          />
        </div>
      )}

      {deletePlanTarget && (
        <div
          aria-labelledby="delete-plan-title"
          aria-modal="true"
          className={styles.modalBackdrop}
          role="alertdialog"
        >
          <div className={styles.modal}>
            <p className={styles.eyebrow}>Delete game plan</p>
            <h2 id="delete-plan-title">Delete “{deletePlanTarget.name}”?</h2>
            <p>This removes the saved setup from this device. Active games are not affected.</p>
            <div className={styles.actions}>
              <button
                className={styles.secondaryButton}
                onClick={() => setDeleteId(undefined)}
                type="button"
              >
                Keep plan
              </button>
              <button
                className={styles.dangerButton}
                onClick={() => {
                  deletePlan(deletePlanTarget.id);
                  setDeleteId(undefined);
                  if (editingId === deletePlanTarget.id) setEditingId(undefined);
                }}
                type="button"
              >
                Delete plan
              </button>
            </div>
          </div>
        </div>
      )}

      {startPlan && <StartPlanDialog onClose={() => setStartId(undefined)} plan={startPlan} />}
    </section>
  );
}

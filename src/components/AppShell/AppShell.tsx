import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import type { GamePhase } from '../../domain/enums';
import type { GameSession } from '../../domain/models/game';
import { getRuntimeCatalogIndex } from '../../features/game/runtimeCatalog';
import { useGameplayStore } from '../../store/gameplayStore';
import { useSettingsStore } from '../../store/settingsStore';
import styles from './AppShell.module.css';

const navigation = [
  { icon: '⌂', label: 'Home', to: '/' },
  { icon: '▶', label: 'New Game', to: '/game' },
  { icon: '▤', label: 'Saved Game Plans', to: '/plans' },
  { icon: '◆', label: 'Admin Portal', to: '/admin' },
  { icon: '⚙', label: 'Settings', to: '/settings' },
] as const;

const screenContexts = [
  { label: 'Active Game', path: '/game/play', section: 'Gameplay' },
  { label: 'New Game', path: '/game', section: 'Game Setup' },
  { label: 'Saved Game Plans', path: '/plans', section: 'Game Setup' },
  { label: 'Admin Portal', path: '/admin', section: 'Admin Portal' },
  { label: 'Settings', path: '/settings', section: 'Preferences' },
  { label: 'Playback Lab', path: '/playback-spike', section: 'Diagnostics' },
] as const;

const STEAL_PHASES = new Set<GamePhase>(['STEAL_OFFER', 'STEAL_ANSWERING', 'STEAL_RESULT_REVIEW']);

const PHASE_LABELS: Partial<Record<GamePhase, string>> = {
  LEVEL_INTRO: 'Choose first team',
  TRIVIA_RESULT_ENTRY: 'Choose first team',
  TURN_ORDER_CONFIRMATION: 'Confirm turn order',
  CATEGORY_ASSIGNMENT: 'Choose category',
  CHALLENGE_SELECTION: 'Draw challenge',
  CHALLENGE_PREVIEW: 'Preview challenge',
  VIDEO_LOADING: 'Loading video',
  VIDEO_READY: 'Video ready',
  VIDEO_PLAYING: 'Challenge playing',
  PRIMARY_ANSWERING: 'Primary answer',
  PRIMARY_RESULT_REVIEW: 'Review answer',
  STEAL_OFFER: 'Steal decision',
  STEAL_ANSWERING: 'Steal answer',
  STEAL_RESULT_REVIEW: 'Review steal',
  CHALLENGE_VERIFICATION: 'Reveal lyrics',
  FINAL_SCORE_REVIEW: 'Review score',
  TURN_SUMMARY: 'Turn scoreboard',
  LEVEL_SUMMARY: 'Level scoreboard',
  GAME_SUMMARY: 'Winner',
  RECOVERY: 'Game paused',
};

function Brand() {
  return (
    <NavLink aria-label="Lyric Lockout home" className={styles.brand ?? ''} to="/">
      <span aria-hidden="true" className={styles.brandMark}>
        <span>♪</span>
      </span>
      <span className={styles.brandCopy}>
        <strong>
          <span>Lyric</span> Lockout
        </strong>
        <small>Har Rag Mein Lyrics</small>
      </span>
    </NavLink>
  );
}

function GameplaySidebar({ session }: { session: GameSession }) {
  const turn = session.activeTurn;
  const activeTeamId = STEAL_PHASES.has(session.phase) ? turn?.opposingTeamId : turn?.primaryTeamId;
  const categoryId =
    session.activeChallenge?.category.id ??
    turn?.categoryId ??
    session.categoryHistory.at(-1)?.categoryId;
  const categoryName =
    session.activeChallenge?.category.name ??
    (categoryId ? getRuntimeCatalogIndex().categoryById.get(categoryId)?.name : undefined) ??
    'Not selected';
  const completedCategories = session.consumedCategoryIds.length;
  const totalCategories = session.roundConfig.selectedCategoryIds.length;
  const phaseLabel = PHASE_LABELS[session.phase] ?? session.phase.replaceAll('_', ' ');

  return (
    <div className={styles.gameplaySidebar}>
      <header className={styles.liveGameHeader}>
        <span aria-hidden="true" />
        <div>
          <small>{session.status === 'COMPLETED' ? 'Game complete' : 'Live game'}</small>
          <strong>Level {session.currentDifficulty} of 5</strong>
        </div>
      </header>

      <section className={styles.liveTeams} aria-labelledby="live-teams-heading">
        <h2 id="live-teams-heading">Teams &amp; scores</h2>
        <div>
          {session.teams.map((team, index) => {
            const isActive = team.id === activeTeamId;
            const hintsRemaining = Math.max(
              session.gameConfig.freeHintUsesPerTeam - team.lifelines.hintUseCount,
              0,
            );
            const huddlesRemaining = Math.max(
              session.gameConfig.freeTeamHuddleUsesPerTeam - team.lifelines.teamHuddleUseCount,
              0,
            );
            return (
              <article
                className={[
                  styles.liveTeamCard,
                  index === 0 ? styles.liveTeamBlue : styles.liveTeamPink,
                  isActive ? styles.liveTeamActive : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                data-active={isActive || undefined}
                key={team.id}
              >
                <header>
                  <span aria-hidden="true">{index === 0 ? '♚' : '◆'}</span>
                  <div>
                    <small>{isActive ? 'On stage' : `Team ${index + 1}`}</small>
                    <strong>{team.name}</strong>
                  </div>
                  <b>
                    {team.score}
                    <small>pts</small>
                  </b>
                </header>
                <div className={styles.teamLifelines} aria-label={`${team.name} lifelines`}>
                  <span>
                    <i aria-hidden="true">💡</i>
                    Hint
                    <b>×{hintsRemaining}</b>
                  </span>
                  <span>
                    <i aria-hidden="true">☁</i>
                    Huddle
                    <b>×{huddlesRemaining}</b>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.gameContext} aria-labelledby="game-context-heading">
        <h2 id="game-context-heading">Game context</h2>
        <dl>
          <div>
            <dt>Now</dt>
            <dd>{phaseLabel}</dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>{categoryName}</dd>
          </div>
          <div>
            <dt>Progress</dt>
            <dd>
              {completedCategories} / {totalCategories}
            </dd>
          </div>
        </dl>
        <progress
          aria-label={`${completedCategories} of ${totalCategories} categories complete`}
          max={totalCategories}
          value={completedCategories}
        />
      </section>

      <footer className={styles.gameSidebarFooter}>
        <span>
          <i aria-hidden="true">●</i>
          Saved locally
        </span>
        <NavLink to="/">Exit to home</NavLink>
      </footer>
    </div>
  );
}

function ThemeBadge({ theme }: { theme: 'DAY_PARTY' | 'GAME_NIGHT' }) {
  return (
    <div className={styles.themeBadge}>
      <span aria-hidden="true" />
      {theme === 'DAY_PARTY' ? 'Day Party' : 'Game Night'}
    </div>
  );
}

export function AppShell() {
  const theme = useSettingsStore((state) => state.theme);
  const persistenceStatus = useGameplayStore((state) => state.persistenceStatus);
  const activeSession = useGameplayStore((state) => state.session);
  const savedSession = useGameplayStore((state) => state.savedSession);
  const savedSessionIssue = useGameplayStore((state) => state.savedSessionIssue);
  const initializePersistence = useGameplayStore((state) => state.initializePersistence);
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const isLiveGameplay =
    location.pathname === '/game/play' &&
    Boolean(activeSession) &&
    activeSession?.phase !== 'GAME_SETUP' &&
    activeSession?.phase !== 'ROUND_BUILDING' &&
    activeSession?.phase !== 'ROUND_VALIDATION';
  const hasSavedGame = persistenceStatus === 'READY' && Boolean(savedSession ?? savedSessionIssue);
  const setupMode = new URLSearchParams(location.search).get('setup');
  const setupContext =
    location.pathname === '/game/play' && !activeSession
      ? {
          label: setupMode === 'random' ? 'Random Game Setup' : 'Custom Categories',
          section: 'Game Setup',
        }
      : undefined;
  const backstageContext =
    location.pathname === '/game/play' &&
    (activeSession?.phase === 'ROUND_BUILDING' || activeSession?.phase === 'ROUND_VALIDATION')
      ? { label: 'Backstage', section: 'Game Setup' }
      : undefined;
  const categorySelectionContext =
    location.pathname === '/game/play' && activeSession?.phase === 'CATEGORY_ASSIGNMENT'
      ? { label: 'Category Selection', section: `Level ${activeSession.currentDifficulty}` }
      : undefined;
  const scoreboardLevel =
    activeSession?.phase === 'LEVEL_SUMMARY'
      ? (activeSession.levelHistory.at(-1)?.difficulty ?? activeSession.currentDifficulty)
      : activeSession?.currentDifficulty;
  const scoreboardContext =
    location.pathname === '/game/play' &&
    (activeSession?.phase === 'FINAL_SCORE_REVIEW' ||
      activeSession?.phase === 'TURN_SUMMARY' ||
      activeSession?.phase === 'LEVEL_SUMMARY')
      ? { label: 'Scoreboard', section: `Level ${scoreboardLevel}` }
      : undefined;
  const winnerContext =
    location.pathname === '/game/play' && activeSession?.phase === 'GAME_SUMMARY'
      ? { label: 'Winner', section: 'Game Complete' }
      : undefined;
  const context =
    backstageContext ??
    setupContext ??
    categorySelectionContext ??
    scoreboardContext ??
    winnerContext ??
    screenContexts.find(({ path }) => location.pathname.startsWith(path)) ??
    ({ label: 'Not Found', section: 'Lyric Lockout' } as const);

  useEffect(() => {
    initializePersistence();
  }, [initializePersistence]);

  if (isLanding) {
    return (
      <div className={styles.landingShell}>
        <a className={styles.skipLink} href="#main-content">
          Skip to content
        </a>
        <header className={styles.landingHeader}>
          <Brand />
          <NavLink className={styles.settingsShortcut ?? ''} to="/settings">
            <span aria-hidden="true">⚙</span>
            Settings
          </NavLink>
        </header>
        <main className={styles.landingMain} id="main-content">
          <Outlet />
        </main>
        <footer className={styles.landingFooter}>
          <span>Built for the big screen</span>
          <span>Host-led • Local-first</span>
        </footer>
      </div>
    );
  }

  return (
    <div
      className={[styles.appShell, isLiveGameplay ? styles.liveGameLayout : '']
        .filter(Boolean)
        .join(' ')}
    >
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>
      <aside
        aria-label={isLiveGameplay ? 'Live game status' : undefined}
        className={[styles.sidebar, isLiveGameplay ? styles.liveSidebarShell : '']
          .filter(Boolean)
          .join(' ')}
      >
        <Brand />
        {isLiveGameplay && activeSession ? (
          <GameplaySidebar session={activeSession} />
        ) : (
          <>
            <nav aria-label="Primary navigation" className={styles.navigation}>
              {navigation.map(({ icon, label, to }) => (
                <NavLink
                  className={({ isActive }) => (isActive ? styles.activeLink : styles.link) ?? ''}
                  end={to === '/'}
                  key={to}
                  to={to}
                >
                  <span aria-hidden="true" className={styles.navIcon}>
                    {icon}
                  </span>
                  {label}
                </NavLink>
              ))}
            </nav>

            <div aria-hidden="true" className={styles.sidebarArtwork}>
              <span>♪</span>
              <i />
              <i />
              <i />
              <i />
            </div>

            {hasSavedGame ? (
              <NavLink className={styles.sidebarResume ?? ''} to="/game/play">
                <span aria-hidden="true">↻</span>
                <div>
                  <strong>Resume Game</strong>
                  <small>
                    {savedSession
                      ? savedSession.teams.map((team) => team.name).join(' vs ')
                      : 'Recovery needed'}
                  </small>
                </div>
                <b>Continue</b>
              </NavLink>
            ) : (
              <div className={styles.sidebarStatus}>
                <span aria-hidden="true">●</span>
                <div>
                  <strong>Ready for game night</strong>
                  <small>Local save enabled</small>
                </div>
              </div>
            )}
          </>
        )}
      </aside>

      <section className={styles.workspace}>
        <header className={styles.header}>
          <div className={styles.screenContext}>
            <span>{context.section}</span>
            <strong>{context.label}</strong>
          </div>
          <ThemeBadge theme={theme} />
        </header>

        <main className={styles.main} id="main-content">
          <Outlet />
        </main>

        <footer className={styles.footer}>
          <span>Local-first • Progress saved on this device</span>
          <span>Host mode • {context.label}</span>
        </footer>
      </section>
    </div>
  );
}

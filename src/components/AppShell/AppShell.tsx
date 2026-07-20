import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

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
  { label: 'Backstage', path: '/admin', section: 'Admin Portal' },
  { label: 'Settings', path: '/settings', section: 'Preferences' },
  { label: 'Playback Lab', path: '/playback-spike', section: 'Diagnostics' },
] as const;

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
  const savedSession = useGameplayStore((state) => state.savedSession);
  const savedSessionIssue = useGameplayStore((state) => state.savedSessionIssue);
  const initializePersistence = useGameplayStore((state) => state.initializePersistence);
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const hasSavedGame = persistenceStatus === 'READY' && Boolean(savedSession ?? savedSessionIssue);
  const context =
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
    <div className={styles.appShell}>
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>
      <aside className={styles.sidebar}>
        <Brand />
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

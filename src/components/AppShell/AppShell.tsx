import { NavLink, Outlet } from 'react-router-dom';

import styles from './AppShell.module.css';

const navigation = [
  { label: 'Home', to: '/' },
  { label: 'Game', to: '/game' },
  { label: 'Admin', to: '/admin' },
  { label: 'Settings', to: '/settings' },
] as const;

export function AppShell() {
  return (
    <div className={styles.appShell}>
      <header className={styles.header}>
        <NavLink aria-label="Lyric Lockout home" className={styles.brand ?? ''} to="/">
          <span aria-hidden="true" className={styles.brandMark}>
            LL
          </span>
          <span>
            <strong>Lyric Lockout</strong>
            <small>Finish the line. Own the moment.</small>
          </span>
        </NavLink>

        <nav aria-label="Primary navigation" className={styles.navigation}>
          {navigation.map(({ label, to }) => (
            <NavLink
              className={({ isActive }) => (isActive ? styles.activeLink : styles.link) ?? ''}
              end={to === '/'}
              key={to}
              to={to}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.themeBadge}>
          <span aria-hidden="true" />
          Day Party
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <span>Built for the big screen</span>
        <span>Host-led • Local-first</span>
      </footer>
    </div>
  );
}

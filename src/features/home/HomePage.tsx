import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { useGameplayStore } from '../../store/gameplayStore';
import styles from './HomePage.module.css';

interface MenuCardProps {
  badge?: string | undefined;
  children?: ReactNode;
  description: string;
  icon: string;
  title: string;
  to: string;
  tone: 'blue' | 'red' | 'purple' | 'gold' | 'cyan';
}

function MenuCard({ badge, children, description, icon, title, to, tone }: MenuCardProps) {
  return (
    <Link className={`${styles.menuCard} ${styles[tone] ?? ''}`} to={to}>
      {badge && <span className={styles.cardBadge}>{badge}</span>}
      <span aria-hidden="true" className={styles.cardIcon}>
        {icon}
      </span>
      <strong>{title}</strong>
      <p>{description}</p>
      {children}
      <span aria-hidden="true" className={styles.cardArrow}>
        →
      </span>
    </Link>
  );
}

export function HomePage() {
  const persistenceStatus = useGameplayStore((state) => state.persistenceStatus);
  const savedSession = useGameplayStore((state) => state.savedSession);
  const savedSessionIssue = useGameplayStore((state) => state.savedSessionIssue);
  const initializePersistence = useGameplayStore((state) => state.initializePersistence);

  useEffect(() => {
    initializePersistence();
  }, [initializePersistence]);

  const hasSavedGame = persistenceStatus === 'READY' && Boolean(savedSession ?? savedSessionIssue);
  const resumeDetail = savedSession
    ? {
        matchup: savedSession.teams.map((team) => team.name).join(' vs '),
        phase: `Level ${savedSession.currentDifficulty} · ${savedSession.phase
          .toLowerCase()
          .replaceAll('_', ' ')}`,
      }
    : {
        matchup: 'Saved game needs attention',
        phase: 'Review recovery options',
      };

  return (
    <section className={styles.homePage}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>
          <span aria-hidden="true">♛</span>
          The ultimate lyrics challenge
        </p>
        <h1 aria-label="Lyric Lockout">
          <span aria-hidden="true" className={styles.titlePrimary}>
            Lyric
            <span className={styles.titleCrown}>♛</span>
          </span>
          <span aria-hidden="true" className={styles.titleSecondary}>
            <span>Lock</span>
            <span className={styles.titleLock}>
              <i />
            </span>
            <span>ut</span>
          </span>
        </h1>
        <p className={styles.tagline}>
          <span aria-hidden="true" />
          Har Rag Mein <strong>Lyrics</strong>
          <span aria-hidden="true" />
        </p>
      </header>

      <div className={`${styles.menuGrid} ${hasSavedGame ? styles.withResume : ''}`}>
        <MenuCard
          description="Start a new game session"
          icon="▶"
          title="New Game"
          to="/game"
          tone="blue"
        />

        {hasSavedGame && (
          <MenuCard
            badge="Resume"
            description="Continue your interrupted game"
            icon="↻"
            title="Resume Game"
            to="/game/play"
            tone="red"
          >
            <span className={styles.resumeDetail}>
              <strong>{resumeDetail.matchup}</strong>
              <small>{resumeDetail.phase}</small>
            </span>
          </MenuCard>
        )}

        <MenuCard
          description="Choose from your saved game plans"
          icon="▤"
          title="Saved Game Plans"
          to="/plans"
          tone="purple"
        />

        <MenuCard
          description="Manage songs, categories and challenges"
          icon="◆"
          title="Admin Portal"
          to="/admin"
          tone="gold"
        />

        <MenuCard
          description="Customize your game-night experience"
          icon="⚙"
          title="Settings"
          to="/settings"
          tone="cyan"
        />
      </div>

      <aside className={styles.tip}>
        <span aria-hidden="true" className={styles.tipIcon}>
          ✦
        </span>
        <strong>Tip:</strong>
        <p>Create custom games, play, and save your favorite combinations as Game Plans.</p>
      </aside>
    </section>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';

import styles from './NewGamePage.module.css';

interface GameModeCardProps {
  action: string;
  art: 'folder' | 'categories' | 'dice';
  badge?: string | undefined;
  description: string;
  title: string;
  to: string;
  tone: 'red' | 'purple' | 'blue';
}

function GameModeCard({ action, art, badge, description, title, to, tone }: GameModeCardProps) {
  return (
    <article className={`${styles.modeCard} ${styles[tone] ?? ''}`}>
      {badge && <span className={styles.badge}>★ {badge}</span>}
      <div aria-hidden="true" className={`${styles.cardArt} ${styles[art] ?? ''}`}>
        {art === 'folder' && <span>★</span>}
        {art === 'categories' && (
          <>
            <i />
            <i />
            <i />
            <i>+</i>
          </>
        )}
        {art === 'dice' && (
          <>
            <span>⚄</span>
            <span>⚃</span>
          </>
        )}
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      <Link className={styles.cardAction} to={to}>
        {action}
        <span aria-hidden="true">›</span>
      </Link>
    </article>
  );
}

export function NewGamePage() {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <section className={styles.newGamePage}>
      <button className={styles.helpButton} onClick={() => setShowHelp(true)} type="button">
        <span aria-hidden="true">?</span>
        How it works
      </button>

      <header className={styles.hero}>
        <p aria-hidden="true" className={styles.notes}>
          ♪ <span>✦</span> ♫
        </p>
        <h1>New Game</h1>
        <span aria-hidden="true" className={styles.titleRule}>
          ★
        </span>
        <p>Choose how you want to create today’s game</p>
      </header>

      <div className={styles.modeGrid}>
        <GameModeCard
          action="Browse Plans"
          art="folder"
          description="Choose from your existing game plans and jump right in."
          title="From Saved Plan"
          to="/plans"
          tone="red"
        />
        <GameModeCard
          action="Choose Categories"
          art="categories"
          badge="Recommended"
          description="Pick and choose the ten categories you want to include."
          title="Custom Categories"
          to="/game/play?setup=custom"
          tone="purple"
        />
        <GameModeCard
          action="Surprise Me"
          art="dice"
          description="Let the game choose ten eligible categories for you."
          title="Random Categories"
          to="/game/play?setup=random"
          tone="blue"
        />
      </div>

      <aside className={styles.tip}>
        <span aria-hidden="true">✦</span>
        <div>
          <strong>Tip</strong>
          <p>You can save a custom setup as a Game Plan for future game nights.</p>
        </div>
      </aside>

      {showHelp && (
        <div
          aria-labelledby="new-game-help-title"
          aria-modal="true"
          className={styles.modalBackdrop}
          role="dialog"
        >
          <div className={styles.modal}>
            <span aria-hidden="true" className={styles.modalIcon}>
              ♪
            </span>
            <p className={styles.modalEyebrow}>Game setup</p>
            <h2 id="new-game-help-title">Three quick ways to start.</h2>
            <ol>
              <li>Reuse a saved plan for a familiar game night.</li>
              <li>Choose ten categories for a custom mix.</li>
              <li>Let Lyric Lockout pick ten eligible categories at random.</li>
            </ol>
            <button onClick={() => setShowHelp(false)} type="button">
              Got it
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

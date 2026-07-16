import type { ReactNode } from 'react';

import styles from './PageIntro.module.css';

interface PageIntroProps {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}

export function PageIntro({ children, description, eyebrow, title }: PageIntroProps) {
  return (
    <section className={styles.pageIntro}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1>{title}</h1>
        <p className={styles.description}>{description}</p>
        {children ? <div className={styles.actions}>{children}</div> : null}
      </div>

      <div aria-hidden="true" className={styles.artwork}>
        <span className={styles.note}>♪</span>
        <span className={styles.lyric}>_ _ _</span>
        <span className={styles.spark}>✦</span>
      </div>
    </section>
  );
}

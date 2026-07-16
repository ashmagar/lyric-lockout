import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import styles from './ButtonLink.module.css';

interface ButtonLinkProps {
  children: ReactNode;
  to: string;
  variant?: 'primary' | 'secondary';
}

export function ButtonLink({ children, to, variant = 'primary' }: ButtonLinkProps) {
  return (
    <Link className={styles[variant]} to={to}>
      {children}
    </Link>
  );
}

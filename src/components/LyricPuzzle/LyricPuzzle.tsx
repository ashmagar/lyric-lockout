import {
  isLyricWordToken,
  resolveHiddenWordIndexes,
  tokenizeLyrics,
} from '../../domain/catalog/lyrics';
import styles from './LyricPuzzle.module.css';

interface LyricPuzzleProps {
  expectedLyrics: string;
  hiddenWordIndexes?: readonly number[] | undefined;
  label?: string | undefined;
}

export function LyricPuzzle({
  expectedLyrics,
  hiddenWordIndexes,
  label = 'Lyrics to complete',
}: LyricPuzzleProps) {
  const hidden = new Set(resolveHiddenWordIndexes(expectedLyrics, hiddenWordIndexes));

  return (
    <div aria-label={label} className={styles.puzzle}>
      {tokenizeLyrics(expectedLyrics).map((token, tokenIndex) => {
        if (!isLyricWordToken(token)) {
          return (
            <span className={styles.token} key={`punctuation-${tokenIndex}`}>
              {token.text}
            </span>
          );
        }

        const isHidden = hidden.has(token.wordIndex);
        return (
          <span className={styles.token} key={`word-${token.wordIndex}`}>
            {token.prefix}
            {isHidden ? (
              <span aria-label={`Missing word ${token.wordIndex + 1}`} className={styles.blank}>
                ____
              </span>
            ) : (
              token.text
            )}
            {token.suffix}
          </span>
        );
      })}
    </div>
  );
}

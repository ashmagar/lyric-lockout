import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import {
  DIFFICULTY_LEVELS,
  allLyricWordIndexes,
  createChallengeDraft,
  isLyricWordToken,
  parseYouTubeVideoId,
  tokenizeLyrics,
  withExplicitHiddenWordSelection,
  type Category,
  type Challenge,
  type DifficultyLevel,
  type Song,
} from '../../domain';
import { LyricPuzzle } from '../../components/LyricPuzzle/LyricPuzzle';
import { songSchema } from '../../schemas';
import { AdminChallengePreview } from './AdminChallengePreview';
import styles from './AdminPage.module.css';

function normalizeSongLyrics(song: Song): Song {
  return {
    ...song,
    challenges: song.challenges.map(withExplicitHiddenWordSelection),
  };
}

interface SongEditorProps {
  initialSong: Song;
  categories: readonly Category[];
  fakeMedia: boolean;
  onSave: (song: Song) => Promise<boolean>;
  onClose: () => void;
  nextId: (prefix: string) => string;
}

interface TimestampFieldProps {
  label: string;
  value: number | undefined;
  currentTime: number;
  optional?: boolean | undefined;
  onChange: (value: number | undefined) => void;
}

function TimestampField({ label, value, currentTime, optional, onChange }: TimestampFieldProps) {
  const nudge = (delta: number) => onChange(Math.max(0, (value ?? 0) + delta));
  return (
    <div className={styles.timestampField}>
      <label>
        {label}
        <input
          min="0"
          onChange={(event) =>
            onChange(optional && event.target.value === '' ? undefined : Number(event.target.value))
          }
          step="0.1"
          type="number"
          value={value ?? ''}
        />
      </label>
      <div>
        <button onClick={() => nudge(-0.1)} type="button">
          −0.1
        </button>
        <button onClick={() => nudge(0.1)} type="button">
          +0.1
        </button>
        <button onClick={() => onChange(Number(currentTime.toFixed(2)))} type="button">
          Capture current
        </button>
      </div>
    </div>
  );
}

interface ChallengeEditorProps {
  challenge: Challenge;
  currentTime: number;
  onChange: (challenge: Challenge) => void;
  onDelete: () => void;
}

function ChallengeEditor({ challenge, currentTime, onChange, onDelete }: ChallengeEditorProps) {
  const set = <K extends keyof Challenge>(key: K, value: Challenge[K]) =>
    onChange({ ...challenge, [key]: value, updatedAt: new Date().toISOString() });
  const lyricTokens = tokenizeLyrics(challenge.expectedLyrics);
  const hiddenWordIndexes = challenge.hiddenWordIndexes ?? [];
  const hiddenWords = new Set(hiddenWordIndexes);

  const setHiddenWordIndexes = (indexes: number[]) => {
    const sortedIndexes = [...indexes].sort((left, right) => left - right);
    onChange({
      ...challenge,
      hiddenWordIndexes: sortedIndexes,
      missingWordCount: sortedIndexes.length,
      updatedAt: new Date().toISOString(),
    });
  };

  const toggleHiddenWord = (wordIndex: number) => {
    setHiddenWordIndexes(
      hiddenWords.has(wordIndex)
        ? hiddenWordIndexes.filter((index) => index !== wordIndex)
        : [...hiddenWordIndexes, wordIndex],
    );
  };

  return (
    <details className={styles.challengeCard} open>
      <summary>
        Level {challenge.difficulty} · {challenge.enabled ? 'Enabled' : 'Disabled draft'}
      </summary>
      <div className={styles.twoColumns}>
        <label>
          Challenge ID
          <input onChange={(event) => set('id', event.target.value)} value={challenge.id} />
        </label>
        <label>
          Difficulty
          <select
            onChange={(event) => set('difficulty', Number(event.target.value) as DifficultyLevel)}
            value={challenge.difficulty}
          >
            {DIFFICULTY_LEVELS.map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                Level {difficulty}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={styles.timestampGrid}>
        <TimestampField
          currentTime={currentTime}
          label="Playback start"
          onChange={(value) => set('playbackStartSeconds', value ?? 0)}
          value={challenge.playbackStartSeconds}
        />
        <TimestampField
          currentTime={currentTime}
          label="Verification start"
          onChange={(value) => set('verifyFromSeconds', value ?? 0)}
          value={challenge.verifyFromSeconds}
        />
        <TimestampField
          currentTime={currentTime}
          label="Challenge pause"
          onChange={(value) => set('pauseAtSeconds', value ?? 0)}
          value={challenge.pauseAtSeconds}
        />
        <TimestampField
          currentTime={currentTime}
          label="Verification end"
          onChange={(value) => set('verifyToSeconds', value)}
          optional
          value={challenge.verifyToSeconds}
        />
      </div>
      <label>
        Acceptable lyrics
        <textarea
          onChange={(event) =>
            onChange({
              ...challenge,
              expectedLyrics: event.target.value,
              hiddenWordIndexes: [],
              missingWordCount: 0,
              updatedAt: new Date().toISOString(),
            })
          }
          rows={3}
          value={challenge.expectedLyrics}
        />
      </label>
      <fieldset className={styles.lyricSelection}>
        <legend>Hidden words</legend>
        <p>
          Select each word players must supply. Word numbers shown here are for authoring only;
          stored indexes are zero-based.
        </p>
        <div className={styles.lyricSelectionActions}>
          <button
            onClick={() => setHiddenWordIndexes(allLyricWordIndexes(challenge.expectedLyrics))}
            type="button"
          >
            Select all words
          </button>
          <button onClick={() => setHiddenWordIndexes([])} type="button">
            Clear hidden words
          </button>
          <output aria-label="Hidden word count">
            {hiddenWordIndexes.length} hidden {hiddenWordIndexes.length === 1 ? 'word' : 'words'}
          </output>
        </div>
        <div aria-label="Selectable lyric words" className={styles.lyricTokens}>
          {lyricTokens.map((token, tokenIndex) =>
            isLyricWordToken(token) ? (
              <button
                aria-label={`Word ${token.wordIndex + 1}: ${token.prefix}${token.text}${token.suffix}`}
                aria-pressed={hiddenWords.has(token.wordIndex)}
                className={hiddenWords.has(token.wordIndex) ? styles.hiddenLyricToken : undefined}
                key={`word-${token.wordIndex}`}
                onClick={() => toggleHiddenWord(token.wordIndex)}
                type="button"
              >
                <small>{token.wordIndex + 1}</small>
                {token.prefix}
                {token.text}
                {token.suffix}
              </button>
            ) : (
              <span className={styles.punctuationToken} key={`punctuation-${tokenIndex}`}>
                {token.text}
              </span>
            ),
          )}
        </div>
        {hiddenWordIndexes.length === 0 && (
          <p className={styles.fieldError} role="alert">
            Select at least one hidden word before saving. Lyric edits clear the previous selection
            so indexes cannot silently move to different words.
          </p>
        )}
        <div className={styles.lyricPreview}>
          <strong>Gameplay preview</strong>
          <LyricPuzzle
            expectedLyrics={challenge.expectedLyrics}
            hiddenWordIndexes={hiddenWordIndexes}
            label="Lyric puzzle display"
          />
        </div>
      </fieldset>
      <div className={styles.twoColumns}>
        <label>
          Hint
          <input
            onChange={(event) => set('hintText', event.target.value)}
            value={challenge.hintText}
          />
        </label>
      </div>
      <div className={styles.editorActions}>
        <label className={styles.inlineCheck}>
          <input
            checked={challenge.enabled}
            onChange={(event) => set('enabled', event.target.checked)}
            type="checkbox"
          />
          Challenge enabled
        </label>
        <button className={styles.dangerButton} onClick={onDelete} type="button">
          Remove challenge
        </button>
      </div>
    </details>
  );
}

export function SongEditor({
  initialSong,
  categories,
  fakeMedia,
  onSave,
  onClose,
  nextId,
}: SongEditorProps) {
  const [draft, setDraft] = useState(() => normalizeSongLyrics(initialSong));
  const [youtubeInput, setYoutubeInput] = useState(initialSong.youtubeVideoId);
  const [youtubeError, setYoutubeError] = useState<string | undefined>();
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localIssues, setLocalIssues] = useState<string[]>([]);
  const [selectedChallengeId, setSelectedChallengeId] = useState(initialSong.challenges[0]?.id);
  const [currentTime, setCurrentTime] = useState(0);
  const [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => {
    setDraft(normalizeSongLyrics(initialSong));
    setYoutubeInput(initialSong.youtubeVideoId);
    setDirty(false);
    setLocalIssues([]);
    setSelectedChallengeId(initialSong.challenges[0]?.id);
  }, [initialSong]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const change = useCallback((update: (song: Song) => Song) => {
    setDirty(true);
    setDraft((current) => ({
      ...update(current),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const selectedChallenge = useMemo(
    () => draft.challenges.find((challenge) => challenge.id === selectedChallengeId),
    [draft.challenges, selectedChallengeId],
  );

  const setChallenge = (challenge: Challenge) => {
    change((song) => ({
      ...song,
      challenges: song.challenges.map((candidate) =>
        candidate.id === selectedChallengeId ? challenge : candidate,
      ),
    }));
    setSelectedChallengeId(challenge.id);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = songSchema.safeParse(draft);
    if (!parsed.success) {
      setLocalIssues(parsed.error.issues.map((issue) => issue.message));
      return;
    }
    setSaving(true);
    const saved = await onSave(parsed.data);
    setSaving(false);
    if (saved) {
      setDraft(parsed.data);
      setDirty(false);
      setLocalIssues([]);
    }
  };

  const updateYoutube = (value: string) => {
    setYoutubeInput(value);
    setDirty(true);
    const parsed = parseYouTubeVideoId(value);
    if (!parsed.ok) {
      setYoutubeError(parsed.message);
      return;
    }
    setYoutubeError(undefined);
    change((song) => ({ ...song, youtubeVideoId: parsed.videoId }));
  };

  const attemptClose = () => {
    if (dirty && !confirmClose) {
      setConfirmClose(true);
      return;
    }
    onClose();
  };

  return (
    <form className={styles.songEditor} onSubmit={(event) => void submit(event)}>
      <header className={styles.editorHeader}>
        <div>
          <p className={styles.eyebrow}>Song editor</p>
          <h2>{draft.title || 'Untitled song'}</h2>
          {dirty && <span className={styles.unsavedBadge}>Unsaved changes</span>}
        </div>
        <button onClick={attemptClose} type="button">
          {confirmClose ? 'Discard unsaved changes' : 'Close editor'}
        </button>
      </header>

      <section className={styles.editorSection}>
        <h3>Video and metadata</h3>
        <label>
          YouTube URL or video ID
          <input
            aria-invalid={Boolean(youtubeError)}
            onChange={(event) => updateYoutube(event.target.value)}
            value={youtubeInput}
          />
        </label>
        {youtubeError && <p className={styles.fieldError}>{youtubeError}</p>}
        <div className={styles.twoColumns}>
          <label>
            Song ID
            <input readOnly value={draft.id} />
          </label>
          <label>
            Video type
            <select
              onChange={(event) =>
                change((song) => ({
                  ...song,
                  videoType: event.target.value as Song['videoType'],
                }))
              }
              value={draft.videoType}
            >
              <option value="LYRIC">Lyric</option>
              <option value="KARAOKE">Karaoke</option>
              <option value="OFFICIAL_VIDEO">Official video</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label>
            Title
            <input
              onChange={(event) => change((song) => ({ ...song, title: event.target.value }))}
              value={draft.title}
            />
          </label>
          <label>
            Artist
            <input
              onChange={(event) => change((song) => ({ ...song, artist: event.target.value }))}
              value={draft.artist}
            />
          </label>
          <label>
            Language
            <input
              onChange={(event) =>
                change((song) => ({
                  ...song,
                  language: event.target.value || undefined,
                }))
              }
              value={draft.language ?? ''}
            />
          </label>
          <label>
            Release year
            <input
              onChange={(event) =>
                change((song) => ({
                  ...song,
                  releaseYear: event.target.value ? Number(event.target.value) : undefined,
                }))
              }
              type="number"
              value={draft.releaseYear ?? ''}
            />
          </label>
        </div>
        <label className={styles.inlineCheck}>
          <input
            checked={draft.enabled}
            onChange={(event) => change((song) => ({ ...song, enabled: event.target.checked }))}
            type="checkbox"
          />
          Song enabled
        </label>
      </section>

      <fieldset className={styles.editorSection}>
        <legend>Categories</legend>
        <div className={styles.categoryChecks}>
          {categories.map((category) => (
            <label className={styles.inlineCheck} key={category.id}>
              <input
                checked={draft.categoryIds.includes(category.id)}
                onChange={() =>
                  change((song) => ({
                    ...song,
                    categoryIds: song.categoryIds.includes(category.id)
                      ? song.categoryIds.filter((id) => id !== category.id)
                      : [...song.categoryIds, category.id],
                  }))
                }
                type="checkbox"
              />
              {category.name}
            </label>
          ))}
        </div>
      </fieldset>

      <section className={styles.editorSection}>
        <div className={styles.sectionHeader}>
          <h3>Challenges</h3>
          <button
            onClick={() => {
              const challenge = createChallengeDraft(
                nextId('challenge'),
                1,
                new Date().toISOString(),
              );
              change((song) => ({
                ...song,
                challenges: [...song.challenges, challenge],
              }));
              setSelectedChallengeId(challenge.id);
            }}
            type="button"
          >
            Add challenge
          </button>
        </div>
        <div className={styles.challengeTabs}>
          {draft.challenges.map((challenge) => (
            <button
              className={selectedChallengeId === challenge.id ? styles.activeChallenge : undefined}
              key={challenge.id}
              onClick={() => setSelectedChallengeId(challenge.id)}
              type="button"
            >
              L{challenge.difficulty}
            </button>
          ))}
        </div>
        {selectedChallenge && (
          <>
            <ChallengeEditor
              challenge={selectedChallenge}
              currentTime={currentTime}
              onChange={setChallenge}
              onDelete={() => {
                change((song) => ({
                  ...song,
                  challenges: song.challenges.filter(
                    (challenge) => challenge.id !== selectedChallenge.id,
                  ),
                }));
                setSelectedChallengeId(
                  draft.challenges.find((challenge) => challenge.id !== selectedChallenge.id)?.id,
                );
              }}
            />
            <AdminChallengePreview
              challenge={selectedChallenge}
              fakeMedia={fakeMedia}
              onCurrentTime={setCurrentTime}
              song={draft}
            />
          </>
        )}
      </section>

      {localIssues.length > 0 && (
        <div className={styles.errorCard} role="alert">
          <strong>Fix these fields before saving:</strong>
          <ul>
            {localIssues.map((issue, index) => (
              <li key={`${issue}-${index}`}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      <footer className={styles.stickySave}>
        <span>{dirty ? 'Draft has unsaved changes.' : 'All changes saved.'}</span>
        <button className={styles.primaryButton} disabled={saving} type="submit">
          {saving ? 'Saving…' : 'Save song'}
        </button>
      </footer>
    </form>
  );
}

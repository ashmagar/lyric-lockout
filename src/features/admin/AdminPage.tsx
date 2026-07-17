import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import {
  analyzeCatalogCoverage,
  buildCatalogIndex,
  createCatalogSnapshot,
} from '../../domain/catalog';
import { createSongDraft, duplicateSong, type DifficultyLevel, type Song } from '../../domain';
import { useAdminStore } from '../../store/adminStore';
import { SongEditor } from './SongEditor';
import { useContinuousList } from './useContinuousList';
import styles from './AdminPage.module.css';

type AdminView = 'DASHBOARD' | 'SONGS' | 'CATEGORIES' | 'COVERAGE' | 'VALIDATION' | 'IMPORT_EXPORT';

const VIEW_LABELS: Record<AdminView, string> = {
  DASHBOARD: 'Dashboard',
  SONGS: 'Songs',
  CATEGORIES: 'Categories',
  COVERAGE: 'Coverage',
  VALIDATION: 'Validation',
  IMPORT_EXPORT: 'Import / Export',
};

let fallbackSequence = 0;

function nextId(prefix: string): string {
  fallbackSequence += 1;
  const unique =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${fallbackSequence}`;
  return `${prefix}-${unique}`;
}

function downloadJson(name: string, value: unknown): void {
  const url = URL.createObjectURL(
    new Blob([`${JSON.stringify(value, null, 2)}\n`], {
      type: 'application/json',
    }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Dashboard() {
  const { songs, categories, issues } = useAdminStore();
  const enabledSongs = songs.filter((song) => song.enabled).length;
  const enabledChallenges = songs
    .flatMap((song) => song.challenges)
    .filter((challenge) => challenge.enabled).length;
  const recent = [...songs]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 5);
  return (
    <section className={styles.view}>
      <header className={styles.viewHeader}>
        <p className={styles.eyebrow}>Dashboard</p>
        <h2>Catalog at a glance</h2>
      </header>
      <div className={styles.metricGrid}>
        <article>
          <span>Songs</span>
          <strong>{songs.length}</strong>
          <small>{enabledSongs} enabled</small>
        </article>
        <article>
          <span>Challenges</span>
          <strong>{songs.flatMap((song) => song.challenges).length}</strong>
          <small>{enabledChallenges} enabled</small>
        </article>
        <article>
          <span>Categories</span>
          <strong>{categories.length}</strong>
          <small>{categories.filter((category) => category.enabled).length} enabled</small>
        </article>
        <article>
          <span>Validation</span>
          <strong>{issues.length}</strong>
          <small>{issues.filter((issue) => issue.severity === 'ERROR').length} errors</small>
        </article>
      </div>
      <div className={styles.panel}>
        <h3>Recent edits</h3>
        {recent.length === 0 ? (
          <p>No authored songs yet.</p>
        ) : (
          <ul className={styles.simpleList}>
            {recent.map((song) => (
              <li key={song.id}>
                <strong>{song.title}</strong>
                <span>{new Date(song.updatedAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

interface SongLibraryProps {
  onEdit: (song: Song) => void;
  onNew: () => void;
  fakeMedia: boolean;
}

function SongLibrary({ onEdit, onNew }: SongLibraryProps) {
  const { songs, categories, toggleSong, deleteSong } = useAdminStore();
  const [search, setSearch] = useState('');
  const [enabledFilter, setEnabledFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [difficultyFilter, setDifficultyFilter] = useState('ALL');
  const [sort, setSort] = useState('TITLE');
  const [deleteId, setDeleteId] = useState<string | undefined>();

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return songs
      .filter(
        (song) =>
          !query ||
          song.title.toLocaleLowerCase().includes(query) ||
          song.artist.toLocaleLowerCase().includes(query),
      )
      .filter((song) => enabledFilter === 'ALL' || song.enabled === (enabledFilter === 'ENABLED'))
      .filter((song) => categoryFilter === 'ALL' || song.categoryIds.includes(categoryFilter))
      .filter(
        (song) =>
          difficultyFilter === 'ALL' ||
          song.challenges.some(
            (challenge) => challenge.difficulty === Number(difficultyFilter) && challenge.enabled,
          ),
      )
      .sort((left, right) =>
        sort === 'RECENT'
          ? right.updatedAt.localeCompare(left.updatedAt)
          : left.title.localeCompare(right.title),
      );
  }, [categoryFilter, difficultyFilter, enabledFilter, search, songs, sort]);

  const resetKey = [search, enabledFilter, categoryFilter, difficultyFilter, sort].join('|');
  const { visibleItems, hasMore, loadMore, sentinelRef } = useContinuousList(filtered, resetKey);

  return (
    <section className={styles.view}>
      <header className={styles.viewHeader}>
        <div>
          <p className={styles.eyebrow}>Song library</p>
          <h2>Find and maintain every track.</h2>
        </div>
        <button className={styles.primaryButton} onClick={onNew} type="button">
          Add song
        </button>
      </header>
      <div className={styles.filterBar}>
        <label>
          Search
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Title or artist"
            type="search"
            value={search}
          />
        </label>
        <label>
          Status
          <select onChange={(event) => setEnabledFilter(event.target.value)} value={enabledFilter}>
            <option value="ALL">All</option>
            <option value="ENABLED">Enabled</option>
            <option value="DISABLED">Disabled</option>
          </select>
        </label>
        <label>
          Category
          <select
            onChange={(event) => setCategoryFilter(event.target.value)}
            value={categoryFilter}
          >
            <option value="ALL">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Level
          <select
            onChange={(event) => setDifficultyFilter(event.target.value)}
            value={difficultyFilter}
          >
            <option value="ALL">All levels</option>
            {[1, 2, 3, 4, 5].map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                Level {difficulty}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select onChange={(event) => setSort(event.target.value)} value={sort}>
            <option value="TITLE">Title</option>
            <option value="RECENT">Recently edited</option>
          </select>
        </label>
      </div>
      <p className={styles.resultCount}>
        Showing {visibleItems.length} of {filtered.length} matching songs
      </p>
      <div className={styles.songList}>
        {visibleItems.map((song) => (
          <article key={song.id}>
            <div className={styles.songIdentity}>
              <span className={song.enabled ? styles.enabledDot : styles.disabledDot} />
              <div>
                <strong>{song.title}</strong>
                <span>{song.artist}</span>
              </div>
            </div>
            <div className={styles.songMeta}>
              <span>{song.challenges.length} challenges</span>
              <span>
                {song.categoryIds
                  .map(
                    (categoryId) =>
                      categories.find((category) => category.id === categoryId)?.name ?? categoryId,
                  )
                  .join(' · ') || 'Uncategorized'}
              </span>
            </div>
            <div className={styles.rowActions}>
              <button onClick={() => onEdit(song)} type="button">
                Edit
              </button>
              <button onClick={() => onEdit(song)} type="button">
                Preview
              </button>
              <button
                onClick={() =>
                  onEdit(
                    duplicateSong(
                      song,
                      nextId('song'),
                      song.challenges.map(() => nextId('challenge')),
                      new Date().toISOString(),
                    ),
                  )
                }
                type="button"
              >
                Duplicate
              </button>
              <button onClick={() => void toggleSong(song.id)} type="button">
                {song.enabled ? 'Disable' : 'Enable'}
              </button>
              <button
                className={styles.dangerButton}
                onClick={() => {
                  if (deleteId === song.id) {
                    void deleteSong(song.id);
                    setDeleteId(undefined);
                  } else {
                    setDeleteId(song.id);
                  }
                }}
                type="button"
              >
                {deleteId === song.id ? 'Confirm delete' : 'Delete'}
              </button>
            </div>
          </article>
        ))}
      </div>
      <div className={styles.scrollSentinel} ref={sentinelRef}>
        {hasMore ? (
          <button onClick={loadMore} type="button">
            Load more songs
          </button>
        ) : (
          <span>End of song library</span>
        )}
      </div>
    </section>
  );
}

function CategoriesView() {
  const categories = useAdminStore((state) => state.categories);
  return (
    <section className={styles.view}>
      <header className={styles.viewHeader}>
        <p className={styles.eyebrow}>Categories</p>
        <h2>Round taxonomy</h2>
      </header>
      <div className={styles.categoryGrid}>
        {categories.map((category) => (
          <article key={category.id}>
            <strong>{category.name}</strong>
            <span>{category.enabled ? 'Enabled' : 'Disabled'}</span>
            <small>{category.description}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function CoverageView() {
  const { categories, songs } = useAdminStore();
  const coverage = analyzeCatalogCoverage(
    buildCatalogIndex(createCatalogSnapshot(categories, songs)),
  );
  return (
    <section className={styles.view}>
      <header className={styles.viewHeader}>
        <div>
          <p className={styles.eyebrow}>Coverage</p>
          <h2>Category and level readiness</h2>
        </div>
        <strong>{coverage.readyCategoryCount}/10 ready</strong>
      </header>
      <div className={styles.coverageGrid}>
        <div className={styles.coverageHeader}>Category</div>
        {[1, 2, 3, 4, 5].map((difficulty) => (
          <div className={styles.coverageHeader} key={difficulty}>
            L{difficulty}
          </div>
        ))}
        {coverage.categories.map((category) => (
          <div className={styles.coverageRow} key={category.categoryId}>
            <strong>{category.categoryName}</strong>
            {([1, 2, 3, 4, 5] as DifficultyLevel[]).map((difficulty) => (
              <span
                className={
                  category.byDifficulty[difficulty].hasMinimum
                    ? styles.coverageGood
                    : styles.coverageGap
                }
                key={difficulty}
              >
                {category.byDifficulty[difficulty].challengeCount}
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function ValidationView() {
  const issues = useAdminStore((state) => state.issues);
  return (
    <section className={styles.view}>
      <header className={styles.viewHeader}>
        <p className={styles.eyebrow}>Validation</p>
        <h2>Actionable catalog findings</h2>
      </header>
      {issues.length === 0 ? (
        <div className={styles.successCard}>No catalog validation issues.</div>
      ) : (
        <div className={styles.validationList}>
          {issues.map((issue, index) => (
            <article key={`${issue.code}-${issue.source}-${index}`}>
              <span>{issue.severity}</span>
              <div>
                <strong>{issue.code}</strong>
                <p>{issue.message}</p>
                <small>{[issue.source, issue.path].filter(Boolean).join(' · ')}</small>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ImportExportView() {
  const { exportCatalog, importSongs } = useAdminStore();
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'MERGE' | 'REPLACE'>('MERGE');
  const [message, setMessage] = useState<string | undefined>();

  const exportAll = async () => {
    const data = await exportCatalog();
    if (data) downloadJson('lyric-lockout-catalog.json', data);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const parsed = JSON.parse(text) as unknown;
      const songs =
        typeof parsed === 'object' && parsed !== null && 'songs' in parsed ? parsed.songs : parsed;
      const imported = await importSongs(songs, mode);
      setMessage(imported ? 'Import complete.' : 'Import failed; draft JSON was retained.');
    } catch {
      setMessage('Import JSON could not be parsed.');
    }
  };

  return (
    <section className={styles.view}>
      <header className={styles.viewHeader}>
        <p className={styles.eyebrow}>Import / Export</p>
        <h2>Portable JSON backups</h2>
      </header>
      <div className={styles.importLayout}>
        <div className={styles.panel}>
          <h3>Export</h3>
          <p>Download the current categories, songs, validation report, and metadata.</p>
          <button className={styles.primaryButton} onClick={() => void exportAll()} type="button">
            Export full catalog
          </button>
        </div>
        <form className={styles.panel} onSubmit={(event) => void submit(event)}>
          <h3>Import songs</h3>
          <label>
            Mode
            <select
              onChange={(event) => setMode(event.target.value as 'MERGE' | 'REPLACE')}
              value={mode}
            >
              <option value="MERGE">Merge by song ID</option>
              <option value="REPLACE">Replace song catalog</option>
            </select>
          </label>
          <label>
            JSON
            <textarea
              onChange={(event) => setText(event.target.value)}
              placeholder='{"songs": [...]}'
              rows={12}
              value={text}
            />
          </label>
          <button className={styles.primaryButton} type="submit">
            Validate and import
          </button>
          {message && <p role="status">{message}</p>}
        </form>
      </div>
    </section>
  );
}

export function AdminPage() {
  const location = useLocation();
  const fakeMedia = new URLSearchParams(location.search).get('media') === 'fake';
  const { status, categories, error, lastBackupPath, initialize, reload, saveSong, clearError } =
    useAdminStore();
  const [view, setView] = useState<AdminView>('DASHBOARD');
  const [editorSong, setEditorSong] = useState<Song | undefined>();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const createNew = () => {
    setEditorSong(
      createSongDraft({
        id: nextId('song'),
        title: '',
        artist: '',
        youtubeVideoId: '',
        createdAt: new Date().toISOString(),
      }),
    );
  };

  const saveEditorSong = async (song: Song) => {
    const saved = await saveSong(song);
    if (saved) {
      setEditorSong(useAdminStore.getState().songs.find((candidate) => candidate.id === song.id));
    }
    return saved;
  };

  return (
    <section className={styles.adminPage}>
      <header className={styles.adminHeader}>
        <div>
          <p className={styles.eyebrow}>Local Admin</p>
          <h1>Your song library, backstage.</h1>
        </div>
        <div className={styles.serverStatus}>
          <span className={status === 'READY' ? styles.online : styles.offline} />
          {status === 'READY' ? 'Admin API connected' : 'Admin API offline'}
        </div>
      </header>

      <div className={styles.adminShell}>
        <aside className={styles.adminNav}>
          {Object.entries(VIEW_LABELS).map(([value, label]) => (
            <button
              className={view === value ? styles.activeNav : undefined}
              key={value}
              onClick={() => {
                setView(value as AdminView);
                setEditorSong(undefined);
              }}
              type="button"
            >
              {label}
            </button>
          ))}
          <Link to="/plans">Game Plans</Link>
          <Link to="/settings">Settings</Link>
          <Link to="/game">Back to Game</Link>
        </aside>

        <main className={styles.adminContent}>
          {status === 'LOADING' && <p>Connecting to the local Admin API…</p>}
          {status === 'OFFLINE' && (
            <div className={styles.offlinePanel}>
              <h2>Admin authoring is offline.</h2>
              <p>
                Start <code>npm run admin</code> in another terminal. Game Mode remains fully usable
                without this service.
              </p>
              <button onClick={() => void reload()} type="button">
                Retry connection
              </button>
            </div>
          )}
          {error && (
            <div className={styles.errorBanner} role="alert">
              <span>{error} Your unsaved editor draft was retained.</span>
              <button onClick={clearError} type="button">
                Dismiss
              </button>
            </div>
          )}
          {lastBackupPath && (
            <p className={styles.backupNotice} role="status">
              Destructive change backed up to {lastBackupPath}.
            </p>
          )}
          {status === 'READY' && editorSong && (
            <SongEditor
              categories={categories}
              fakeMedia={fakeMedia}
              initialSong={editorSong}
              nextId={nextId}
              onClose={() => setEditorSong(undefined)}
              onSave={saveEditorSong}
            />
          )}
          {status === 'READY' && !editorSong && view === 'DASHBOARD' && <Dashboard />}
          {status === 'READY' && !editorSong && view === 'SONGS' && (
            <SongLibrary fakeMedia={fakeMedia} onEdit={setEditorSong} onNew={createNew} />
          )}
          {status === 'READY' && !editorSong && view === 'CATEGORIES' && <CategoriesView />}
          {status === 'READY' && !editorSong && view === 'COVERAGE' && <CoverageView />}
          {status === 'READY' && !editorSong && view === 'VALIDATION' && <ValidationView />}
          {status === 'READY' && !editorSong && view === 'IMPORT_EXPORT' && <ImportExportView />}
        </main>
      </div>
    </section>
  );
}

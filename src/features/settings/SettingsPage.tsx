import { Link } from 'react-router-dom';

import { DEFAULT_GAME_CONFIG, DIFFICULTY_CONFIG } from '../../domain/constants';
import { DIFFICULTY_LEVELS } from '../../domain/enums';
import { useGameplayStore } from '../../store/gameplayStore';
import { useSettingsStore } from '../../store/settingsStore';
import styles from './SettingsPage.module.css';

function PreferenceSwitch({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      aria-checked={checked}
      className={styles.preferenceSwitch}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <i aria-hidden="true">
        <span />
      </i>
    </button>
  );
}

export function SettingsPage() {
  const {
    theme,
    audioEnabled,
    suspenseVolume,
    effectsVolume,
    reduceMotion,
    setTheme,
    setAudioEnabled,
    setSuspenseVolume,
    setEffectsVolume,
    setReduceMotion,
    resetSettings,
  } = useSettingsStore();
  const activeSession = useGameplayStore((state) => state.session ?? state.savedSession);
  const completedGameCount = useGameplayStore((state) => state.completedSummaries.length);

  return (
    <section className={styles.settingsPage}>
      <header className={styles.settingsHeader}>
        <div>
          <p className={styles.eyebrow}>Settings</p>
          <h1>Tune the room your way.</h1>
          <p>
            Display and sound preferences apply immediately and stay on this device. Game rules
            remain attached to each saved plan.
          </p>
        </div>
        <div className={styles.settingsStatus} aria-label="Preference summary">
          <span>
            <i aria-hidden="true">●</i>
            Saved locally
          </span>
          <strong>{theme === 'DAY_PARTY' ? 'Day Party' : 'Game Night'}</strong>
          <small>
            {audioEnabled ? 'Audio on' : 'Audio muted'} · Motion{' '}
            {reduceMotion ? 'reduced' : 'system'}
          </small>
        </div>
      </header>

      <div className={styles.settingsLayout}>
        <main className={styles.settingsMain}>
          <section className={styles.settingsPanel} aria-labelledby="appearance-settings">
            <header>
              <span aria-hidden="true">◐</span>
              <div>
                <h2 id="appearance-settings">Appearance</h2>
                <p>Choose the palette and motion level that suits the room.</p>
              </div>
            </header>

            <div className={styles.themeOptions} aria-label="Theme">
              <button
                aria-pressed={theme === 'DAY_PARTY'}
                className={theme === 'DAY_PARTY' ? styles.selectedTheme : undefined}
                onClick={() => setTheme('DAY_PARTY')}
                type="button"
              >
                <span className={styles.dayPartyPreview} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <strong>Day Party</strong>
                <small>Purple, pink, and gold energy</small>
                <b>{theme === 'DAY_PARTY' ? 'Active' : 'Select'}</b>
              </button>
              <button
                aria-pressed={theme === 'GAME_NIGHT'}
                className={theme === 'GAME_NIGHT' ? styles.selectedTheme : undefined}
                onClick={() => setTheme('GAME_NIGHT')}
                type="button"
              >
                <span className={styles.gameNightPreview} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <strong>Game Night</strong>
                <small>Deep blue and cyan focus</small>
                <b>{theme === 'GAME_NIGHT' ? 'Active' : 'Select'}</b>
              </button>
            </div>

            <PreferenceSwitch
              checked={reduceMotion}
              description="Minimize flips, score transitions, and decorative animation."
              label="Reduce motion"
              onChange={setReduceMotion}
            />
          </section>

          <section className={styles.settingsPanel} aria-labelledby="audio-settings">
            <header>
              <span aria-hidden="true">♫</span>
              <div>
                <h2 id="audio-settings">Game audio</h2>
                <p>Control suspense and result sounds independently from YouTube playback.</p>
              </div>
            </header>

            <PreferenceSwitch
              checked={audioEnabled}
              description="Mute Lyric Lockout sounds without muting the embedded video."
              label="Game sounds"
              onChange={setAudioEnabled}
            />

            <div className={styles.volumeControls}>
              <label>
                <span>
                  <strong>Suspense</strong>
                  <output htmlFor="suspense-volume">{Math.round(suspenseVolume * 100)}%</output>
                </span>
                <input
                  aria-label="Suspense volume"
                  disabled={!audioEnabled}
                  id="suspense-volume"
                  max="100"
                  min="0"
                  onChange={(event) => setSuspenseVolume(Number(event.target.value) / 100)}
                  type="range"
                  value={Math.round(suspenseVolume * 100)}
                />
              </label>
              <label>
                <span>
                  <strong>Result effects</strong>
                  <output htmlFor="effects-volume">{Math.round(effectsVolume * 100)}%</output>
                </span>
                <input
                  aria-label="Result effects volume"
                  disabled={!audioEnabled}
                  id="effects-volume"
                  max="100"
                  min="0"
                  onChange={(event) => setEffectsVolume(Number(event.target.value) / 100)}
                  type="range"
                  value={Math.round(effectsVolume * 100)}
                />
              </label>
            </div>

            <div className={styles.mediaNote}>
              <span aria-hidden="true">▶</span>
              <div>
                <strong>YouTube playback stays separate</strong>
                <p>
                  Video volume uses the embedded player controls. Native controls remain available
                  if the browser blocks host-started playback.
                </p>
              </div>
            </div>
          </section>

          <section className={styles.settingsPanel} aria-labelledby="game-defaults">
            <header>
              <span aria-hidden="true">◆</span>
              <div>
                <h2 id="game-defaults">Game defaults</h2>
                <p>Reference values used when a new plan starts from the standard rules.</p>
              </div>
              <Link to="/plans">Manage plans</Link>
            </header>

            <div className={styles.levelDefaults} aria-label="Default level rules">
              {DIFFICULTY_LEVELS.map((difficulty) => (
                <article key={difficulty}>
                  <span>Level {difficulty}</span>
                  <strong>{DIFFICULTY_CONFIG[difficulty].fullPoints}</strong>
                  <small>{DIFFICULTY_CONFIG[difficulty].answerSeconds}s answer</small>
                </article>
              ))}
            </div>

            <dl className={styles.ruleDefaults}>
              <div>
                <dt>Free lifelines</dt>
                <dd>
                  {DEFAULT_GAME_CONFIG.freeHintUsesPerTeam} Hint ·{' '}
                  {DEFAULT_GAME_CONFIG.freeTeamHuddleUsesPerTeam} Huddle
                </dd>
              </div>
              <div>
                <dt>Additional use</dt>
                <dd>−{DEFAULT_GAME_CONFIG.additionalLifelinePenaltyPoints} points</dd>
              </div>
              <div>
                <dt>Steal timer</dt>
                <dd>{DEFAULT_GAME_CONFIG.stealTimerSeconds} seconds</dd>
              </div>
            </dl>
          </section>
        </main>

        <aside className={styles.settingsSidebar} aria-label="Device and data status">
          <section>
            <header>
              <span aria-hidden="true">▣</span>
              <h2>Device &amp; data</h2>
            </header>
            <dl>
              <div>
                <dt>Active game</dt>
                <dd>
                  {activeSession
                    ? activeSession.teams.map((team) => team.name).join(' vs ')
                    : 'None'}
                </dd>
              </div>
              <div>
                <dt>Completed games</dt>
                <dd>{completedGameCount}</dd>
              </div>
              <div>
                <dt>Storage</dt>
                <dd>Local browser</dd>
              </div>
            </dl>
            <p>Gameplay and preferences stay on this device unless you export or back them up.</p>
          </section>

          <section className={styles.settingsReset}>
            <header>
              <span aria-hidden="true">↺</span>
              <h2>Preference reset</h2>
            </header>
            <p>Restore Day Party, system motion, and the standard audio levels.</p>
            <button onClick={resetSettings} type="button">
              Restore defaults
            </button>
            <small>This does not delete games, plans, or catalog data.</small>
          </section>
        </aside>
      </div>
    </section>
  );
}

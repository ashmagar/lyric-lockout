import { useEffect, useRef, useState } from 'react';

import {
  BrowserPollingScheduler,
  ChallengePlaybackCoordinator,
  YouTubeVideoPlayerService,
  type PlaybackChallengeConfig,
  type PlaybackSnapshot,
  type PollingScheduler,
  type VideoPlayerService,
} from '../../services/video';
import styles from './PlaybackSpikePage.module.css';

const PLAYBACK_SPIKE_CHALLENGE: PlaybackChallengeConfig = {
  videoId: 'M7lc1UVf-VE',
  playbackStartSeconds: 5,
  pauseAtSeconds: 10,
  verifyFromSeconds: 7,
  verifyToSeconds: 12,
};

const INITIAL_SNAPSHOT: PlaybackSnapshot = {
  status: 'IDLE',
  playerState: 'UNINITIALIZED',
  currentTimeSeconds: 0,
  durationSeconds: 0,
};

const DEFAULT_SCHEDULER = new BrowserPollingScheduler();
const createDefaultPlayer = () => new YouTubeVideoPlayerService();

export interface PlaybackSpikePageProps {
  createPlayer?: (() => VideoPlayerService) | undefined;
  scheduler?: PollingScheduler | undefined;
  challenge?: PlaybackChallengeConfig | undefined;
}

function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(2)}s`;
}

export function PlaybackSpikePage({
  createPlayer = createDefaultPlayer,
  scheduler = DEFAULT_SCHEDULER,
  challenge = PLAYBACK_SPIKE_CHALLENGE,
}: PlaybackSpikePageProps) {
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const coordinatorRef = useRef<ChallengePlaybackCoordinator>(null);
  const [snapshot, setSnapshot] = useState<PlaybackSnapshot>(INITIAL_SNAPSHOT);

  useEffect(() => {
    const container = playerContainerRef.current;
    if (!container) return;

    const coordinator = new ChallengePlaybackCoordinator(createPlayer(), scheduler);
    coordinatorRef.current = coordinator;
    const unsubscribe = coordinator.subscribe(setSnapshot);
    void coordinator.initialize(container, challenge);

    return () => {
      unsubscribe();
      coordinator.dispose();
      coordinatorRef.current = null;
    };
  }, [challenge, createPlayer, scheduler]);

  const isInitializing = snapshot.status === 'IDLE' || snapshot.status === 'INITIALIZING';
  const canPlayChallenge = !isInitializing && snapshot.status !== 'ERROR';
  const canVerify =
    snapshot.status === 'PAUSED_AT_CHALLENGE' || snapshot.status === 'VERIFICATION_COMPLETE';

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Milestone 6 technical spike</p>
        <h1>YouTube pause-point rehearsal</h1>
        <p>
          This isolated screen validates player loading, host-started playback, automatic pausing,
          and verification replay. It does not modify a real game.
        </p>
      </header>

      <div className={styles.layout}>
        <div className={styles.playerCard}>
          <div
            aria-label="YouTube technical spike player"
            className={styles.player}
            ref={playerContainerRef}
          />
          <div className={styles.controls}>
            <button
              disabled={!canPlayChallenge}
              onClick={() => coordinatorRef.current?.playChallenge()}
              type="button"
            >
              Play challenge
            </button>
            <button
              disabled={!canVerify}
              onClick={() => coordinatorRef.current?.playVerification()}
              type="button"
            >
              Replay verification
            </button>
            <button
              disabled={snapshot.status !== 'PLAYING_VERIFICATION'}
              onClick={() => coordinatorRef.current?.pauseVerification()}
              type="button"
            >
              End verification
            </button>
            <button
              disabled={!canPlayChallenge}
              onClick={() => coordinatorRef.current?.restart()}
              type="button"
            >
              Restart challenge
            </button>
            <button
              disabled={snapshot.status !== 'ERROR'}
              onClick={() => void coordinatorRef.current?.retry()}
              type="button"
            >
              Retry load
            </button>
          </div>
        </div>

        <aside className={styles.diagnostics}>
          <h2>Playback diagnostics</h2>
          <dl>
            <div>
              <dt>Coordinator</dt>
              <dd aria-live="polite">{snapshot.status}</dd>
            </div>
            <div>
              <dt>Player</dt>
              <dd>{snapshot.playerState}</dd>
            </div>
            <div>
              <dt>Current time</dt>
              <dd>{formatSeconds(snapshot.currentTimeSeconds)}</dd>
            </div>
            <div>
              <dt>Actual pause</dt>
              <dd>
                {snapshot.actualPauseTimeSeconds === undefined
                  ? 'Not recorded'
                  : formatSeconds(snapshot.actualPauseTimeSeconds)}
              </dd>
            </div>
          </dl>

          <h2>Configured timestamps</h2>
          <dl>
            <div>
              <dt>Playback start</dt>
              <dd>{formatSeconds(challenge.playbackStartSeconds)}</dd>
            </div>
            <div>
              <dt>Challenge pause</dt>
              <dd>{formatSeconds(challenge.pauseAtSeconds)}</dd>
            </div>
            <div>
              <dt>Verification</dt>
              <dd>
                {formatSeconds(challenge.verifyFromSeconds)}–
                {challenge.verifyToSeconds === undefined
                  ? 'manual stop'
                  : formatSeconds(challenge.verifyToSeconds)}
              </dd>
            </div>
          </dl>

          {snapshot.error ? (
            <div className={styles.error} role="alert">
              <strong>{snapshot.error.code}</strong>
              <span>{snapshot.error.message}</span>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

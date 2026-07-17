import { useEffect, useRef, useState } from 'react';

import type { Challenge, Song } from '../../domain';
import {
  BrowserPollingScheduler,
  ChallengePlaybackCoordinator,
  FakeVideoPlayerService,
  YouTubeVideoPlayerService,
  type PlaybackSnapshot,
  type PollingScheduler,
  type VideoPlayerService,
} from '../../services/video';
import styles from './AdminPage.module.css';

const INITIAL_SNAPSHOT: PlaybackSnapshot = {
  status: 'IDLE',
  playerState: 'UNINITIALIZED',
  currentTimeSeconds: 0,
  durationSeconds: 0,
};
const DEFAULT_SCHEDULER = new BrowserPollingScheduler();

interface AdminChallengePreviewProps {
  song: Song;
  challenge: Challenge;
  fakeMedia?: boolean | undefined;
  createPlayer?: (() => VideoPlayerService) | undefined;
  scheduler?: PollingScheduler | undefined;
  onCurrentTime?: ((seconds: number) => void) | undefined;
}

export function AdminChallengePreview({
  song,
  challenge,
  fakeMedia = false,
  createPlayer,
  scheduler = DEFAULT_SCHEDULER,
  onCurrentTime,
}: AdminChallengePreviewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const coordinatorRef = useRef<ChallengePlaybackCoordinator | undefined>(undefined);
  const fakePlayerRef = useRef<FakeVideoPlayerService | undefined>(undefined);
  const [snapshot, setSnapshot] = useState(INITIAL_SNAPSHOT);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const player =
      createPlayer?.() ??
      (fakeMedia ? new FakeVideoPlayerService() : new YouTubeVideoPlayerService());
    fakePlayerRef.current = player instanceof FakeVideoPlayerService ? player : undefined;
    const coordinator = new ChallengePlaybackCoordinator(player, scheduler);
    coordinatorRef.current = coordinator;
    const unsubscribe = coordinator.subscribe((next) => {
      setSnapshot(next);
      onCurrentTime?.(next.currentTimeSeconds);
    });
    void coordinator.initialize(mount, {
      videoId: song.youtubeVideoId,
      playbackStartSeconds: challenge.playbackStartSeconds,
      pauseAtSeconds: challenge.pauseAtSeconds,
      verifyFromSeconds: challenge.verifyFromSeconds,
      verifyToSeconds: challenge.verifyToSeconds,
    });
    return () => {
      unsubscribe();
      coordinator.dispose();
      coordinatorRef.current = undefined;
      fakePlayerRef.current = undefined;
    };
  }, [challenge, createPlayer, fakeMedia, onCurrentTime, scheduler, song.youtubeVideoId]);

  const deviation =
    snapshot.actualPauseTimeSeconds === undefined
      ? undefined
      : snapshot.actualPauseTimeSeconds - challenge.pauseAtSeconds;

  return (
    <section className={styles.previewPanel} aria-label="Challenge preview">
      <div className={styles.previewFrame} ref={mountRef}>
        {fakeMedia && <span>Deterministic preview player</span>}
      </div>
      <div className={styles.previewControls}>
        <button onClick={() => coordinatorRef.current?.playChallenge()} type="button">
          Play challenge preview
        </button>
        <button onClick={() => coordinatorRef.current?.playVerification()} type="button">
          Play verification preview
        </button>
        <button onClick={() => coordinatorRef.current?.pauseVerification()} type="button">
          End verification preview
        </button>
        <button onClick={() => coordinatorRef.current?.restart()} type="button">
          Restart preview
        </button>
        {fakeMedia && (
          <button
            onClick={() => fakePlayerRef.current?.setCurrentTime(challenge.pauseAtSeconds)}
            type="button"
          >
            Simulate pause point
          </button>
        )}
      </div>
      <dl className={styles.previewDiagnostics}>
        <div>
          <dt>Lifecycle</dt>
          <dd>{snapshot.status}</dd>
        </div>
        <div>
          <dt>Current</dt>
          <dd>{snapshot.currentTimeSeconds.toFixed(2)}s</dd>
        </div>
        <div>
          <dt>Actual pause</dt>
          <dd>
            {snapshot.actualPauseTimeSeconds === undefined
              ? 'Not recorded'
              : `${snapshot.actualPauseTimeSeconds.toFixed(2)}s`}
          </dd>
        </div>
        <div>
          <dt>Deviation</dt>
          <dd>{deviation === undefined ? 'Not recorded' : `${deviation.toFixed(2)}s`}</dd>
        </div>
      </dl>
      {snapshot.error && (
        <p className={styles.errorCard} role="alert">
          {snapshot.error.message}
        </p>
      )}
    </section>
  );
}

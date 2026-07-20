import { useEffect, useRef, useState } from 'react';

import type { GameSession } from '../../domain/models/game';
import {
  BrowserPollingScheduler,
  ChallengePlaybackCoordinator,
  type PlaybackSnapshot,
  YouTubeVideoPlayerService,
} from '../../services/video';
import styles from './GamePage.module.css';

interface GameplayVideoStageProps {
  session: GameSession;
  fakeMedia: boolean;
  onReady: () => void;
  onPlay: () => boolean;
  onPaused: () => void;
  onCompleteVerification: () => void;
}

export function GameplayVideoStage({
  session,
  fakeMedia,
  onReady,
  onPlay,
  onPaused,
  onCompleteVerification,
}: GameplayVideoStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const coordinatorRef = useRef<ChallengePlaybackCoordinator | undefined>(undefined);
  const readySentRef = useRef(false);
  const playSentRef = useRef(false);
  const pauseSentRef = useRef(false);
  const phaseRef = useRef(session.phase);
  phaseRef.current = session.phase;
  const [snapshot, setSnapshot] = useState<PlaybackSnapshot | undefined>();
  const [verificationStarted, setVerificationStarted] = useState(false);
  const activeChallenge = session.activeChallenge;
  const verification = session.phase === 'CHALLENGE_VERIFICATION';
  const revealSong = session.gameConfig.revealSongBeforePlayback || verification;

  useEffect(() => {
    readySentRef.current = false;
    playSentRef.current = false;
    pauseSentRef.current = false;
    setVerificationStarted(false);

    if (!activeChallenge) return;
    const shouldReportReady = phaseRef.current === 'VIDEO_LOADING';
    if (fakeMedia) {
      if (shouldReportReady) {
        readySentRef.current = true;
        onReady();
      }
      return;
    }

    const container = containerRef.current;
    if (!container) return;
    const coordinator = new ChallengePlaybackCoordinator(
      new YouTubeVideoPlayerService(),
      new BrowserPollingScheduler(),
    );
    coordinatorRef.current = coordinator;
    const unsubscribe = coordinator.subscribe((nextSnapshot) => {
      setSnapshot(nextSnapshot);
      if (shouldReportReady && nextSnapshot.status === 'READY' && !readySentRef.current) {
        readySentRef.current = true;
        onReady();
      }
      if (
        !verification &&
        nextSnapshot.status === 'PLAYING_CHALLENGE' &&
        nextSnapshot.playerState === 'PLAYING' &&
        !playSentRef.current
      ) {
        playSentRef.current = true;
        if (!onPlay()) coordinator.pauseChallengePreview();
      }
      if (!verification && nextSnapshot.status === 'PAUSED_AT_CHALLENGE' && !pauseSentRef.current) {
        pauseSentRef.current = true;
        onPaused();
      }
    });
    void coordinator.initialize(container, {
      videoId: activeChallenge.song.youtubeVideoId,
      playbackStartSeconds: activeChallenge.challenge.playbackStartSeconds,
      pauseAtSeconds: activeChallenge.challenge.pauseAtSeconds,
      verifyFromSeconds: activeChallenge.challenge.verifyFromSeconds,
      verifyToSeconds: activeChallenge.challenge.verifyToSeconds,
    });

    return () => {
      unsubscribe();
      coordinator.dispose();
      coordinatorRef.current = undefined;
    };
  }, [activeChallenge, fakeMedia, onPaused, onPlay, onReady, verification]);

  if (!activeChallenge) {
    return <p className={styles.notice}>The active challenge could not be loaded.</p>;
  }

  const playChallenge = () => {
    if (fakeMedia) {
      onPlay();
      return;
    }
    coordinatorRef.current?.playChallenge();
  };

  const playVerification = () => {
    coordinatorRef.current?.playVerification();
    setVerificationStarted(true);
  };

  const completeVerification = () => {
    coordinatorRef.current?.pauseVerification();
    onCompleteVerification();
  };

  return (
    <div className={styles.videoLayout}>
      <div className={styles.playbackViewport}>
        <div className={styles.videoFrame}>
          {fakeMedia ? (
            <div className={styles.fakeMedia} data-testid="fake-media-stage">
              <span aria-hidden="true">▶</span>
              <strong>Challenge media</strong>
              <small>Deterministic host controls are active.</small>
            </div>
          ) : (
            <div
              aria-label="Gameplay YouTube player"
              className={styles.youtubeMount}
              ref={containerRef}
            />
          )}
        </div>

        <div className={styles.mediaStatus}>
          <span>{fakeMedia ? 'FAKE' : (snapshot?.playerState ?? 'LOADING')}</span>
          <span>{revealSong ? activeChallenge.song.title : 'Mystery song'}</span>
        </div>
      </div>

      <aside className={styles.playbackControlPanel} aria-label="Host playback controls">
        <header>
          <span aria-hidden="true">▶</span>
          <div>
            <small>Game master</small>
            <h2>{verification ? 'Verification playback' : 'Playback controls'}</h2>
          </div>
        </header>
        {session.phase === 'VIDEO_LOADING' && (
          <p>Loading the challenge without autoplay. Playback begins only when the host starts it.</p>
        )}
        {session.phase === 'VIDEO_READY' && (
          <>
            <p>The clip is cued at the configured start time.</p>
            <button className={styles.primaryButton} onClick={playChallenge} type="button">
              Play challenge
            </button>
          </>
        )}
        {session.phase === 'VIDEO_PLAYING' && fakeMedia && (
          <>
            <p>Advance the fake player to the lyric lockout point.</p>
            <button className={styles.primaryButton} onClick={onPaused} type="button">
              Simulate challenge pause
            </button>
          </>
        )}
        {session.phase === 'VIDEO_PLAYING' && !fakeMedia && (
          <p>Playing from the configured timestamp. The video will pause automatically.</p>
        )}
        {verification && (
          <>
            <p>Replay the answer window if needed, then complete the reveal.</p>
            <div className={styles.challengeActionStack}>
              {!fakeMedia && (
                <button
                  className={styles.secondaryButton}
                  disabled={snapshot?.status !== 'READY' || verificationStarted}
                  onClick={playVerification}
                  type="button"
                >
                  Play verification
                </button>
              )}
              <button className={styles.primaryButton} onClick={completeVerification} type="button">
                Complete verification
              </button>
            </div>
          </>
        )}
        {snapshot?.error && (
          <div className={styles.notice} role="alert">
            <strong>Media needs attention.</strong> {snapshot.error.message}
            <button onClick={() => void coordinatorRef.current?.retry()} type="button">
              Retry media
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

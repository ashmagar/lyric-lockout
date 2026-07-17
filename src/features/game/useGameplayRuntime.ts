import { useEffect, useRef, useState } from 'react';

import type { GameSession } from '../../domain/models/game';
import type { DomainEvent } from '../../domain/stateMachine';
import {
  BrowserAudioService,
  FakeAudioService,
  type AudioService,
  type AudioServiceError,
} from '../../services/audio';
import {
  BrowserTimerService,
  FakeTimerService,
  type TimerService,
  type TimerSnapshot,
} from '../../services/timer';

const GAME_TONE =
  'data:audio/wav;base64,UklGRvQHAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YdAHAACAg4WIioyOj5CQkI+OjIuIhoOBfnt4dnRycXBwcHBxc3V3enx/goWHioyOj5CQkJCPjoyKh4SCf3x5d3RycXBvb3BwcnR2eHt+gYSHiYyOj5CRkZGQj42LiIaDgH16d3VzcXBvbm9vcXJ1d3p9gIOGiYuNj5GRkpKRkI6MioeEgX57eHVzcW9ubm5vcHFzdnh7f4KFiIuNj5GSkpKSkY+Ni4iFgn98eXZzcW9ubW1ub3BydHd6fYGEh4qNj5GSk5OTkpCPjIqHg4B9eXZ0cW9ubW1tbm9xc3Z5fH+DhomMj5GSk5SUk5KQjouIhYF+end0cnBubWxsbW5wcnR3e36ChYiLjpCSk5SUlJORj4yJhoN/fHh1cnBubGxrbG1ucXN2eX2AhIeLjZCSlJWVlZSSkI6Lh4SAfXl2c3BubGtra2xtb3J1eHt/g4aKjZCSlJWVlZWTkY+MiYWCfnp3dHFubGtqamtsbnBzdnp+gYWJjI+SlJWWlpWUk5COioeDf3x4dHFvbWtqamprbW9ydXh8gISIi46Rk5WWlpaVlJKPjIiFgX15dXJvbWtqaWlqbG5wc3d7f4OGio2Qk5WWl5eWlZOQjYqGgn56dnNwbWtqaWlpa21vcnV5fYGFiY2Qk5WWl5eXlpSSj4uIhIB8eHRxbmtqaWhpamtucXR4fICEiIuPkpSWl5iYl5WTkI2JhYF9eXVybmxqaWhoaWpsb3J2en6ChoqOkZSWl5iYmJaUko6Lh4N+enZzb2xqaWhnaGlrbnF0eH2BhYmNkJOWl5iZmJeVk5CMiISAfHh0cG1raWhnZ2hqbW9zd3t/hIiMj5OVl5mZmZiWlJGOioaCfXl1cW5raWhnZ2hpa25xdXl+goaKjpKVl5iZmZmXlZOPjIiDf3p2cm9saWhnZmdoam1wdHh8gIWJjZGUlpiZmpmYlpSRjYmFgHx4dHBtamhnZmZnaWtvcnZ6f4OIjJCTlpiZmpqZl5WSj4uGgn55dXFua2hnZmZnaGptcXR5fYKGio6SlZeZmpqamJaTkIyIhH97dnJva2lnZmZmZ2lsb3N3e4CFiY2RlJeZmpqamZeVko6KhYF8eHRwbGpnZmVmZ2hrbnF1en6Dh4yQk5aYmpubmpiWk4+Lh4N+eXVxbWpoZmVlZmdqbHB0eH2BhoqOkpWYmZubmpmXlJGNiYSAe3dyb2tpZ2ZlZmdpa29ydnuAhImNkZSXmZqbm5qYlZKOioaBfXh0cGxpZ2ZlZWZoam1xdXl+g4eLkJOWmJqbm5qZlpOQjIiDfnp1cW5qaGZlZWZnaWxvc3h8gYWKjpKVmJqbm5uZl5WRjYmFgHt3c29raWdlZWVmaGtucnZ7f4SIjZGUl5mam5uamJaSj4uGgn14dHBtamdmZWVmaGptcHV5fYKHi4+Tlpiam5uamZeUkIyIg396dnJua2hmZWVmZ2lsb3N3fICFio6RlZeZmpuamZeVkY6JhYB8d3NvbGlnZmVlZ2hrbnJ2en+DiIyQlJaZmpubmpiWk4+Lh4J9eXVxbWpoZmVlZmhqbXB0eX2ChouPkpWYmZqbmpmWlJCMiIR/e3ZybmtpZ2ZmZmdpbG9zd3uAhYmNkZSXmZqampmXlZGOioWBfHh0cG1qaGZmZmdpa25ydnp+g4eMj5OWmJmampmYlZKPi4eCfnp1cW5raWdmZmdoam1wdHh9gYaKjpGVl5mampmYlpOQjIiEgHt3c29samhnZmdoamxvc3d7gISIjJCTlpiZmpmYl5SRjoqGgX14dHFta2lnZ2doaWtucnZ6foKHi4+SlZeYmZmYl5WSj4uHg356dnJvbGpoZ2dnaWttcXR4fIGFiY2Rk5aYmZmYl5WTkIyIhIB8eHRwbWtpaGdoaWptcHN3e3+DiIyPkpWXmJmYl5aUkY2KhoJ9eXVybmxqaGhoaWpsb3J2en6ChoqOkZSWl5iYl5aUko6Lh4N/e3dzcG1raWhoaWpsbnF1eHyAhIiMj5KVlpeYl5aVko+MiISAfHh1cW5samlpaWprbXBzd3t/g4eLjpGTlZeXl5aVk5CNioaCfnp2c3Bta2ppaWprbXBzdnp9gYWJjZCSlJaXl5aVk5GOi4eDf3t4dHFubGtqamprbW9ydXh8gISIi46Rk5WWlpaVk5GPjIiEgX15dnJwbWxramprbG5xdHd7f4KGio2QkpSVlpaVlJKPjImGgn57d3Rxb21ra2trbG5wc3Z6fYGFiIuOkZOUlZWVlJKQjYqHg4B8eXVycG5sa2trbG5wc3V5fICDh4qNj5KTlJWUlJKQjouIhIF9end0cW9tbGxsbW5wcnV4e36ChYmMjpCSk5SUk5KQjoyJhoJ/e3h1cnBubWxsbW5vcXR3en2BhIeKjY+RkpOTk5KRj4yKh4OAfXl2dHFwbm1tbW5vcXN2eXx/g4aJjI6QkZKTk5KRj42Kh4SBfnt4dXNxb25ubm5vcXN1eHt+gYWIio2PkJGSkpKRj42LiIWCf3x5dnRycG9ubm9vcXN1d3p9gIOGiYuOj5GRkpGQj42LiYaDgH16eHVzcXBvb29wcXJ0d3l8f4KFiIqMjpCQkZGQj46MiYeEgX58eXZ0cnFwcHBwcXJ0dnl7foGEhomLjY+QkJCQj46MioiFgn99enh1dHJxcHBwcXJ0dnh7fQ==';

interface GameplayRuntime {
  timer: TimerService;
  audio: AudioService;
}

interface RuntimeResult {
  timerSnapshot: TimerSnapshot;
  audioError?: AudioServiceError | undefined;
}

function createRuntime(fakeMedia: boolean): GameplayRuntime {
  if (fakeMedia) {
    return { timer: new FakeTimerService(), audio: new FakeAudioService() };
  }
  const audio = new BrowserAudioService({
    suspense: { countdown: GAME_TONE },
    effects: { correct: GAME_TONE, wrong: GAME_TONE },
  });
  audio.setSuspenseVolume(0.3);
  audio.setEffectsVolume(0.55);
  return {
    timer: new BrowserTimerService(),
    audio,
  };
}

function activeAttemptDuration(session: GameSession): number {
  const attempt =
    session.phase === 'STEAL_ANSWERING'
      ? session.activeTurn?.stealAttempt
      : session.activeTurn?.primaryAttempt;
  return (attempt?.timer.configuredSeconds ?? 0) * 1000;
}

export function useGameplayRuntime(
  session: GameSession,
  events: readonly DomainEvent[],
  eventBatch: number,
  fakeMedia: boolean,
  onTimerExpired: () => void,
): RuntimeResult {
  const [runtime] = useState(() => createRuntime(fakeMedia));
  const [timerSnapshot, setTimerSnapshot] = useState(runtime.timer.getSnapshot());
  const [audioError, setAudioError] = useState<AudioServiceError | undefined>();
  const expiredHandlerRef = useRef(onTimerExpired);
  expiredHandlerRef.current = onTimerExpired;

  useEffect(() => {
    void runtime.audio.preload();
    const unsubscribeTimer = runtime.timer.subscribe((event) => {
      setTimerSnapshot(event.snapshot);
      if (event.type === 'EXPIRED') expiredHandlerRef.current();
    });
    const unsubscribeAudio = runtime.audio.subscribe((event) => {
      if (event.type === 'ERROR') setAudioError(event.error);
    });
    return () => {
      unsubscribeTimer();
      unsubscribeAudio();
      runtime.audio.dispose();
      runtime.timer.dispose();
    };
  }, [runtime]);

  useEffect(() => {
    const attempt =
      session.phase === 'STEAL_ANSWERING'
        ? session.activeTurn?.stealAttempt
        : session.activeTurn?.primaryAttempt;
    if (attempt?.timer.status !== 'PAUSED') return;

    runtime.timer.restorePaused({
      configuredMilliseconds: attempt.timer.configuredSeconds * 1000,
      remainingMilliseconds: attempt.timer.remainingMilliseconds,
    });
  }, [runtime, session]);

  useEffect(() => {
    events.forEach((event) => {
      if (event.type === 'SUSPENSE_START_REQUESTED') {
        void runtime.audio.playSuspense('countdown');
      } else if (event.type === 'SUSPENSE_STOP_REQUESTED') {
        runtime.audio.stopSuspense();
      } else if (event.type === 'TIMER_ACTION_REQUESTED') {
        switch (event.action) {
          case 'START':
            runtime.timer.start(activeAttemptDuration(session));
            break;
          case 'PAUSE':
            runtime.timer.pause();
            break;
          case 'RESUME':
            runtime.timer.resume();
            break;
          case 'RESTART':
            runtime.timer.restart();
            break;
          case 'ADJUST':
            runtime.timer.adjust(event.deltaMilliseconds ?? 0);
            break;
          case 'DISABLE':
            runtime.timer.disable();
            break;
          case 'END':
            runtime.timer.stop();
            runtime.audio.stopSuspense();
            break;
        }
      }
    });
  }, [eventBatch, events, runtime, session]);

  return { timerSnapshot, audioError };
}

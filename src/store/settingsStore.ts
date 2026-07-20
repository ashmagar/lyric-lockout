import { create } from 'zustand';

import { DEFAULT_THEME } from '../domain/constants';
import type { ThemeName } from '../domain/enums';

export { DEFAULT_THEME } from '../domain/constants';

export const SETTINGS_STORAGE_KEY = 'lyric-lockout.settings.v1';

interface SettingsState {
  theme: ThemeName;
  audioEnabled: boolean;
  suspenseVolume: number;
  effectsVolume: number;
  reduceMotion: boolean;
  setTheme: (theme: ThemeName) => void;
  setAudioEnabled: (enabled: boolean) => void;
  setSuspenseVolume: (volume: number) => void;
  setEffectsVolume: (volume: number) => void;
  setReduceMotion: (enabled: boolean) => void;
  resetSettings: () => void;
}

type PersistedSettings = Pick<
  SettingsState,
  'theme' | 'audioEnabled' | 'suspenseVolume' | 'effectsVolume' | 'reduceMotion'
>;

export const DEFAULT_SETTINGS: Readonly<PersistedSettings> = {
  theme: DEFAULT_THEME,
  audioEnabled: true,
  suspenseVolume: 0.3,
  effectsVolume: 0.55,
  reduceMotion: false,
};

function clampVolume(volume: number): number {
  return Math.min(1, Math.max(0, volume));
}

function writeSettings(settings: PersistedSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Preferences remain available in memory when local storage is unavailable.
  }
}

function readSettings(): PersistedSettings | undefined {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
    if (
      (parsed.theme !== 'DAY_PARTY' && parsed.theme !== 'GAME_NIGHT') ||
      typeof parsed.audioEnabled !== 'boolean' ||
      typeof parsed.suspenseVolume !== 'number' ||
      typeof parsed.effectsVolume !== 'number' ||
      typeof parsed.reduceMotion !== 'boolean'
    ) {
      return undefined;
    }
    return {
      theme: parsed.theme,
      audioEnabled: parsed.audioEnabled,
      suspenseVolume: clampVolume(parsed.suspenseVolume),
      effectsVolume: clampVolume(parsed.effectsVolume),
      reduceMotion: parsed.reduceMotion,
    };
  } catch {
    return undefined;
  }
}

function persistedSnapshot(state: SettingsState): PersistedSettings {
  return {
    theme: state.theme,
    audioEnabled: state.audioEnabled,
    suspenseVolume: state.suspenseVolume,
    effectsVolume: state.effectsVolume,
    reduceMotion: state.reduceMotion,
  };
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...DEFAULT_SETTINGS,
  setTheme(theme) {
    applyTheme(theme);
    set((state) => {
      const next = { ...persistedSnapshot(state), theme };
      writeSettings(next);
      return { theme };
    });
  },
  setAudioEnabled(audioEnabled) {
    set((state) => {
      const next = { ...persistedSnapshot(state), audioEnabled };
      writeSettings(next);
      return { audioEnabled };
    });
  },
  setSuspenseVolume(volume) {
    const suspenseVolume = clampVolume(volume);
    set((state) => {
      const next = { ...persistedSnapshot(state), suspenseVolume };
      writeSettings(next);
      return { suspenseVolume };
    });
  },
  setEffectsVolume(volume) {
    const effectsVolume = clampVolume(volume);
    set((state) => {
      const next = { ...persistedSnapshot(state), effectsVolume };
      writeSettings(next);
      return { effectsVolume };
    });
  },
  setReduceMotion(reduceMotion) {
    applyMotionPreference(reduceMotion);
    set((state) => {
      const next = { ...persistedSnapshot(state), reduceMotion };
      writeSettings(next);
      return { reduceMotion };
    });
  },
  resetSettings() {
    applyTheme(DEFAULT_SETTINGS.theme);
    applyMotionPreference(DEFAULT_SETTINGS.reduceMotion);
    writeSettings(DEFAULT_SETTINGS);
    set(DEFAULT_SETTINGS);
  },
}));

const THEME_DOM_TOKENS: Record<ThemeName, string> = {
  DAY_PARTY: 'day-party',
  GAME_NIGHT: 'game-night',
};

export function applyTheme(theme: ThemeName, root: HTMLElement = document.documentElement) {
  root.dataset.theme = THEME_DOM_TOKENS[theme];
}

export function applyMotionPreference(
  reduceMotion: boolean,
  root: HTMLElement = document.documentElement,
) {
  if (reduceMotion) {
    root.dataset.motion = 'reduced';
  } else {
    delete root.dataset.motion;
  }
}

export function bootstrapTheme(root: HTMLElement = document.documentElement) {
  const stored = readSettings();
  if (stored) useSettingsStore.setState(stored);
  const settings = useSettingsStore.getState();
  applyTheme(settings.theme, root);
  applyMotionPreference(settings.reduceMotion, root);
}

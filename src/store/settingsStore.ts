import { create } from 'zustand';

import { DEFAULT_THEME } from '../domain/constants';
import type { ThemeName } from '../domain/enums';

export { DEFAULT_THEME } from '../domain/constants';

interface SettingsState {
  theme: ThemeName;
}

export const useSettingsStore = create<SettingsState>(() => ({
  theme: DEFAULT_THEME,
}));

const THEME_DOM_TOKENS: Record<ThemeName, string> = {
  DAY_PARTY: 'day-party',
  GAME_NIGHT: 'game-night',
};

export function applyTheme(theme: ThemeName, root: HTMLElement = document.documentElement) {
  root.dataset.theme = THEME_DOM_TOKENS[theme];
}

export function bootstrapTheme(root: HTMLElement = document.documentElement) {
  applyTheme(useSettingsStore.getState().theme, root);
}

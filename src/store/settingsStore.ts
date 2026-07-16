import { create } from 'zustand';

export const DEFAULT_THEME = 'day-party' as const;

export type ThemeName = typeof DEFAULT_THEME;

interface SettingsState {
  theme: ThemeName;
}

export const useSettingsStore = create<SettingsState>(() => ({
  theme: DEFAULT_THEME,
}));

export function applyTheme(theme: ThemeName, root: HTMLElement = document.documentElement) {
  root.dataset.theme = theme;
}

export function bootstrapTheme(root: HTMLElement = document.documentElement) {
  applyTheme(useSettingsStore.getState().theme, root);
}

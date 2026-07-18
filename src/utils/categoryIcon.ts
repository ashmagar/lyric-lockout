const CATEGORY_ICON_GLYPHS: Readonly<Record<string, string>> = {
  cassette: '📼',
  heart: '💛',
  confetti: '🎉',
  microphone: '🎤',
  'rain-cloud': '🌧️',
  'disco-ball': '🪩',
  guitar: '🎸',
  castle: '🏰',
  'music-note': '🎵',
  'music-notes': '🎶',
};

export function resolveCategoryIcon(icon: string | undefined): string {
  const value = icon?.trim();
  if (!value) return '♪';
  return CATEGORY_ICON_GLYPHS[value] ?? value;
}

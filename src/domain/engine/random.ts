import { GameRuleError } from './errors';

export type RandomSource = () => number;

export function selectRandomItem<T>(items: readonly T[], random: RandomSource): T {
  if (items.length === 0) {
    throw new GameRuleError('NO_AVAILABLE_CATEGORY', 'No items are available for selection');
  }

  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new GameRuleError(
      'INVALID_RANDOM_VALUE',
      'Random source must return a finite value from 0 inclusive to 1 exclusive',
    );
  }

  const selected = items[Math.floor(value * items.length)];
  if (selected === undefined) {
    throw new GameRuleError('INVALID_RANDOM_VALUE', 'Random selection did not resolve an item');
  }

  return selected;
}

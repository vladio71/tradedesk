import { Decimal8 } from './decimal8';

const MIN_PRICE = Decimal8.positive('0.00000001');

/**
 * One step of a random walk. `random` is a number in [0, 1).
 * The price moves at most +/- maxMovePercent (default 0.5 percent) per step.
 */
export function nextPrice(current: Decimal8, random: number, maxMovePercent: number = 0.5): Decimal8 {
  const move = (random * 2 - 1) * (maxMovePercent / 100);
  const factor = (1 + move).toFixed(8);
  const next = current.times(factor);
  return next.isLessThan(MIN_PRICE) ? MIN_PRICE : next;
}

import { PriceTick } from './tick';

export const TICK_PUBLISHER = Symbol('TICK_PUBLISHER');
export const RANDOM_SOURCE = Symbol('RANDOM_SOURCE');

/** Sends new prices to whoever listens (the websocket gateway). */
export interface TickPublisher {
  publish(ticks: PriceTick[]): void;
}

/** Returns a number in [0, 1). Math.random in production, a fixed value in tests. */
export type RandomSource = () => number;

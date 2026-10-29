import { PriceTick } from '../../domain/tick';

export interface TickMessage {
  symbol: string;
  price: string;
  ts: string;
}

/** Collects ticks between two flushes. Only the newest tick per symbol is kept, because older ones are already stale. */
export class TickBatcher {
  private latest = new Map<string, TickMessage>();

  add(ticks: PriceTick[]): void {
    for (const tick of ticks) {
      this.latest.set(tick.symbol, { symbol: tick.symbol, price: tick.price, ts: tick.ts.toISOString() });
    }
  }

  drain(): TickMessage[] {
    const batch = [...this.latest.values()];
    this.latest = new Map();
    return batch;
  }
}

/** Keeps only the messages a client subscribed to. */
export function filterForSubscriber(batch: TickMessage[], symbols: Set<string>): TickMessage[] {
  return batch.filter((message) => symbols.has(message.symbol));
}

import { Candle, CandleInterval, PriceTick } from './tick';

export const TICK_REPOSITORY = Symbol('TICK_REPOSITORY');

export interface CandleQuery {
  assetId: string;
  interval: CandleInterval;
  from: Date;
  to: Date;
  limit: number;
}

export interface TickRepository {
  insertMany(ticks: PriceTick[]): Promise<void>;
  candles(query: CandleQuery): Promise<Candle[]>;
}

export interface PriceTick {
  assetId: string;
  symbol: string;
  price: string;
  ts: Date;
}

export type CandleInterval = '1m' | '5m' | '15m' | '1h' | '1d';
export const CANDLE_INTERVALS: CandleInterval[] = ['1m', '5m', '15m', '1h', '1d'];

export interface Candle {
  bucket: string;
  open: string;
  high: string;
  low: string;
  close: string;
  ticks: number;
}

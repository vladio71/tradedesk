import { readBoolean, readNumber, readString } from '@tradedesk/common';

export interface MarketConfig {
  port: number;
  databaseUrl: string;
  priceSimulatorEnabled: boolean;
  priceSimulatorIntervalMs: number;
}

export function loadMarketConfig(env: NodeJS.ProcessEnv = process.env): MarketConfig {
  return {
    port: readNumber(env, 'MARKET_PORT', 3003),
    databaseUrl: readString(env, 'MARKET_DATABASE_URL'),
    priceSimulatorEnabled: readBoolean(env, 'PRICE_SIMULATOR_ENABLED', false),
    priceSimulatorIntervalMs: readNumber(env, 'PRICE_SIMULATOR_INTERVAL_MS', 1000),
  };
}

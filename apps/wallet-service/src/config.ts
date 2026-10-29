import { readNumber, readString } from '@tradedesk/common';

export interface WalletConfig {
  port: number;
  databaseUrl: string;
  webhookSecret: string;
}

export function loadWalletConfig(env: NodeJS.ProcessEnv = process.env): WalletConfig {
  return {
    port: readNumber(env, 'WALLET_PORT', 3002),
    databaseUrl: readString(env, 'WALLET_DATABASE_URL'),
    webhookSecret: readString(env, 'CRYPTO_WEBHOOK_SECRET'),
  };
}

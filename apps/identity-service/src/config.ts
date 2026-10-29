import { readNumber, readString } from '@tradedesk/common';

export interface IdentityConfig {
  port: number;
  databaseUrl: string;
  refreshTtlSeconds: number;
}

export function loadIdentityConfig(env: NodeJS.ProcessEnv = process.env): IdentityConfig {
  return {
    port: readNumber(env, 'IDENTITY_PORT', 3001),
    databaseUrl: readString(env, 'IDENTITY_DATABASE_URL'),
    refreshTtlSeconds: readNumber(env, 'REFRESH_TOKEN_TTL_SECONDS', 7 * 24 * 60 * 60),
  };
}

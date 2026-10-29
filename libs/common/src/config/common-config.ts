export const COMMON_CONFIG = Symbol('COMMON_CONFIG');

export interface CommonConfig {
  nodeEnv: string;
  isProduction: boolean;
  /** Shared HS256 secret. Production should use asymmetric keys, see README. */
  jwtSecret: string;
  accessTokenTtlSeconds: number;
  cookieSecure: boolean;
}

export function readString(env: NodeJS.ProcessEnv, name: string, fallback?: string): string {
  const value = env[name];
  if (value !== undefined && value !== '') {
    return value;
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`Missing required environment variable ${name}`);
}

export function readNumber(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Environment variable ${name} must be a number`);
  }
  return value;
}

export function readBoolean(env: NodeJS.ProcessEnv, name: string, fallback: boolean): boolean {
  const raw = env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  return raw === 'true' || raw === '1';
}

export function loadCommonConfig(env: NodeJS.ProcessEnv = process.env): CommonConfig {
  const nodeEnv = readString(env, 'NODE_ENV', 'development');
  const jwtSecret = readString(env, 'JWT_SECRET');
  if (jwtSecret.length < 16) {
    throw new Error('JWT_SECRET must be at least 16 characters');
  }
  return {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    jwtSecret,
    accessTokenTtlSeconds: readNumber(env, 'ACCESS_TOKEN_TTL_SECONDS', 15 * 60),
    cookieSecure: readBoolean(env, 'COOKIE_SECURE', false),
  };
}

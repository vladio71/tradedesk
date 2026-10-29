import { User } from './user';

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
export const AUTH_TOKENS = Symbol('AUTH_TOKENS');
export const SESSION_SETTINGS = Symbol('SESSION_SETTINGS');

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

export interface NewRefreshToken {
  /** Sent to the client once. */
  raw: string;
  /** Stored in the database. */
  hash: string;
}

export interface AuthTokens {
  signAccessToken(user: User): string;
  generateRefreshToken(): NewRefreshToken;
  hashRefreshToken(raw: string): string;
}

export interface SessionSettings {
  refreshTtlMs: number;
}

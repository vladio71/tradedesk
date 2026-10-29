import * as jwt from 'jsonwebtoken';
import { AuthUser, JwtPayload } from './jwt-payload';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
export const CSRF_COOKIE = 'csrf_token';
export const CSRF_HEADER = 'x-csrf-token';

/** Parses a raw `Cookie` header. Used for socket.io handshakes, where cookie-parser does not run. */
export function parseCookieHeader(header: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) {
    return result;
  }
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) {
      continue;
    }
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) {
      try {
        result[name] = decodeURIComponent(value);
      } catch {
        result[name] = value;
      }
    }
  }
  return result;
}

export function extractAccessTokenFromCookies(cookies: Record<string, string> | undefined): string | undefined {
  return cookies?.[ACCESS_TOKEN_COOKIE] || undefined;
}

/** Verifies an HS256 access token and returns the user, or null when it is invalid or expired. */
export function verifyAccessToken(token: string, secret: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as JwtPayload;
    if (!payload.sub || (payload.role !== 'user' && payload.role !== 'admin')) {
      return null;
    }
    return { id: payload.sub, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

export function signAccessToken(user: AuthUser, secret: string, ttlSeconds: number): string {
  const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
  return jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: ttlSeconds });
}

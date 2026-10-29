import { Inject, Injectable } from '@nestjs/common';
import { ACCESS_TOKEN_COOKIE, COMMON_CONFIG, CommonConfig, CSRF_COOKIE, REFRESH_TOKEN_COOKIE } from '@tradedesk/common';
import { randomBytes } from 'node:crypto';
import { CookieOptions, Response } from 'express';
import { Session } from '../../application/session';
import { SESSION_SETTINGS, SessionSettings } from '../../domain/ports';

export const REFRESH_COOKIE_PATH = '/api/identity/auth';

/** The only place that knows how the three cookies are shaped. */
@Injectable()
export class AuthCookies {
  constructor(
    @Inject(COMMON_CONFIG) private readonly config: CommonConfig,
    @Inject(SESSION_SETTINGS) private readonly settings: SessionSettings,
  ) {}

  setSession(response: Response, session: Session): void {
    const secure = this.config.cookieSecure;
    response.cookie(ACCESS_TOKEN_COOKIE, session.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: this.config.accessTokenTtlSeconds * 1000,
    });
    response.cookie(REFRESH_TOKEN_COOKIE, session.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: REFRESH_COOKIE_PATH,
      maxAge: this.settings.refreshTtlMs,
    });
    // Not httpOnly on purpose: the frontend must read it and echo it in X-CSRF-Token.
    response.cookie(CSRF_COOKIE, randomBytes(24).toString('hex'), {
      httpOnly: false,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: this.settings.refreshTtlMs,
    });
  }

  clear(response: Response): void {
    const secure = this.config.cookieSecure;
    const base: CookieOptions = { sameSite: 'lax', secure };
    response.clearCookie(ACCESS_TOKEN_COOKIE, { ...base, httpOnly: true, path: '/' });
    response.clearCookie(REFRESH_TOKEN_COOKIE, { ...base, httpOnly: true, path: REFRESH_COOKIE_PATH });
    response.clearCookie(CSRF_COOKIE, { ...base, path: '/' });
  }
}

import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import { Request } from 'express';
import { CSRF_COOKIE, CSRF_HEADER } from '../auth/cookie-jwt';

export const SKIP_CSRF_KEY = 'skipCsrf';
/** Exempts a route from the CSRF check, for example login, register and signed webhooks. */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit cookie check. The csrf_token cookie must match the X-CSRF-Token header
 * on every POST, PUT, PATCH and DELETE.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) {
      return true;
    }
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [context.getHandler(), context.getClass()]);
    if (skip) {
      return true;
    }
    const cookieValue = request.cookies?.[CSRF_COOKIE];
    const headerValue = request.headers[CSRF_HEADER];
    if (typeof cookieValue !== 'string' || typeof headerValue !== 'string' || !safeEqual(cookieValue, headerValue)) {
      throw new ForbiddenException('CSRF token missing or invalid');
    }
    return true;
  }
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}

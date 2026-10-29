import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { COMMON_CONFIG, CommonConfig } from '../config/common-config';
import { extractAccessTokenFromCookies, verifyAccessToken } from './cookie-jwt';
import { AuthUser } from './jwt-payload';
import { IS_PUBLIC_KEY } from './public.decorator';

export type AuthenticatedRequest = Request & { user?: AuthUser };

/** Reads the access_token cookie, verifies the JWT and puts the user on the request. */
@Injectable()
export class JwtCookieAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(COMMON_CONFIG) private readonly config: CommonConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractAccessTokenFromCookies(request.cookies);
    const user = token ? verifyAccessToken(token, this.config.jwtSecret) : null;
    if (!user) {
      throw new UnauthorizedException('Missing or invalid access token');
    }
    request.user = user;
    return true;
  }
}

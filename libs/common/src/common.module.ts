import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtCookieAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { COMMON_CONFIG, loadCommonConfig } from './config/common-config';
import { AllExceptionsFilter } from './http/all-exceptions.filter';
import { CsrfGuard } from './security/csrf.guard';

/**
 * Wires the shared guards and the exception filter into a service.
 * Guard order matters: authenticate first, then CSRF, then roles.
 */
@Global()
@Module({
  providers: [
    { provide: COMMON_CONFIG, useFactory: () => loadCommonConfig() },
    { provide: APP_GUARD, useClass: JwtCookieAuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
  exports: [COMMON_CONFIG],
})
export class CommonModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { COMMON_CONFIG, CommonConfig, CommonModule } from '@tradedesk/common';
import { DataSource } from 'typeorm';
import { ChangePasswordUseCase } from './application/change-password.use-case';
import { GetCurrentUserUseCase } from './application/get-current-user.use-case';
import { ListUsersUseCase } from './application/list-users.use-case';
import { LoginUserUseCase } from './application/login-user.use-case';
import { LogoutUserUseCase } from './application/logout-user.use-case';
import { RefreshSessionUseCase } from './application/refresh-session.use-case';
import { RegisterUserUseCase } from './application/register-user.use-case';
import { UpdateProfileUseCase } from './application/update-profile.use-case';
import { loadIdentityConfig } from './config';
import { AUTH_TOKENS, PASSWORD_HASHER, SESSION_SETTINGS } from './domain/ports';
import { REFRESH_TOKEN_REPOSITORY } from './domain/refresh-token.repository';
import { UNIT_OF_WORK } from './domain/unit-of-work';
import { USER_REPOSITORY } from './domain/user.repository';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher';
import { buildTypeOrmOptions } from './infrastructure/database';
import { JwtAuthTokens } from './infrastructure/jwt-auth-tokens';
import { TypeOrmRefreshTokenRepository } from './infrastructure/repositories/typeorm-refresh-token.repository';
import { TypeOrmUserRepository } from './infrastructure/repositories/typeorm-user.repository';
import { TypeOrmUnitOfWork } from './infrastructure/typeorm-unit-of-work';
import { AuthCookies } from './interfaces/http/auth-cookies.service';
import { AuthController } from './interfaces/http/auth.controller';
import { HealthController } from './interfaces/http/health.controller';
import { UsersController } from './interfaces/http/users.controller';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forRootAsync({ useFactory: () => buildTypeOrmOptions(loadIdentityConfig().databaseUrl) }),
  ],
  controllers: [AuthController, UsersController, HealthController],
  providers: [
    RegisterUserUseCase,
    LoginUserUseCase,
    RefreshSessionUseCase,
    LogoutUserUseCase,
    GetCurrentUserUseCase,
    UpdateProfileUseCase,
    ChangePasswordUseCase,
    ListUsersUseCase,
    AuthCookies,
    { provide: USER_REPOSITORY, inject: [DataSource], useFactory: (ds: DataSource) => new TypeOrmUserRepository(ds.manager) },
    { provide: REFRESH_TOKEN_REPOSITORY, inject: [DataSource], useFactory: (ds: DataSource) => new TypeOrmRefreshTokenRepository(ds.manager) },
    { provide: UNIT_OF_WORK, inject: [DataSource], useFactory: (ds: DataSource) => new TypeOrmUnitOfWork(ds) },
    { provide: PASSWORD_HASHER, useFactory: () => new BcryptPasswordHasher(10) },
    {
      provide: AUTH_TOKENS,
      inject: [COMMON_CONFIG],
      useFactory: (config: CommonConfig) => new JwtAuthTokens(config.jwtSecret, config.accessTokenTtlSeconds),
    },
    { provide: SESSION_SETTINGS, useFactory: () => ({ refreshTtlMs: loadIdentityConfig().refreshTtlSeconds * 1000 }) },
  ],
})
export class AppModule {}

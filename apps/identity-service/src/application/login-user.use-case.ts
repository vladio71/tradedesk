import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Email } from '../domain/email';
import { InvalidCredentialsError } from '../domain/errors';
import { AUTH_TOKENS, AuthTokens, PASSWORD_HASHER, PasswordHasher, SESSION_SETTINGS, SessionSettings } from '../domain/ports';
import { RefreshToken } from '../domain/refresh-token';
import { REFRESH_TOKEN_REPOSITORY, RefreshTokenRepository } from '../domain/refresh-token.repository';
import { USER_REPOSITORY, UserRepository } from '../domain/user.repository';
import { Session } from './session';

export interface LoginCommand {
  email: string;
  password: string;
}

@Injectable()
export class LoginUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(AUTH_TOKENS) private readonly tokens: AuthTokens,
    @Inject(SESSION_SETTINGS) private readonly settings: SessionSettings,
  ) {}

  async execute(command: LoginCommand): Promise<Session> {
    let email: Email;
    try {
      email = Email.parse(command.email);
    } catch {
      throw new InvalidCredentialsError();
    }
    const user = await this.users.findByEmail(email);
    // Same error for "no such user" and "wrong password", so the API does not leak which emails exist.
    if (!user || !(await this.hasher.verify(command.password, user.passwordHash))) {
      throw new InvalidCredentialsError();
    }

    const refresh = this.tokens.generateRefreshToken();
    await this.refreshTokens.insert(
      RefreshToken.issue({
        id: randomUUID(),
        userId: user.id,
        familyId: randomUUID(),
        tokenHash: refresh.hash,
        now: new Date(),
        ttlMs: this.settings.refreshTtlMs,
      }),
    );
    return { user, accessToken: this.tokens.signAccessToken(user), refreshToken: refresh.raw };
  }
}

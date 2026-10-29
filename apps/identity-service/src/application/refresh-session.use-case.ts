import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InvalidRefreshTokenError, RefreshTokenReuseError } from '../domain/errors';
import { AUTH_TOKENS, AuthTokens, SESSION_SETTINGS, SessionSettings } from '../domain/ports';
import { RefreshToken } from '../domain/refresh-token';
import { UNIT_OF_WORK, UnitOfWork } from '../domain/unit-of-work';
import { Session } from './session';

type RotationOutcome = { kind: 'rotated'; session: Session } | { kind: 'invalid' } | { kind: 'reuse' };

@Injectable()
export class RefreshSessionUseCase {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(AUTH_TOKENS) private readonly tokens: AuthTokens,
    @Inject(SESSION_SETTINGS) private readonly settings: SessionSettings,
  ) {}

  async execute(rawRefreshToken: string | undefined): Promise<Session> {
    if (!rawRefreshToken) {
      throw new InvalidRefreshTokenError();
    }
    const hash = this.tokens.hashRefreshToken(rawRefreshToken);

    // The outcome is returned, not thrown, on purpose: revoking the family on reuse
    // must be committed. Throwing inside the transaction would roll it back.
    const outcome = await this.unitOfWork.run<RotationOutcome>(async (repos) => {
      const now = new Date();
      const current = await repos.refreshTokens.findByHashForUpdate(hash);
      if (!current) {
        return { kind: 'invalid' };
      }
      if (current.isRevoked()) {
        await repos.refreshTokens.revokeFamily(current.familyId, now);
        return { kind: 'reuse' };
      }
      const user = await repos.users.findById(current.userId);
      if (current.isExpired(now) || !user) {
        return { kind: 'invalid' };
      }

      const next = this.tokens.generateRefreshToken();
      const nextToken = RefreshToken.issue({
        id: randomUUID(),
        userId: user.id,
        familyId: current.familyId,
        tokenHash: next.hash,
        now,
        ttlMs: this.settings.refreshTtlMs,
      });
      await repos.refreshTokens.insert(nextToken);
      await repos.refreshTokens.revoke(current.id, nextToken.id, now);
      return { kind: 'rotated', session: { user, accessToken: this.tokens.signAccessToken(user), refreshToken: next.raw } };
    });

    if (outcome.kind === 'reuse') {
      throw new RefreshTokenReuseError();
    }
    if (outcome.kind === 'invalid') {
      throw new InvalidRefreshTokenError();
    }
    return outcome.session;
  }
}

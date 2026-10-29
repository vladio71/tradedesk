import { Inject, Injectable } from '@nestjs/common';
import { AUTH_TOKENS, AuthTokens } from '../domain/ports';
import { UNIT_OF_WORK, UnitOfWork } from '../domain/unit-of-work';

@Injectable()
export class LogoutUserUseCase {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(AUTH_TOKENS) private readonly tokens: AuthTokens,
  ) {}

  /** Revokes the whole token family of the given refresh token. Unknown tokens are ignored. */
  async execute(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }
    const hash = this.tokens.hashRefreshToken(rawRefreshToken);
    await this.unitOfWork.run(async (repos) => {
      const token = await repos.refreshTokens.findByHashForUpdate(hash);
      if (token) {
        await repos.refreshTokens.revokeFamily(token.familyId, new Date());
      }
    });
  }
}

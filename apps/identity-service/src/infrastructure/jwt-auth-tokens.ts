import { signAccessToken } from '@tradedesk/common';
import { createHash, randomBytes } from 'node:crypto';
import { AuthTokens, NewRefreshToken } from '../domain/ports';
import { User } from '../domain/user';

/** Access tokens are signed JWTs. Refresh tokens are random opaque strings, stored as SHA-256 hashes. */
export class JwtAuthTokens implements AuthTokens {
  constructor(
    private readonly jwtSecret: string,
    private readonly accessTtlSeconds: number,
  ) {}

  signAccessToken(user: User): string {
    return signAccessToken({ id: user.id, email: user.email.value, role: user.role }, this.jwtSecret, this.accessTtlSeconds);
  }

  generateRefreshToken(): NewRefreshToken {
    const raw = randomBytes(48).toString('base64url');
    return { raw, hash: this.hashRefreshToken(raw) };
  }

  hashRefreshToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}

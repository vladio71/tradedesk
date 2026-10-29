import { RefreshToken } from './refresh-token';

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');

export interface RefreshTokenRepository {
  insert(token: RefreshToken): Promise<void>;
  /** Locks the row (SELECT ... FOR UPDATE) so two refreshes of one token cannot run together. */
  findByHashForUpdate(tokenHash: string): Promise<RefreshToken | null>;
  revoke(id: string, replacedById: string | null, now: Date): Promise<void>;
  revokeFamily(familyId: string, now: Date): Promise<void>;
  revokeAllForUser(userId: string, now: Date): Promise<void>;
}

import { EntityManager } from 'typeorm';
import { RefreshToken } from '../../domain/refresh-token';
import { RefreshTokenRepository } from '../../domain/refresh-token.repository';
import { RefreshTokenOrmEntity } from '../orm/refresh-token.orm-entity';

interface RefreshTokenRow {
  id: string;
  user_id: string;
  family_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  replaced_by_id: string | null;
  created_at: Date;
}

/** Plain inserts use TypeORM. The rotation path uses native SQL so the row lock is explicit. */
export class TypeOrmRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly manager: EntityManager) {}

  async insert(token: RefreshToken): Promise<void> {
    await this.manager.getRepository(RefreshTokenOrmEntity).insert({
      id: token.id,
      userId: token.userId,
      familyId: token.familyId,
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      revokedAt: token.revokedAt,
      replacedById: token.replacedById,
      createdAt: token.createdAt,
    });
  }

  async findByHashForUpdate(tokenHash: string): Promise<RefreshToken | null> {
    const rows: RefreshTokenRow[] = await this.manager.query(
      `SELECT id, user_id, family_id, token_hash, expires_at, revoked_at, replaced_by_id, created_at
         FROM refresh_tokens
        WHERE token_hash = $1
          FOR UPDATE`,
      [tokenHash],
    );
    if (rows.length === 0) {
      return null;
    }
    const row = rows[0];
    return new RefreshToken({
      id: row.id,
      userId: row.user_id,
      familyId: row.family_id,
      tokenHash: row.token_hash,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      replacedById: row.replaced_by_id,
      createdAt: row.created_at,
    });
  }

  async revoke(id: string, replacedById: string | null, now: Date): Promise<void> {
    await this.manager.query(`UPDATE refresh_tokens SET revoked_at = $2, replaced_by_id = $3 WHERE id = $1`, [id, now, replacedById]);
  }

  async revokeFamily(familyId: string, now: Date): Promise<void> {
    await this.manager.query(`UPDATE refresh_tokens SET revoked_at = $2 WHERE family_id = $1 AND revoked_at IS NULL`, [familyId, now]);
  }

  async revokeAllForUser(userId: string, now: Date): Promise<void> {
    await this.manager.query(`UPDATE refresh_tokens SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL`, [userId, now]);
  }
}

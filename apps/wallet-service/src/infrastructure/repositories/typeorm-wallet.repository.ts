import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { Money } from '../../domain/money';
import { Wallet } from '../../domain/wallet';
import { WalletRepository } from '../../domain/wallet.repository';
import { WalletOrmEntity } from '../orm/wallet.orm-entity';

interface WalletRow {
  id: string;
  user_id: string;
  balance: string;
  created_at: Date;
  updated_at: Date;
}

export class TypeOrmWalletRepository implements WalletRepository {
  constructor(private readonly manager: EntityManager) {}

  async ensureForUser(userId: string): Promise<Wallet> {
    await this.manager.query(`INSERT INTO wallets (id, user_id) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`, [randomUUID(), userId]);
    const wallet = await this.findByUserId(userId);
    return wallet as Wallet;
  }

  async findByUserId(userId: string): Promise<Wallet | null> {
    const row = await this.manager.getRepository(WalletOrmEntity).findOne({ where: { userId } });
    return row ? toDomain(row) : null;
  }

  async lockByUserIds(userIds: string[]): Promise<Wallet[]> {
    // ORDER BY id makes every transaction take the row locks in the same order.
    const rows: WalletRow[] = await this.manager.query(
      `SELECT id, user_id, balance, created_at, updated_at
         FROM wallets
        WHERE user_id = ANY($1::uuid[])
        ORDER BY id
          FOR UPDATE`,
      [userIds],
    );
    return rows.map((row) =>
      toDomain({ id: row.id, userId: row.user_id, balance: row.balance, createdAt: row.created_at, updatedAt: row.updated_at }),
    );
  }

  async save(wallet: Wallet): Promise<void> {
    await this.manager.query(`UPDATE wallets SET balance = $2, updated_at = $3 WHERE id = $1`, [
      wallet.id,
      wallet.balance.toString(),
      wallet.updatedAt,
    ]);
  }
}

function toDomain(row: WalletOrmEntity): Wallet {
  return new Wallet({
    id: row.id,
    userId: row.userId,
    balance: Money.of(row.balance),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

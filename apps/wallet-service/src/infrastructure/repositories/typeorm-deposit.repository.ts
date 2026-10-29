import { buildPage, offsetOf, Page, PageRequest } from '@tradedesk/common';
import { EntityManager } from 'typeorm';
import { Deposit } from '../../domain/deposit';
import { DepositRepository } from '../../domain/deposit.repository';
import { DuplicateIdempotencyKeyError } from '../../domain/errors';
import { Money } from '../../domain/money';
import { DepositOrmEntity } from '../orm/deposit.orm-entity';

const UNIQUE_VIOLATION = '23505';

export class TypeOrmDepositRepository implements DepositRepository {
  constructor(private readonly manager: EntityManager) {}

  private get orm() {
    return this.manager.getRepository(DepositOrmEntity);
  }

  async insert(deposit: Deposit): Promise<void> {
    try {
      await this.orm.insert(toRow(deposit));
    } catch (error) {
      const driverError = (error as { driverError?: { code?: string; constraint?: string } }).driverError;
      if (driverError?.code === UNIQUE_VIOLATION && driverError.constraint === 'uq_deposits_user_idempotency_key') {
        throw new DuplicateIdempotencyKeyError();
      }
      throw error;
    }
  }

  async findByIdempotencyKey(userId: string, idempotencyKey: string): Promise<Deposit | null> {
    const row = await this.orm.findOne({ where: { userId, idempotencyKey } });
    return row ? toDomain(row) : null;
  }

  async findByIdForUser(id: string, userId: string): Promise<Deposit | null> {
    const row = await this.orm.findOne({ where: { id, userId } });
    return row ? toDomain(row) : null;
  }

  async findByAddressForUpdate(address: string): Promise<Deposit | null> {
    const rows: Record<string, unknown>[] = await this.manager.query(`SELECT id FROM deposits WHERE address = $1 FOR UPDATE`, [address]);
    if (rows.length === 0) {
      return null;
    }
    // The lock is held now. Read the fresh row through TypeORM.
    return this.findById(rows[0].id as string);
  }

  async save(deposit: Deposit): Promise<void> {
    await this.orm.update({ id: deposit.id }, { status: deposit.status, txHash: deposit.txHash, confirmedAt: deposit.confirmedAt });
  }

  async listForUser(userId: string, request: PageRequest): Promise<Page<Deposit>> {
    const [rows, total] = await this.orm.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: offsetOf(request),
      take: request.pageSize,
    });
    return buildPage(rows.map(toDomain), total, request);
  }

  private async findById(id: string): Promise<Deposit | null> {
    const row = await this.orm.findOne({ where: { id } });
    return row ? toDomain(row) : null;
  }
}

function toRow(deposit: Deposit): DepositOrmEntity {
  const row = new DepositOrmEntity();
  row.id = deposit.id;
  row.userId = deposit.userId;
  row.walletId = deposit.walletId;
  row.asset = deposit.asset;
  row.amount = deposit.amount.toString();
  row.usdRate = deposit.usdRate;
  row.creditAmount = deposit.creditAmount.toString();
  row.address = deposit.address;
  row.txHash = deposit.txHash;
  row.status = deposit.status;
  row.idempotencyKey = deposit.idempotencyKey;
  row.createdAt = deposit.createdAt;
  row.confirmedAt = deposit.confirmedAt;
  return row;
}

function toDomain(row: DepositOrmEntity): Deposit {
  return new Deposit({
    id: row.id,
    userId: row.userId,
    walletId: row.walletId,
    asset: row.asset,
    amount: Money.of(row.amount),
    usdRate: row.usdRate,
    creditAmount: Money.of(row.creditAmount),
    address: row.address,
    txHash: row.txHash,
    status: row.status,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt,
    confirmedAt: row.confirmedAt,
  });
}

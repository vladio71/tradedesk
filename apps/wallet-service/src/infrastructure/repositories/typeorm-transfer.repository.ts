import { buildPage, offsetOf, Page, PageRequest } from '@tradedesk/common';
import { EntityManager } from 'typeorm';
import { Money } from '../../domain/money';
import { Transfer } from '../../domain/transfer';
import { TransferRepository } from '../../domain/transfer.repository';
import { TransferOrmEntity } from '../orm/transfer.orm-entity';

export class TypeOrmTransferRepository implements TransferRepository {
  constructor(private readonly manager: EntityManager) {}

  private get orm() {
    return this.manager.getRepository(TransferOrmEntity);
  }

  async insert(transfer: Transfer): Promise<void> {
    await this.orm.insert({
      id: transfer.id,
      fromUserId: transfer.fromUserId,
      toUserId: transfer.toUserId,
      fromWalletId: transfer.fromWalletId,
      toWalletId: transfer.toWalletId,
      amount: transfer.amount.toString(),
      status: transfer.status,
      note: transfer.note,
      idempotencyKey: transfer.idempotencyKey,
      createdAt: transfer.createdAt,
    });
  }

  async findByIdempotencyKey(fromUserId: string, idempotencyKey: string): Promise<Transfer | null> {
    const row = await this.orm.findOne({ where: { fromUserId, idempotencyKey } });
    return row ? toDomain(row) : null;
  }

  async findByIdForUser(id: string, userId: string): Promise<Transfer | null> {
    const row = await this.orm.findOne({ where: [{ id, fromUserId: userId }, { id, toUserId: userId }] });
    return row ? toDomain(row) : null;
  }

  async listForUser(userId: string, request: PageRequest): Promise<Page<Transfer>> {
    const [rows, total] = await this.orm.findAndCount({
      where: [{ fromUserId: userId }, { toUserId: userId }],
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: offsetOf(request),
      take: request.pageSize,
    });
    return buildPage(rows.map(toDomain), total, request);
  }
}

function toDomain(row: TransferOrmEntity): Transfer {
  return new Transfer({
    id: row.id,
    fromUserId: row.fromUserId,
    toUserId: row.toUserId,
    fromWalletId: row.fromWalletId,
    toWalletId: row.toWalletId,
    amount: Money.of(row.amount),
    status: row.status,
    note: row.note,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt,
  });
}

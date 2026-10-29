import { buildPage, offsetOf, Page } from '@tradedesk/common';
import { EntityManager } from 'typeorm';
import { LedgerEntry } from '../../domain/ledger-entry';
import { LedgerFilter, LedgerRepository } from '../../domain/ledger.repository';
import { Money } from '../../domain/money';
import { LedgerEntryOrmEntity } from '../orm/ledger-entry.orm-entity';

export class TypeOrmLedgerRepository implements LedgerRepository {
  constructor(private readonly manager: EntityManager) {}

  async insertMany(entries: LedgerEntry[]): Promise<void> {
    await this.manager.getRepository(LedgerEntryOrmEntity).insert(
      entries.map((entry) => ({
        id: entry.id,
        walletId: entry.walletId,
        kind: entry.kind,
        direction: entry.direction,
        amount: entry.amount.toString(),
        balanceAfter: entry.balanceAfter.toString(),
        referenceId: entry.referenceId,
        createdAt: entry.createdAt,
      })),
    );
  }

  async listForWallet(walletId: string, filter: LedgerFilter): Promise<Page<LedgerEntry>> {
    const query = this.manager.getRepository(LedgerEntryOrmEntity).createQueryBuilder('l').where('l.walletId = :walletId', { walletId });
    if (filter.kind) {
      query.andWhere('l.kind = :kind', { kind: filter.kind });
    }
    if (filter.from) {
      query.andWhere('l.createdAt >= :from', { from: filter.from });
    }
    if (filter.to) {
      query.andWhere('l.createdAt < :to', { to: filter.to });
    }
    const [rows, total] = await query
      .orderBy('l.createdAt', 'DESC')
      .addOrderBy('l.id', 'ASC')
      .skip(offsetOf(filter))
      .take(filter.pageSize)
      .getManyAndCount();
    return buildPage(rows.map(toDomain), total, filter);
  }
}

function toDomain(row: LedgerEntryOrmEntity): LedgerEntry {
  return new LedgerEntry({
    id: row.id,
    walletId: row.walletId,
    kind: row.kind,
    direction: row.direction,
    amount: Money.of(row.amount),
    balanceAfter: Money.of(row.balanceAfter),
    referenceId: row.referenceId,
    createdAt: row.createdAt,
  });
}

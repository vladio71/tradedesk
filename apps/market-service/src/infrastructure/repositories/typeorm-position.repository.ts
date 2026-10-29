import { buildPage, offsetOf, Page } from '@tradedesk/common';
import { EntityManager } from 'typeorm';
import { Decimal8 } from '../../domain/decimal8';
import { Position } from '../../domain/position';
import { PnlSummaryRow, PositionFilter, PositionRepository } from '../../domain/position.repository';
import { PositionOrmEntity } from '../orm/position.orm-entity';

interface SummarySqlRow {
  symbol: string;
  open_count: number;
  closed_count: number;
  open_quantity: string;
  realized_pnl: string;
  unrealized_pnl: string;
}

export class TypeOrmPositionRepository implements PositionRepository {
  constructor(private readonly manager: EntityManager) {}

  private get orm() {
    return this.manager.getRepository(PositionOrmEntity);
  }

  async insert(position: Position): Promise<void> {
    await this.orm.insert(toRow(position));
  }

  async findByIdForUpdate(id: string, userId: string): Promise<Position | null> {
    const locked: { id: string }[] = await this.manager.query(`SELECT id FROM positions WHERE id = $1 AND user_id = $2 FOR UPDATE`, [id, userId]);
    if (locked.length === 0) {
      return null;
    }
    // The lock is held now, so this read sees the latest committed state.
    const row = await this.orm.findOne({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async save(position: Position): Promise<void> {
    await this.orm.update(
      { id: position.id },
      {
        status: position.status,
        closedPrice: position.closedPrice ? position.closedPrice.toString() : null,
        pnl: position.pnl ? position.pnl.toString() : null,
        closedAt: position.closedAt,
      },
    );
  }

  async list(filter: PositionFilter): Promise<Page<Position>> {
    const query = this.orm.createQueryBuilder('p').where('p.userId = :userId', { userId: filter.userId });
    if (filter.status) {
      query.andWhere('p.status = :status', { status: filter.status });
    }
    if (filter.side) {
      query.andWhere('p.side = :side', { side: filter.side });
    }
    if (filter.symbol) {
      query.andWhere('p.symbol = :symbol', { symbol: filter.symbol });
    }
    const [rows, total] = await query
      .orderBy('p.openedAt', 'DESC')
      .addOrderBy('p.id', 'ASC')
      .skip(offsetOf(filter))
      .take(filter.pageSize)
      .getManyAndCount();
    return buildPage(rows.map(toDomain), total, filter);
  }

  async summary(userId: string): Promise<PnlSummaryRow[]> {
    // Realized pnl comes from closed positions. Unrealized pnl is computed against the current asset price.
    const rows: SummarySqlRow[] = await this.manager.query(
      `SELECT p.symbol,
              COUNT(*) FILTER (WHERE p.status = 'open')::int   AS open_count,
              COUNT(*) FILTER (WHERE p.status = 'closed')::int AS closed_count,
              COALESCE(SUM(p.quantity) FILTER (WHERE p.status = 'open'), 0) AS open_quantity,
              COALESCE(SUM(p.pnl) FILTER (WHERE p.status = 'closed'), 0)    AS realized_pnl,
              ROUND(COALESCE(SUM(
                CASE WHEN p.side = 'long' THEN a.last_price - p.entry_price ELSE p.entry_price - a.last_price END * p.quantity
              ) FILTER (WHERE p.status = 'open'), 0), 8) AS unrealized_pnl
         FROM positions p
         JOIN assets a ON a.id = p.asset_id
        WHERE p.user_id = $1
        GROUP BY p.symbol
        ORDER BY p.symbol`,
      [userId],
    );
    return rows.map((row) => ({
      symbol: row.symbol,
      openCount: row.open_count,
      closedCount: row.closed_count,
      openQuantity: Decimal8.of(row.open_quantity).toString(),
      realizedPnl: Decimal8.of(row.realized_pnl).toString(),
      unrealizedPnl: Decimal8.of(row.unrealized_pnl).toString(),
    }));
  }
}

function toRow(position: Position): PositionOrmEntity {
  const row = new PositionOrmEntity();
  row.id = position.id;
  row.userId = position.userId;
  row.assetId = position.assetId;
  row.symbol = position.symbol;
  row.side = position.side;
  row.quantity = position.quantity.toString();
  row.entryPrice = position.entryPrice.toString();
  row.status = position.status;
  row.closedPrice = position.closedPrice ? position.closedPrice.toString() : null;
  row.pnl = position.pnl ? position.pnl.toString() : null;
  row.openedAt = position.openedAt;
  row.closedAt = position.closedAt;
  return row;
}

function toDomain(row: PositionOrmEntity): Position {
  return new Position({
    id: row.id,
    userId: row.userId,
    assetId: row.assetId,
    symbol: row.symbol,
    side: row.side,
    quantity: Decimal8.of(row.quantity),
    entryPrice: Decimal8.of(row.entryPrice),
    status: row.status,
    closedPrice: row.closedPrice ? Decimal8.of(row.closedPrice) : null,
    pnl: row.pnl ? Decimal8.of(row.pnl) : null,
    openedAt: row.openedAt,
    closedAt: row.closedAt,
  });
}

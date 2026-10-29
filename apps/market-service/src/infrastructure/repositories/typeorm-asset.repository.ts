import { buildPage, offsetOf, Page } from '@tradedesk/common';
import { EntityManager } from 'typeorm';
import { Asset, AssetStatus } from '../../domain/asset';
import { AssetRepository, AssetSearchFilter, AssetSortField, AssetUpsertRow, PriceUpdate } from '../../domain/asset.repository';
import { Decimal8 } from '../../domain/decimal8';
import { SymbolAlreadyExistsError } from '../../domain/errors';
import { AssetOrmEntity } from '../orm/asset.orm-entity';

const UNIQUE_VIOLATION = '23505';

/** Maps the public sort names to entity properties. Only these can reach ORDER BY. */
const SORT_COLUMNS: Record<AssetSortField, string> = {
  symbol: 'a.symbol',
  name: 'a.name',
  lastPrice: 'a.lastPrice',
  updatedAt: 'a.updatedAt',
};

export class TypeOrmAssetRepository implements AssetRepository {
  constructor(private readonly manager: EntityManager) {}

  private get orm() {
    return this.manager.getRepository(AssetOrmEntity);
  }

  async findBySymbol(symbol: string): Promise<Asset | null> {
    const row = await this.orm.createQueryBuilder('a').where('a.symbol = :symbol AND a.deletedAt IS NULL', { symbol }).getOne();
    return row ? toDomain(row) : null;
  }

  async findById(id: string): Promise<Asset | null> {
    const row = await this.orm.createQueryBuilder('a').where('a.id = :id AND a.deletedAt IS NULL', { id }).getOne();
    return row ? toDomain(row) : null;
  }

  async search(filter: AssetSearchFilter): Promise<Page<Asset>> {
    const query = this.orm.createQueryBuilder('a').where('a.deletedAt IS NULL');
    if (filter.q) {
      query.andWhere('(a.symbol ILIKE :q OR a.name ILIKE :q)', { q: `%${filter.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` });
    }
    if (filter.category) {
      query.andWhere('a.category = :category', { category: filter.category });
    }
    if (filter.status) {
      query.andWhere('a.status = :status', { status: filter.status });
    }
    if (filter.minPrice !== undefined) {
      query.andWhere('a.lastPrice >= :minPrice', { minPrice: filter.minPrice });
    }
    if (filter.maxPrice !== undefined) {
      query.andWhere('a.lastPrice <= :maxPrice', { maxPrice: filter.maxPrice });
    }
    const [rows, total] = await query
      .orderBy(SORT_COLUMNS[filter.sort], filter.order === 'asc' ? 'ASC' : 'DESC')
      .addOrderBy('a.id', 'ASC')
      .skip(offsetOf(filter))
      .take(filter.pageSize)
      .getManyAndCount();
    return buildPage(rows.map(toDomain), total, filter);
  }

  async listActive(): Promise<Asset[]> {
    const rows = await this.orm.createQueryBuilder('a').where("a.status = 'active' AND a.deletedAt IS NULL").orderBy('a.symbol').getMany();
    return rows.map(toDomain);
  }

  async insert(asset: Asset): Promise<void> {
    try {
      await this.orm.insert(toRow(asset));
    } catch (error) {
      if ((error as { driverError?: { code?: string } }).driverError?.code === UNIQUE_VIOLATION) {
        throw new SymbolAlreadyExistsError(asset.symbol);
      }
      throw error;
    }
  }

  async update(asset: Asset): Promise<void> {
    await this.orm.update({ id: asset.id }, { name: asset.name, category: asset.category, status: asset.status, updatedAt: asset.updatedAt });
  }

  async bulkUpsert(rows: AssetUpsertRow[], now: Date): Promise<{ created: number; updated: number }> {
    if (rows.length === 0) {
      return { created: 0, updated: 0 };
    }
    const params: unknown[] = [];
    const tuples = rows.map((row, index) => {
      const base = index * 5;
      params.push(row.symbol, row.name, row.category, row.status, row.lastPrice);
      return `(gen_random_uuid(), $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}::numeric, $${rows.length * 5 + 1}::timestamptz, $${rows.length * 5 + 1}::timestamptz)`;
    });
    params.push(now);

    // xmax = 0 is true only for rows that were inserted. Updated rows have a non-zero xmax.
    const result: { inserted: boolean }[] = await this.manager.query(
      `INSERT INTO assets (id, symbol, name, category, status, last_price, created_at, updated_at)
       VALUES ${tuples.join(', ')}
       ON CONFLICT (symbol) DO UPDATE
         SET name = EXCLUDED.name,
             category = EXCLUDED.category,
             status = EXCLUDED.status,
             last_price = EXCLUDED.last_price,
             updated_at = EXCLUDED.updated_at,
             deleted_at = NULL
       RETURNING (xmax = 0) AS inserted`,
      params,
    );
    const created = result.filter((row) => row.inserted).length;
    return { created, updated: result.length - created };
  }

  async bulkSetStatus(ids: string[], status: AssetStatus, now: Date): Promise<string[]> {
    // The CTE makes the result a plain SELECT, so the driver returns the rows directly.
    const rows: { id: string }[] = await this.manager.query(
      `WITH changed AS (
         UPDATE assets SET status = $2, updated_at = $3
          WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL
          RETURNING id
       )
       SELECT id FROM changed`,
      [ids, status, now],
    );
    return rows.map((row) => row.id);
  }

  async bulkSoftDelete(ids: string[], now: Date): Promise<number> {
    const rows: { affected: number }[] = await this.manager.query(
      `WITH deleted AS (
         UPDATE assets SET deleted_at = $2, updated_at = $2
          WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL
          RETURNING id
       )
       SELECT COUNT(*)::int AS affected FROM deleted`,
      [ids, now],
    );
    return rows[0].affected;
  }

  async applyPrices(updates: PriceUpdate[], now: Date): Promise<void> {
    if (updates.length === 0) {
      return;
    }
    const params: unknown[] = [now];
    const tuples = updates.map((update, index) => {
      params.push(update.assetId, update.price);
      return `($${index * 2 + 2}::uuid, $${index * 2 + 3}::numeric)`;
    });
    await this.manager.query(
      `UPDATE assets AS a
          SET last_price = v.price, updated_at = $1
         FROM (VALUES ${tuples.join(', ')}) AS v(id, price)
        WHERE a.id = v.id`,
      params,
    );
  }
}

function toDomain(row: AssetOrmEntity): Asset {
  return new Asset({
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    category: row.category,
    status: row.status,
    lastPrice: Decimal8.of(row.lastPrice),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  });
}

function toRow(asset: Asset): AssetOrmEntity {
  const row = new AssetOrmEntity();
  row.id = asset.id;
  row.symbol = asset.symbol;
  row.name = asset.name;
  row.category = asset.category;
  row.status = asset.status;
  row.lastPrice = asset.lastPrice.toString();
  row.createdAt = asset.createdAt;
  row.updatedAt = asset.updatedAt;
  row.deletedAt = asset.deletedAt;
  return row;
}

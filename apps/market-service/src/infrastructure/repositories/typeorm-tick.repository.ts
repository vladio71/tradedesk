import { EntityManager } from 'typeorm';
import { Candle, CandleInterval, PriceTick } from '../../domain/tick';
import { CandleQuery, TickRepository } from '../../domain/tick.repository';
import { PriceTickOrmEntity } from '../orm/price-tick.orm-entity';

/** SQL expression for the start of the bucket. Fixed strings, never built from user input. */
const BUCKET_SQL: Record<CandleInterval, string> = {
  '1m': `date_trunc('minute', ts)`,
  '5m': `date_trunc('hour', ts) + floor(extract(minute from ts) / 5) * interval '5 minutes'`,
  '15m': `date_trunc('hour', ts) + floor(extract(minute from ts) / 15) * interval '15 minutes'`,
  '1h': `date_trunc('hour', ts)`,
  '1d': `date_trunc('day', ts)`,
};

interface CandleRow {
  bucket: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  ticks: number;
}

export class TypeOrmTickRepository implements TickRepository {
  constructor(private readonly manager: EntityManager) {}

  async insertMany(ticks: PriceTick[]): Promise<void> {
    if (ticks.length === 0) {
      return;
    }
    await this.manager.getRepository(PriceTickOrmEntity).insert(ticks.map((tick) => ({ assetId: tick.assetId, price: tick.price, ts: tick.ts })));
  }

  async candles(query: CandleQuery): Promise<Candle[]> {
    // Step 1: put each tick in a bucket.
    // Step 2: window functions give the first and the last price of each bucket (FIRST_VALUE over ASC and DESC order).
    // Step 3: group by bucket for high, low and count. open and close are the same on every row of a bucket.
    const rows: CandleRow[] = await this.manager.query(
      `WITH bucketed AS (
         SELECT ${BUCKET_SQL[query.interval]} AS bucket, price, ts
           FROM price_ticks
          WHERE asset_id = $1 AND ts >= $2 AND ts < $3
       ),
       with_edges AS (
         SELECT bucket, price,
                FIRST_VALUE(price) OVER (PARTITION BY bucket ORDER BY ts ASC)  AS open_price,
                FIRST_VALUE(price) OVER (PARTITION BY bucket ORDER BY ts DESC) AS close_price
           FROM bucketed
       )
       SELECT bucket,
              MAX(open_price)  AS open,
              MAX(price)       AS high,
              MIN(price)       AS low,
              MAX(close_price) AS close,
              COUNT(*)::int    AS ticks
         FROM with_edges
        GROUP BY bucket
        ORDER BY bucket DESC
        LIMIT $4`,
      [query.assetId, query.from, query.to, query.limit],
    );
    return rows
      .map((row) => ({ bucket: row.bucket.toISOString(), open: row.open, high: row.high, low: row.low, close: row.close, ticks: row.ticks }))
      .reverse();
  }
}

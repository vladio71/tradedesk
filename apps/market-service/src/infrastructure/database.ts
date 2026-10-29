import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { InitMarketSchema1700000000000 } from './migrations/1700000000000-init-market-schema';
import { AssetOrmEntity } from './orm/asset.orm-entity';
import { PositionOrmEntity } from './orm/position.orm-entity';
import { PriceTickOrmEntity } from './orm/price-tick.orm-entity';

export function buildTypeOrmOptions(databaseUrl: string): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    entities: [AssetOrmEntity, PriceTickOrmEntity, PositionOrmEntity],
    migrations: [InitMarketSchema1700000000000],
    migrationsRun: true,
    synchronize: false,
    // Day and hour buckets (date_trunc) must not depend on the server time zone.
    extra: { options: '-c TimeZone=UTC' },
  };
}

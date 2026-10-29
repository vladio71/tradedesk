import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { InitWalletSchema1700000000000 } from './migrations/1700000000000-init-wallet-schema';
import { DepositOrmEntity } from './orm/deposit.orm-entity';
import { LedgerEntryOrmEntity } from './orm/ledger-entry.orm-entity';
import { TransferOrmEntity } from './orm/transfer.orm-entity';
import { WalletOrmEntity } from './orm/wallet.orm-entity';

export function buildTypeOrmOptions(databaseUrl: string): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    entities: [WalletOrmEntity, LedgerEntryOrmEntity, TransferOrmEntity, DepositOrmEntity],
    migrations: [InitWalletSchema1700000000000],
    migrationsRun: true,
    synchronize: false,
    // Day and hour buckets (date_trunc) must not depend on the server time zone.
    extra: { options: '-c TimeZone=UTC' },
  };
}

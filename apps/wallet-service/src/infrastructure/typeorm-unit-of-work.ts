import { DataSource } from 'typeorm';
import { UnitOfWork, WalletRepositories } from '../domain/unit-of-work';
import { TypeOrmDepositRepository } from './repositories/typeorm-deposit.repository';
import { TypeOrmLedgerRepository } from './repositories/typeorm-ledger.repository';
import { TypeOrmReportRepository } from './repositories/typeorm-report.repository';
import { TypeOrmTransferRepository } from './repositories/typeorm-transfer.repository';
import { TypeOrmWalletRepository } from './repositories/typeorm-wallet.repository';

/** Every repository handed to the work shares one EntityManager, so they share one transaction. */
export class TypeOrmUnitOfWork implements UnitOfWork {
  constructor(private readonly dataSource: DataSource) {}

  run<T>(work: (repositories: WalletRepositories) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (manager) =>
      work({
        wallets: new TypeOrmWalletRepository(manager),
        ledger: new TypeOrmLedgerRepository(manager),
        transfers: new TypeOrmTransferRepository(manager),
        deposits: new TypeOrmDepositRepository(manager),
        reports: new TypeOrmReportRepository(manager),
      }),
    );
  }
}

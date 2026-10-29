import { DepositRepository } from './deposit.repository';
import { LedgerRepository } from './ledger.repository';
import { ReportRepository } from './report.repository';
import { TransferRepository } from './transfer.repository';
import { WalletRepository } from './wallet.repository';

export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');

export interface WalletRepositories {
  wallets: WalletRepository;
  ledger: LedgerRepository;
  transfers: TransferRepository;
  deposits: DepositRepository;
  reports: ReportRepository;
}

/** Runs the work in one database transaction. A thrown error rolls everything back. */
export interface UnitOfWork {
  run<T>(work: (repositories: WalletRepositories) => Promise<T>): Promise<T>;
}

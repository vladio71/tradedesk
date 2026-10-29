import { Page, PageRequest } from '@tradedesk/common';
import { LedgerEntry, LedgerKind } from './ledger-entry';

export const LEDGER_REPOSITORY = Symbol('LEDGER_REPOSITORY');

export interface LedgerFilter extends PageRequest {
  kind?: LedgerKind;
  from?: Date;
  to?: Date;
}

export interface LedgerRepository {
  insertMany(entries: LedgerEntry[]): Promise<void>;
  listForWallet(walletId: string, filter: LedgerFilter): Promise<Page<LedgerEntry>>;
}

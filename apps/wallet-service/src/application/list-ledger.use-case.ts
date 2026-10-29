import { Inject, Injectable } from '@nestjs/common';
import { Page } from '@tradedesk/common';
import { LedgerEntry, LedgerKind } from '../domain/ledger-entry';
import { UNIT_OF_WORK, UnitOfWork } from '../domain/unit-of-work';

export interface ListLedgerQuery {
  userId: string;
  page: number;
  pageSize: number;
  kind?: LedgerKind;
  from?: Date;
  to?: Date;
}

@Injectable()
export class ListLedgerUseCase {
  constructor(@Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork) {}

  execute(query: ListLedgerQuery): Promise<Page<LedgerEntry>> {
    return this.unitOfWork.run(async (repos) => {
      const wallet = await repos.wallets.ensureForUser(query.userId);
      return repos.ledger.listForWallet(wallet.id, query);
    });
  }
}

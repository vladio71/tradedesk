import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../domain/unit-of-work';
import { Wallet } from '../domain/wallet';

@Injectable()
export class GetMyWalletUseCase {
  constructor(@Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork) {}

  /** The wallet is created on first use. */
  execute(userId: string): Promise<Wallet> {
    return this.unitOfWork.run((repos) => repos.wallets.ensureForUser(userId));
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CryptoAsset, Deposit } from '../domain/deposit';
import { DuplicateIdempotencyKeyError, IdempotencyKeyReuseError } from '../domain/errors';
import { Money } from '../domain/money';
import { CRYPTO_PROVIDER, CryptoProvider } from '../domain/ports';
import { UNIT_OF_WORK, UnitOfWork } from '../domain/unit-of-work';

export interface RequestDepositCommand {
  userId: string;
  idempotencyKey: string;
  asset: CryptoAsset;
  amount: string;
}

export interface RequestDepositResult {
  deposit: Deposit;
  replayed: boolean;
}

@Injectable()
export class RequestDepositUseCase {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CRYPTO_PROVIDER) private readonly provider: CryptoProvider,
  ) {}

  async execute(command: RequestDepositCommand): Promise<RequestDepositResult> {
    const amount = Money.of(command.amount);
    Deposit.assertValidAmount(amount);

    const existing = await this.findExisting(command, amount);
    if (existing) {
      return { deposit: existing, replayed: true };
    }

    // The provider is called outside the transaction: no database lock is held during a network call.
    const address = await this.provider.createDepositAddress(command.asset);
    const usdRate = await this.provider.getUsdRate(command.asset);

    try {
      const deposit = await this.unitOfWork.run(async (repos) => {
        const wallet = await repos.wallets.ensureForUser(command.userId);
        const created = Deposit.request({
          id: randomUUID(),
          userId: command.userId,
          walletId: wallet.id,
          asset: command.asset,
          amount,
          usdRate,
          address,
          idempotencyKey: command.idempotencyKey,
          now: new Date(),
        });
        await repos.deposits.insert(created);
        return created;
      });
      return { deposit, replayed: false };
    } catch (error) {
      // Two requests with the same key raced. The unique index let one win. The other returns the winner.
      if (error instanceof DuplicateIdempotencyKeyError) {
        const winner = await this.findExisting(command, amount);
        if (winner) {
          return { deposit: winner, replayed: true };
        }
      }
      throw error;
    }
  }

  private async findExisting(command: RequestDepositCommand, amount: Money): Promise<Deposit | null> {
    const existing = await this.unitOfWork.run((repos) => repos.deposits.findByIdempotencyKey(command.userId, command.idempotencyKey));
    if (existing && (existing.asset !== command.asset || !existing.amount.equals(amount))) {
      throw new IdempotencyKeyReuseError();
    }
    return existing;
  }
}

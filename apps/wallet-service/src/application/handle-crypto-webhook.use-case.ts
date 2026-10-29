import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DepositNotFoundError, InvalidWebhookSignatureError } from '../domain/errors';
import { LedgerEntry } from '../domain/ledger-entry';
import { Money } from '../domain/money';
import { CryptoWebhookEvent, WEBHOOK_SIGNER, WebhookSigner } from '../domain/ports';
import { UNIT_OF_WORK, UnitOfWork } from '../domain/unit-of-work';

export interface HandleWebhookCommand {
  rawBody: string | Buffer;
  signature: string | undefined;
  event: CryptoWebhookEvent;
}

export type WebhookOutcome = 'confirmed' | 'already_processed';

@Injectable()
export class HandleCryptoWebhookUseCase {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(WEBHOOK_SIGNER) private readonly signer: WebhookSigner,
  ) {}

  /**
   * Providers retry webhooks, so the same event can arrive twice, even at the same moment.
   * The deposit row is locked first. The second delivery waits, then sees "confirmed" and does nothing.
   * The credit and the status change happen in one transaction.
   */
  async execute(command: HandleWebhookCommand): Promise<WebhookOutcome> {
    if (!command.signature || !this.signer.verify(command.rawBody, command.signature)) {
      throw new InvalidWebhookSignatureError();
    }
    const { event } = command;
    const received = Money.of(event.amount);

    return this.unitOfWork.run<WebhookOutcome>(async (repos) => {
      const deposit = await repos.deposits.findByAddressForUpdate(event.address);
      if (!deposit) {
        throw new DepositNotFoundError();
      }
      if (deposit.isConfirmed()) {
        return 'already_processed';
      }

      const now = new Date();
      deposit.confirm(received, event.txHash, now);

      const [wallet] = await repos.wallets.lockByUserIds([deposit.userId]);
      wallet.credit(deposit.creditAmount, now);
      await repos.wallets.save(wallet);
      await repos.ledger.insertMany([
        new LedgerEntry({
          id: randomUUID(),
          walletId: wallet.id,
          kind: 'deposit',
          direction: 'credit',
          amount: deposit.creditAmount,
          balanceAfter: wallet.balance,
          referenceId: deposit.id,
          createdAt: now,
        }),
      ]);
      await repos.deposits.save(deposit);
      return 'confirmed';
    });
  }
}

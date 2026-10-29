import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { IdempotencyKeyReuseError } from '../domain/errors';
import { Money } from '../domain/money';
import { Transfer } from '../domain/transfer';
import { performTransfer } from '../domain/transfer-service';
import { UNIT_OF_WORK, UnitOfWork } from '../domain/unit-of-work';

export interface CreateTransferCommand {
  senderUserId: string;
  recipientUserId: string;
  amount: string;
  note?: string;
  idempotencyKey: string;
}

export interface CreateTransferResult {
  transfer: Transfer;
  replayed: boolean;
}

@Injectable()
export class CreateTransferUseCase {
  constructor(@Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork) {}

  async execute(command: CreateTransferCommand): Promise<CreateTransferResult> {
    const amount = Money.of(command.amount);
    Transfer.assertValidRequest(command.senderUserId, command.recipientUserId, amount);

    return this.unitOfWork.run(async (repos) => {
      // 1. Make sure both wallets exist. Sorted order, so two opposite transfers cannot deadlock on the inserts.
      for (const userId of [command.senderUserId, command.recipientUserId].sort()) {
        await repos.wallets.ensureForUser(userId);
      }
      // 2. Lock both wallet rows, always in the same order.
      const locked = await repos.wallets.lockByUserIds([command.senderUserId, command.recipientUserId]);
      const sender = locked.find((wallet) => wallet.userId === command.senderUserId)!;
      const recipient = locked.find((wallet) => wallet.userId === command.recipientUserId)!;

      // 3. Idempotency check after the lock: a retry of the same key waits here and then finds the first result.
      const existing = await repos.transfers.findByIdempotencyKey(command.senderUserId, command.idempotencyKey);
      if (existing) {
        if (!existing.isSameRequest(command.recipientUserId, amount)) {
          throw new IdempotencyKeyReuseError();
        }
        return { transfer: existing, replayed: true };
      }

      // 4. Business rule, then write everything. Any error rolls the whole transaction back.
      const result = performTransfer({
        transferId: randomUUID(),
        senderEntryId: randomUUID(),
        recipientEntryId: randomUUID(),
        sender,
        recipient,
        amount,
        note: command.note ?? null,
        idempotencyKey: command.idempotencyKey,
        now: new Date(),
      });
      await repos.wallets.save(sender);
      await repos.wallets.save(recipient);
      await repos.transfers.insert(result.transfer);
      await repos.ledger.insertMany(result.entries);
      return { transfer: result.transfer, replayed: false };
    });
  }
}

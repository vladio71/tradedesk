import { LedgerEntry } from './ledger-entry';
import { Money } from './money';
import { Transfer } from './transfer';
import { Wallet } from './wallet';

export interface PerformTransferInput {
  transferId: string;
  senderEntryId: string;
  recipientEntryId: string;
  sender: Wallet;
  recipient: Wallet;
  amount: Money;
  note: string | null;
  idempotencyKey: string;
  now: Date;
}

export interface TransferResult {
  transfer: Transfer;
  /** [sender debit, recipient credit] */
  entries: [LedgerEntry, LedgerEntry];
}

/**
 * The business rule of an internal transfer: validate, move the money between two wallets
 * and describe the move as two ledger entries. It changes the wallets in memory only.
 * The caller saves everything in one transaction.
 */
export function performTransfer(input: PerformTransferInput): TransferResult {
  Transfer.assertValidRequest(input.sender.userId, input.recipient.userId, input.amount);

  input.sender.debit(input.amount, input.now);
  input.recipient.credit(input.amount, input.now);

  const transfer = new Transfer({
    id: input.transferId,
    fromUserId: input.sender.userId,
    toUserId: input.recipient.userId,
    fromWalletId: input.sender.id,
    toWalletId: input.recipient.id,
    amount: input.amount,
    status: 'completed',
    note: input.note,
    idempotencyKey: input.idempotencyKey,
    createdAt: input.now,
  });

  const debit = new LedgerEntry({
    id: input.senderEntryId,
    walletId: input.sender.id,
    kind: 'transfer_out',
    direction: 'debit',
    amount: input.amount,
    balanceAfter: input.sender.balance,
    referenceId: transfer.id,
    createdAt: input.now,
  });
  const credit = new LedgerEntry({
    id: input.recipientEntryId,
    walletId: input.recipient.id,
    kind: 'transfer_in',
    direction: 'credit',
    amount: input.amount,
    balanceAfter: input.recipient.balance,
    referenceId: transfer.id,
    createdAt: input.now,
  });
  return { transfer, entries: [debit, credit] };
}

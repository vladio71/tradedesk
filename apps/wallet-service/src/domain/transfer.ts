import { InvalidMoneyError, SelfTransferError } from './errors';
import { Money } from './money';

export type TransferStatus = 'completed';

export interface TransferProps {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromWalletId: string;
  toWalletId: string;
  amount: Money;
  status: TransferStatus;
  note: string | null;
  idempotencyKey: string;
  createdAt: Date;
}

export class Transfer {
  readonly id: string;
  readonly fromUserId: string;
  readonly toUserId: string;
  readonly fromWalletId: string;
  readonly toWalletId: string;
  readonly amount: Money;
  readonly status: TransferStatus;
  readonly note: string | null;
  readonly idempotencyKey: string;
  readonly createdAt: Date;

  constructor(props: TransferProps) {
    this.id = props.id;
    this.fromUserId = props.fromUserId;
    this.toUserId = props.toUserId;
    this.fromWalletId = props.fromWalletId;
    this.toWalletId = props.toWalletId;
    this.amount = props.amount;
    this.status = props.status;
    this.note = props.note;
    this.idempotencyKey = props.idempotencyKey;
    this.createdAt = props.createdAt;
  }

  static assertValidRequest(fromUserId: string, toUserId: string, amount: Money): void {
    if (fromUserId === toUserId) {
      throw new SelfTransferError();
    }
    if (!amount.isPositive()) {
      throw new InvalidMoneyError('Transfer amount must be greater than zero');
    }
  }

  /** True when a retry with the same Idempotency-Key asks for the same thing. */
  isSameRequest(toUserId: string, amount: Money): boolean {
    return this.toUserId === toUserId && this.amount.equals(amount);
  }
}

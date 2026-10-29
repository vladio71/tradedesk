import { Money } from './money';

export type LedgerKind = 'deposit' | 'transfer_in' | 'transfer_out';
export type LedgerDirection = 'credit' | 'debit';

export const LEDGER_KINDS: LedgerKind[] = ['deposit', 'transfer_in', 'transfer_out'];

export interface LedgerEntryProps {
  id: string;
  walletId: string;
  kind: LedgerKind;
  direction: LedgerDirection;
  amount: Money;
  /** Wallet balance right after this entry was applied. */
  balanceAfter: Money;
  /** The deposit or transfer that caused the entry. */
  referenceId: string;
  createdAt: Date;
}

/** One line of the wallet history. Every balance change writes exactly one line. */
export class LedgerEntry {
  readonly id: string;
  readonly walletId: string;
  readonly kind: LedgerKind;
  readonly direction: LedgerDirection;
  readonly amount: Money;
  readonly balanceAfter: Money;
  readonly referenceId: string;
  readonly createdAt: Date;

  constructor(props: LedgerEntryProps) {
    this.id = props.id;
    this.walletId = props.walletId;
    this.kind = props.kind;
    this.direction = props.direction;
    this.amount = props.amount;
    this.balanceAfter = props.balanceAfter;
    this.referenceId = props.referenceId;
    this.createdAt = props.createdAt;
  }

  static directionOf(kind: LedgerKind): LedgerDirection {
    return kind === 'transfer_out' ? 'debit' : 'credit';
  }
}

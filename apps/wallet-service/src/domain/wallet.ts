import { InsufficientFundsError, InvalidMoneyError } from './errors';
import { Money } from './money';

export interface WalletProps {
  id: string;
  userId: string;
  balance: Money;
  createdAt: Date;
  updatedAt: Date;
}

/** One wallet per user. The balance can never go below zero. */
export class Wallet {
  readonly id: string;
  readonly userId: string;
  readonly createdAt: Date;
  balance: Money;
  updatedAt: Date;

  constructor(props: WalletProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.balance = props.balance;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static open(id: string, userId: string, now: Date): Wallet {
    return new Wallet({ id, userId, balance: Money.zero(), createdAt: now, updatedAt: now });
  }

  credit(amount: Money, now: Date): void {
    this.assertPositive(amount);
    this.balance = this.balance.add(amount);
    this.updatedAt = now;
  }

  debit(amount: Money, now: Date): void {
    this.assertPositive(amount);
    if (this.balance.isLessThan(amount)) {
      throw new InsufficientFundsError();
    }
    this.balance = this.balance.subtract(amount);
    this.updatedAt = now;
  }

  private assertPositive(amount: Money): void {
    if (!amount.isPositive()) {
      throw new InvalidMoneyError('Amount must be greater than zero');
    }
  }
}

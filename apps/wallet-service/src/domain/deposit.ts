import { DepositAmountMismatchError, DepositNotPendingError, InvalidMoneyError } from './errors';
import { Money } from './money';

export type CryptoAsset = 'BTC' | 'ETH' | 'USDT';
export const CRYPTO_ASSETS: CryptoAsset[] = ['BTC', 'ETH', 'USDT'];
export type DepositStatus = 'pending' | 'confirmed';

export interface DepositProps {
  id: string;
  userId: string;
  walletId: string;
  asset: CryptoAsset;
  /** Amount in the crypto asset. */
  amount: Money;
  /** USD price of one unit of the asset, fixed when the deposit is requested. */
  usdRate: string;
  /** What the wallet receives (USD). amount * usdRate. */
  creditAmount: Money;
  address: string;
  txHash: string | null;
  status: DepositStatus;
  idempotencyKey: string;
  createdAt: Date;
  confirmedAt: Date | null;
}

export class Deposit {
  readonly id: string;
  readonly userId: string;
  readonly walletId: string;
  readonly asset: CryptoAsset;
  readonly amount: Money;
  readonly usdRate: string;
  readonly creditAmount: Money;
  readonly address: string;
  readonly idempotencyKey: string;
  readonly createdAt: Date;
  txHash: string | null;
  status: DepositStatus;
  confirmedAt: Date | null;

  constructor(props: DepositProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.walletId = props.walletId;
    this.asset = props.asset;
    this.amount = props.amount;
    this.usdRate = props.usdRate;
    this.creditAmount = props.creditAmount;
    this.address = props.address;
    this.txHash = props.txHash;
    this.status = props.status;
    this.idempotencyKey = props.idempotencyKey;
    this.createdAt = props.createdAt;
    this.confirmedAt = props.confirmedAt;
  }

  static request(input: {
    id: string;
    userId: string;
    walletId: string;
    asset: CryptoAsset;
    amount: Money;
    usdRate: string;
    address: string;
    idempotencyKey: string;
    now: Date;
  }): Deposit {
    Deposit.assertValidAmount(input.amount);
    const usdRate = Money.of(input.usdRate);
    const creditAmount = input.amount.multiply(usdRate.toString());
    if (!creditAmount.isPositive()) {
      throw new InvalidMoneyError('Deposit is too small: it is worth less than 0.00000001 USD');
    }
    return new Deposit({
      id: input.id,
      userId: input.userId,
      walletId: input.walletId,
      asset: input.asset,
      amount: input.amount,
      usdRate: usdRate.toString(),
      creditAmount,
      address: input.address,
      txHash: null,
      status: 'pending',
      idempotencyKey: input.idempotencyKey,
      createdAt: input.now,
      confirmedAt: null,
    });
  }

  static assertValidAmount(amount: Money): void {
    if (!amount.isPositive()) {
      throw new InvalidMoneyError('Deposit amount must be greater than zero');
    }
  }

  isConfirmed(): boolean {
    return this.status === 'confirmed';
  }

  /** Marks the deposit as paid. The wallet credit is done by the caller in the same transaction. */
  confirm(receivedAmount: Money, txHash: string, now: Date): void {
    if (this.status !== 'pending') {
      throw new DepositNotPendingError();
    }
    if (!receivedAmount.equals(this.amount)) {
      throw new DepositAmountMismatchError();
    }
    this.status = 'confirmed';
    this.txHash = txHash;
    this.confirmedAt = now;
  }
}

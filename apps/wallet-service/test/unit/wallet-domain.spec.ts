import { Deposit } from '../../src/domain/deposit';
import {
  DepositAmountMismatchError,
  DepositNotPendingError,
  InsufficientFundsError,
  InvalidMoneyError,
  SelfTransferError,
} from '../../src/domain/errors';
import { Money } from '../../src/domain/money';
import { Transfer } from '../../src/domain/transfer';
import { performTransfer } from '../../src/domain/transfer-service';
import { Wallet } from '../../src/domain/wallet';

const now = new Date('2026-01-01T00:00:00Z');

function walletWith(userId: string, balance: string): Wallet {
  const wallet = Wallet.open(`wallet-${userId}`, userId, now);
  if (balance !== '0') {
    wallet.credit(Money.of(balance), now);
  }
  return wallet;
}

describe('Wallet', () => {
  it('credits and debits', () => {
    const wallet = walletWith('u1', '10');
    wallet.debit(Money.of('2.5'), now);
    expect(wallet.balance.toString()).toBe('7.50000000');
  });

  it('never goes below zero', () => {
    const wallet = walletWith('u1', '1');
    expect(() => wallet.debit(Money.of('1.00000001'), now)).toThrow(InsufficientFundsError);
    expect(wallet.balance.toString()).toBe('1.00000000');
  });

  it('can spend the full balance', () => {
    const wallet = walletWith('u1', '1');
    wallet.debit(Money.of('1'), now);
    expect(wallet.balance.isZero()).toBe(true);
  });

  it('refuses zero and negative amounts', () => {
    const wallet = walletWith('u1', '1');
    expect(() => wallet.credit(Money.zero(), now)).toThrow(InvalidMoneyError);
    expect(() => wallet.debit(Money.of('-1'), now)).toThrow(InvalidMoneyError);
  });
});

describe('performTransfer', () => {
  function run(sender: Wallet, recipient: Wallet, amount: string) {
    return performTransfer({
      transferId: 't1',
      senderEntryId: 'e1',
      recipientEntryId: 'e2',
      sender,
      recipient,
      amount: Money.of(amount),
      note: null,
      idempotencyKey: 'key-12345',
      now,
    });
  }

  it('moves money and writes two matching ledger entries', () => {
    const sender = walletWith('a', '100');
    const recipient = walletWith('b', '5');
    const { transfer, entries } = run(sender, recipient, '30.25');

    expect(sender.balance.toString()).toBe('69.75000000');
    expect(recipient.balance.toString()).toBe('35.25000000');
    expect(transfer.status).toBe('completed');

    const [debit, credit] = entries;
    expect(debit.direction).toBe('debit');
    expect(debit.balanceAfter.toString()).toBe('69.75000000');
    expect(credit.direction).toBe('credit');
    expect(credit.balanceAfter.toString()).toBe('35.25000000');
    expect(debit.referenceId).toBe(transfer.id);
    expect(credit.referenceId).toBe(transfer.id);
  });

  it('keeps the total amount of money the same', () => {
    const sender = walletWith('a', '100');
    const recipient = walletWith('b', '0.1');
    run(sender, recipient, '33.33333333');
    expect(sender.balance.add(recipient.balance).toString()).toBe('100.10000000');
  });

  it('fails without changing anything when funds are too low', () => {
    const sender = walletWith('a', '10');
    const recipient = walletWith('b', '0');
    expect(() => run(sender, recipient, '10.00000001')).toThrow(InsufficientFundsError);
    expect(sender.balance.toString()).toBe('10.00000000');
    expect(recipient.balance.toString()).toBe('0.00000000');
  });

  it('refuses a transfer to yourself', () => {
    const wallet = walletWith('a', '10');
    expect(() => run(wallet, wallet, '1')).toThrow(SelfTransferError);
  });
});

describe('Transfer', () => {
  it('knows whether a retry asks for the same thing', () => {
    const transfer = new Transfer({
      id: 't',
      fromUserId: 'a',
      toUserId: 'b',
      fromWalletId: 'wa',
      toWalletId: 'wb',
      amount: Money.of('5'),
      status: 'completed',
      note: null,
      idempotencyKey: 'key-12345',
      createdAt: now,
    });
    expect(transfer.isSameRequest('b', Money.of('5.0'))).toBe(true);
    expect(transfer.isSameRequest('c', Money.of('5'))).toBe(false);
    expect(transfer.isSameRequest('b', Money.of('6'))).toBe(false);
  });
});

describe('Deposit', () => {
  function pending(): Deposit {
    return Deposit.request({
      id: 'd1',
      userId: 'u1',
      walletId: 'w1',
      asset: 'BTC',
      amount: Money.of('0.01'),
      usdRate: '60000',
      address: 'addr',
      idempotencyKey: 'key-12345',
      now,
    });
  }

  it('fixes the USD credit when requested', () => {
    expect(pending().creditAmount.toString()).toBe('600.00000000');
  });

  it('confirms once', () => {
    const deposit = pending();
    deposit.confirm(Money.of('0.01'), 'tx1', now);
    expect(deposit.isConfirmed()).toBe(true);
    expect(() => deposit.confirm(Money.of('0.01'), 'tx1', now)).toThrow(DepositNotPendingError);
  });

  it('refuses a zero amount', () => {
    expect(() =>
      Deposit.request({ id: 'd', userId: 'u', walletId: 'w', asset: 'USDT', amount: Money.zero(), usdRate: '1', address: 'a', idempotencyKey: 'k', now }),
    ).toThrow(InvalidMoneyError);
  });

  it('stores the rate in the same format as the database', () => {
    expect(pending().usdRate).toBe('60000.00000000');
  });

  it('refuses a different amount', () => {
    expect(() => pending().confirm(Money.of('0.02'), 'tx1', now)).toThrow(DepositAmountMismatchError);
  });
});

import Decimal from 'decimal.js';
import { InvalidMoneyError } from './errors';

/** Own Decimal copy so we never touch the global decimal.js settings. Cuts extra digits instead of rounding up. */
const Dec = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_DOWN });

const SCALE = 8;
const MONEY_PATTERN = /^-?\d{1,12}(\.\d{1,8})?$/;
const LIMIT = new Dec('1e12');

/**
 * Value object for amounts. Built only from decimal strings, never from JS numbers.
 * It matches the database type numeric(20,8): 12 integer digits, 8 decimals.
 */
export class Money {
  private constructor(private readonly value: Decimal) {}

  static zero(): Money {
    return new Money(new Dec(0));
  }

  static of(raw: string): Money {
    if (typeof raw !== 'string' || !MONEY_PATTERN.test(raw)) {
      throw new InvalidMoneyError(`"${String(raw)}" is not a valid amount. Use a decimal string with up to 8 decimals`);
    }
    return new Money(new Dec(raw));
  }

  add(other: Money): Money {
    return Money.checked(this.value.plus(other.value));
  }

  subtract(other: Money): Money {
    return Money.checked(this.value.minus(other.value));
  }

  /** Multiplies by a decimal string (for example an exchange rate) and cuts to 8 decimals. */
  multiply(factor: string): Money {
    return Money.checked(this.value.times(new Dec(factor)).toDecimalPlaces(SCALE, Decimal.ROUND_DOWN));
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  isPositive(): boolean {
    return this.value.isPositive() && !this.value.isZero();
  }

  isNegative(): boolean {
    return this.value.isNegative() && !this.value.isZero();
  }

  isLessThan(other: Money): boolean {
    return this.value.lessThan(other.value);
  }

  equals(other: Money): boolean {
    return this.value.equals(other.value);
  }

  /** Always 8 decimals, for example "12.50000000". */
  toString(): string {
    return this.value.toFixed(SCALE);
  }

  private static checked(value: Decimal): Money {
    if (value.abs().greaterThanOrEqualTo(LIMIT)) {
      throw new InvalidMoneyError('Amount is too large');
    }
    return new Money(value);
  }
}

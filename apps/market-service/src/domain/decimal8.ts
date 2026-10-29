import Decimal from 'decimal.js';
import { InvalidDecimalError } from './errors';

const Dec = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_DOWN });
const PATTERN = /^-?\d{1,12}(\.\d{1,8})?$/;

/** Decimal number with up to 8 decimals, matching numeric(20,8). Built from strings only, never from JS numbers. */
export class Decimal8 {
  private constructor(private readonly value: Decimal) {}

  /** Any decimal string, may be negative or zero. */
  static of(raw: string): Decimal8 {
    if (typeof raw !== 'string' || !PATTERN.test(raw)) {
      throw new InvalidDecimalError(`"${String(raw)}" is not a valid decimal string with up to 8 decimals`);
    }
    return new Decimal8(new Dec(raw));
  }

  /** A decimal string that must be greater than zero (prices, quantities). */
  static positive(raw: string): Decimal8 {
    const value = Decimal8.of(raw);
    if (!value.isPositive()) {
      throw new InvalidDecimalError(`"${raw}" must be greater than zero`);
    }
    return value;
  }

  plus(other: Decimal8): Decimal8 {
    return new Decimal8(this.value.plus(other.value));
  }

  minus(other: Decimal8): Decimal8 {
    return new Decimal8(this.value.minus(other.value));
  }

  /** Multiplies by a decimal string. The result is cut to 8 decimals. */
  times(factor: Decimal8 | string): Decimal8 {
    const other = typeof factor === 'string' ? new Dec(factor) : factor.value;
    return new Decimal8(this.value.times(other).toDecimalPlaces(8, Decimal.ROUND_DOWN));
  }

  isPositive(): boolean {
    return this.value.greaterThan(0);
  }

  isLessThan(other: Decimal8): boolean {
    return this.value.lessThan(other.value);
  }

  equals(other: Decimal8): boolean {
    return this.value.equals(other.value);
  }

  toString(): string {
    return this.value.toFixed(8);
  }
}

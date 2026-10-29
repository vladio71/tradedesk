import { InvalidMoneyError } from '../../src/domain/errors';
import { Money } from '../../src/domain/money';

describe('Money', () => {
  it('does not have floating point errors', () => {
    // 0.1 + 0.2 is 0.30000000000000004 with JS numbers.
    expect(Money.of('0.1').add(Money.of('0.2')).toString()).toBe('0.30000000');
    expect(Money.of('1.1').subtract(Money.of('1.0')).toString()).toBe('0.10000000');
  });

  it('always prints 8 decimals', () => {
    expect(Money.of('12.5').toString()).toBe('12.50000000');
    expect(Money.zero().toString()).toBe('0.00000000');
  });

  it('multiplies by a rate and cuts extra decimals', () => {
    expect(Money.of('0.015').multiply('60000').toString()).toBe('900.00000000');
    expect(Money.of('0.00000001').multiply('0.5').toString()).toBe('0.00000000');
  });

  it.each(['abc', '1.123456789', '', '1e5', '--1', '1,5', '9999999999999'])('rejects "%s"', (raw) => {
    expect(() => Money.of(raw)).toThrow(InvalidMoneyError);
  });

  it('rejects JS numbers even if the type system is bypassed', () => {
    expect(() => Money.of(0.1 as unknown as string)).toThrow(InvalidMoneyError);
  });

  it('refuses amounts that would not fit numeric(20,8)', () => {
    expect(() => Money.of('999999999999').add(Money.of('1'))).toThrow(InvalidMoneyError);
  });

  it('compares values', () => {
    expect(Money.of('1.0').equals(Money.of('1.00000000'))).toBe(true);
    expect(Money.of('1').isLessThan(Money.of('2'))).toBe(true);
    expect(Money.of('-1').isNegative()).toBe(true);
    expect(Money.zero().isPositive()).toBe(false);
  });
});

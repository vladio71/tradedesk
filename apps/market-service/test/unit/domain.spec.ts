import { Asset } from '../../src/domain/asset';
import { Decimal8 } from '../../src/domain/decimal8';
import { AssetNotTradableError, InvalidDecimalError, PositionAlreadyClosedError } from '../../src/domain/errors';
import { nextPrice } from '../../src/domain/price-walk';
import { Position, PositionSide } from '../../src/domain/position';
import { TickBatcher, filterForSubscriber } from '../../src/interfaces/ws/tick-batcher';

const now = new Date('2026-01-01T00:00:00Z');

function asset(price: string, status: 'active' | 'halted' | 'delisted' = 'active'): Asset {
  return Asset.create({ id: 'a1', symbol: ' btc ', name: 'Bitcoin', category: 'crypto', status, lastPrice: price, now });
}

function open(side: PositionSide, entry: string, quantity: string): Position {
  return Position.open({ id: 'p1', userId: 'u1', asset: asset(entry), side, quantity, now });
}

describe('Decimal8', () => {
  it('has no floating point errors', () => {
    expect(Decimal8.of('0.1').plus(Decimal8.of('0.2')).toString()).toBe('0.30000000');
  });

  it('requires positive values when asked', () => {
    expect(() => Decimal8.positive('0')).toThrow(InvalidDecimalError);
    expect(() => Decimal8.positive('-1')).toThrow(InvalidDecimalError);
    expect(() => Decimal8.of('1.123456789')).toThrow(InvalidDecimalError);
  });
});

describe('Asset', () => {
  it('normalizes the symbol', () => {
    expect(asset('10').symbol).toBe('BTC');
  });

  it('is tradable only when active', () => {
    expect(asset('10', 'active').isTradable()).toBe(true);
    expect(asset('10', 'halted').isTradable()).toBe(false);
    expect(asset('10', 'delisted').isTradable()).toBe(false);
  });
});

describe('Position', () => {
  it('opens at the current price of the asset', () => {
    const position = open('long', '100.5', '2');
    expect(position.entryPrice.toString()).toBe('100.50000000');
    expect(position.status).toBe('open');
    expect(position.pnl).toBeNull();
  });

  it('refuses to open on a halted asset', () => {
    expect(() => Position.open({ id: 'p', userId: 'u', asset: asset('10', 'halted'), side: 'long', quantity: '1', now })).toThrow(AssetNotTradableError);
  });

  it('long makes money when the price goes up', () => {
    const position = open('long', '100', '2');
    position.close(Decimal8.of('110.5'), now);
    expect(position.pnl!.toString()).toBe('21.00000000');
    expect(position.status).toBe('closed');
    expect(position.closedPrice!.toString()).toBe('110.50000000');
  });

  it('long loses money when the price goes down', () => {
    const position = open('long', '100', '2');
    position.close(Decimal8.of('90'), now);
    expect(position.pnl!.toString()).toBe('-20.00000000');
  });

  it('short makes money when the price goes down', () => {
    const position = open('short', '100', '3');
    position.close(Decimal8.of('90'), now);
    expect(position.pnl!.toString()).toBe('30.00000000');
  });

  it('short loses money when the price goes up', () => {
    const position = open('short', '100', '3');
    position.close(Decimal8.of('101.5'), now);
    expect(position.pnl!.toString()).toBe('-4.50000000');
  });

  it('computes pnl with decimals exactly', () => {
    const position = open('long', '0.1', '3');
    expect(position.pnlAt(Decimal8.of('0.2')).toString()).toBe('0.30000000');
  });

  it('cannot be closed twice', () => {
    const position = open('long', '100', '1');
    position.close(Decimal8.of('101'), now);
    expect(() => position.close(Decimal8.of('102'), now)).toThrow(PositionAlreadyClosedError);
    expect(position.pnl!.toString()).toBe('1.00000000');
  });
});

describe('nextPrice', () => {
  it('moves up with a high random value and down with a low one', () => {
    const price = Decimal8.of('100');
    expect(nextPrice(price, 0.75).isLessThan(price)).toBe(false);
    expect(nextPrice(price, 0.25).isLessThan(price)).toBe(true);
    expect(nextPrice(price, 0.5).equals(price)).toBe(true);
  });

  it('stays within 0.5 percent', () => {
    const price = Decimal8.of('200');
    expect(nextPrice(price, 0).toString()).toBe('199.00000000');
    expect(nextPrice(price, 0.5).toString()).toBe('200.00000000');
  });

  it('never reaches zero', () => {
    expect(nextPrice(Decimal8.of('0.00000001'), 0).isPositive()).toBe(true);
  });
});

describe('TickBatcher', () => {
  const tick = (symbol: string, price: string) => ({ assetId: symbol, symbol, price, ts: now });

  it('keeps the newest tick per symbol and empties after drain', () => {
    const batcher = new TickBatcher();
    batcher.add([tick('BTC', '1'), tick('ETH', '2')]);
    batcher.add([tick('BTC', '3')]);
    const batch = batcher.drain();
    expect(batch).toHaveLength(2);
    expect(batch.find((message) => message.symbol === 'BTC')!.price).toBe('3');
    expect(batcher.drain()).toHaveLength(0);
  });

  it('filters by subscription', () => {
    const batcher = new TickBatcher();
    batcher.add([tick('BTC', '1'), tick('ETH', '2')]);
    const mine = filterForSubscriber(batcher.drain(), new Set(['ETH']));
    expect(mine.map((message) => message.symbol)).toEqual(['ETH']);
  });
});

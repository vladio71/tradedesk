import { BulkDeleteAssetsUseCase, BulkSetAssetStatusUseCase, BulkUpsertAssetsUseCase } from '../../src/application/bulk-assets.use-cases';
import { ClosePositionUseCase } from '../../src/application/close-position.use-case';
import { OpenPositionUseCase } from '../../src/application/open-position.use-case';
import { SimulatePricesUseCase } from '../../src/application/simulate-prices.use-case';
import { Decimal8 } from '../../src/domain/decimal8';
import {
  AssetNotFoundError,
  AssetNotTradableError,
  AssetsMissingError,
  DuplicateSymbolsInBatchError,
  PositionAlreadyClosedError,
  PositionNotFoundError,
} from '../../src/domain/errors';
import { InMemoryUnitOfWork, RecordingPublisher } from './fakes';

const USER = 'user-1';

describe('OpenPositionUseCase / ClosePositionUseCase', () => {
  function setup() {
    const unitOfWork = new InMemoryUnitOfWork();
    unitOfWork.addAsset('BTC', '100');
    unitOfWork.addAsset('HALT', '10', 'halted');
    return { unitOfWork, open: new OpenPositionUseCase(unitOfWork), close: new ClosePositionUseCase(unitOfWork) };
  }

  it('opens at the last price (symbol is case-insensitive)', async () => {
    const { open } = setup();
    const position = await open.execute({ userId: USER, symbol: 'btc', side: 'long', quantity: '2' });
    expect(position.entryPrice.toString()).toBe('100.00000000');
    expect(position.symbol).toBe('BTC');
  });

  it('refuses halted assets and unknown symbols', async () => {
    const { open } = setup();
    await expect(open.execute({ userId: USER, symbol: 'HALT', side: 'long', quantity: '1' })).rejects.toThrow(AssetNotTradableError);
    await expect(open.execute({ userId: USER, symbol: 'NOPE', side: 'long', quantity: '1' })).rejects.toThrow(AssetNotFoundError);
  });

  it('closes at the current price and stores pnl', async () => {
    const { unitOfWork, open, close } = setup();
    const position = await open.execute({ userId: USER, symbol: 'BTC', side: 'short', quantity: '2' });
    unitOfWork.assets.items.get('id-BTC')!.lastPrice = Decimal8.of('90');

    const closed = await close.execute(USER, position.id);
    expect(closed.status).toBe('closed');
    expect(closed.pnl!.toString()).toBe('20.00000000');
  });

  it('cannot close twice, and cannot close someone else position', async () => {
    const { open, close } = setup();
    const position = await open.execute({ userId: USER, symbol: 'BTC', side: 'long', quantity: '1' });
    await close.execute(USER, position.id);
    await expect(close.execute(USER, position.id)).rejects.toThrow(PositionAlreadyClosedError);
    await expect(close.execute('other-user', position.id)).rejects.toThrow(PositionNotFoundError);
  });
});

describe('bulk asset use cases', () => {
  const item = (symbol: string) => ({ symbol, name: symbol, category: 'stock' as const, lastPrice: '10' });

  it('upsert counts created and updated', async () => {
    const unitOfWork = new InMemoryUnitOfWork();
    unitOfWork.addAsset('AAPL', '5');
    const result = await new BulkUpsertAssetsUseCase(unitOfWork).execute([item('aapl'), item('MSFT'), item('GOOG')]);
    expect(result).toEqual({ created: 2, updated: 1 });
  });

  it('upsert refuses a batch where one symbol appears twice', async () => {
    const unitOfWork = new InMemoryUnitOfWork();
    await expect(new BulkUpsertAssetsUseCase(unitOfWork).execute([item('AAPL'), item('aapl')])).rejects.toThrow(DuplicateSymbolsInBatchError);
  });

  it('set status reports the number of affected rows', async () => {
    const unitOfWork = new InMemoryUnitOfWork();
    const a = unitOfWork.addAsset('A', '1');
    const b = unitOfWork.addAsset('B', '1');
    const result = await new BulkSetAssetStatusUseCase(unitOfWork).execute([a.id, b.id, a.id], 'halted');
    expect(result.affected).toBe(2);
    expect(a.status).toBe('halted');
  });

  it('set status fails with the missing ids (the real repository rolls back the transaction)', async () => {
    const unitOfWork = new InMemoryUnitOfWork();
    const a = unitOfWork.addAsset('A', '1');
    await expect(new BulkSetAssetStatusUseCase(unitOfWork).execute([a.id, 'missing-id'], 'halted')).rejects.toThrow(AssetsMissingError);
  });

  it('delete returns the affected count', async () => {
    const unitOfWork = new InMemoryUnitOfWork();
    const a = unitOfWork.addAsset('A', '1');
    expect(await new BulkDeleteAssetsUseCase(unitOfWork).execute([a.id, 'missing'])).toEqual({ affected: 1 });
  });
});

describe('SimulatePricesUseCase', () => {
  it('updates all active assets with one bulk call, stores ticks and publishes them', async () => {
    const unitOfWork = new InMemoryUnitOfWork();
    unitOfWork.addAsset('A', '100');
    unitOfWork.addAsset('B', '200');
    unitOfWork.addAsset('H', '300', 'halted');
    const publisher = new RecordingPublisher();

    const count = await new SimulatePricesUseCase(unitOfWork, publisher, () => 1).execute();

    expect(count).toBe(2);
    expect(unitOfWork.assets.priceUpdateCalls).toBe(1);
    expect(unitOfWork.ticks.items).toHaveLength(2);
    expect(publisher.published).toHaveLength(1);
    expect(unitOfWork.assets.items.get('id-H')!.lastPrice.toString()).toBe('300.00000000');
    expect(unitOfWork.assets.items.get('id-A')!.lastPrice.isLessThan(Decimal8.of('100'))).toBe(false);
  });

  it('does nothing without active assets', async () => {
    const publisher = new RecordingPublisher();
    const count = await new SimulatePricesUseCase(new InMemoryUnitOfWork(), publisher, () => 0.5).execute();
    expect(count).toBe(0);
    expect(publisher.published).toHaveLength(0);
  });
});

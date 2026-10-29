import { buildPage, Page } from '@tradedesk/common';
import { Asset, AssetStatus } from '../../src/domain/asset';
import { AssetRepository, AssetSearchFilter, AssetUpsertRow, PriceUpdate } from '../../src/domain/asset.repository';
import { Decimal8 } from '../../src/domain/decimal8';
import { SymbolAlreadyExistsError } from '../../src/domain/errors';
import { TickPublisher } from '../../src/domain/ports';
import { Position } from '../../src/domain/position';
import { PnlSummaryRow, PositionFilter, PositionRepository } from '../../src/domain/position.repository';
import { Candle, PriceTick } from '../../src/domain/tick';
import { CandleQuery, TickRepository } from '../../src/domain/tick.repository';
import { MarketRepositories, UnitOfWork } from '../../src/domain/unit-of-work';

export class InMemoryAssetRepository implements AssetRepository {
  readonly items = new Map<string, Asset>();
  priceUpdateCalls = 0;

  async findBySymbol(symbol: string): Promise<Asset | null> {
    return [...this.items.values()].find((asset) => asset.symbol === symbol && !asset.deletedAt) ?? null;
  }

  async findById(id: string): Promise<Asset | null> {
    const asset = this.items.get(id);
    return asset && !asset.deletedAt ? asset : null;
  }

  async search(filter: AssetSearchFilter): Promise<Page<Asset>> {
    const rows = [...this.items.values()].filter((asset) => !asset.deletedAt);
    return buildPage(rows, rows.length, filter);
  }

  async listActive(): Promise<Asset[]> {
    return [...this.items.values()].filter((asset) => asset.status === 'active' && !asset.deletedAt);
  }

  async insert(asset: Asset): Promise<void> {
    if (await this.findBySymbol(asset.symbol)) throw new SymbolAlreadyExistsError(asset.symbol);
    this.items.set(asset.id, asset);
  }

  async update(asset: Asset): Promise<void> {
    this.items.set(asset.id, asset);
  }

  async bulkUpsert(rows: AssetUpsertRow[], now: Date): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;
    for (const row of rows) {
      const existing = [...this.items.values()].find((asset) => asset.symbol === row.symbol);
      if (existing) {
        existing.applyChanges({ name: row.name, category: row.category, status: row.status }, now);
        existing.lastPrice = Decimal8.of(row.lastPrice);
        updated += 1;
      } else {
        const asset = Asset.create({ id: `id-${this.items.size + 1}`, ...row, now });
        this.items.set(asset.id, asset);
        created += 1;
      }
    }
    return { created, updated };
  }

  async bulkSetStatus(ids: string[], status: AssetStatus, now: Date): Promise<string[]> {
    const found = ids.filter((id) => this.items.has(id));
    found.forEach((id) => this.items.get(id)!.applyChanges({ status }, now));
    return found;
  }

  async bulkSoftDelete(ids: string[], now: Date): Promise<number> {
    const found = ids.filter((id) => this.items.has(id));
    found.forEach((id) => (this.items.get(id)!.deletedAt = now));
    return found.length;
  }

  async applyPrices(updates: PriceUpdate[]): Promise<void> {
    this.priceUpdateCalls += 1;
    updates.forEach((update) => (this.items.get(update.assetId)!.lastPrice = Decimal8.of(update.price)));
  }
}

export class InMemoryTickRepository implements TickRepository {
  readonly items: PriceTick[] = [];

  async insertMany(ticks: PriceTick[]): Promise<void> {
    this.items.push(...ticks);
  }

  async candles(_query: CandleQuery): Promise<Candle[]> {
    return [];
  }
}

export class InMemoryPositionRepository implements PositionRepository {
  readonly items = new Map<string, Position>();

  async insert(position: Position): Promise<void> {
    this.items.set(position.id, position);
  }

  async findByIdForUpdate(id: string, userId: string): Promise<Position | null> {
    const position = this.items.get(id);
    return position && position.userId === userId ? position : null;
  }

  async save(position: Position): Promise<void> {
    this.items.set(position.id, position);
  }

  async list(filter: PositionFilter): Promise<Page<Position>> {
    const rows = [...this.items.values()].filter((p) => p.userId === filter.userId);
    return buildPage(rows, rows.length, filter);
  }

  async summary(): Promise<PnlSummaryRow[]> {
    return [];
  }
}

export class InMemoryUnitOfWork implements UnitOfWork {
  readonly assets = new InMemoryAssetRepository();
  readonly ticks = new InMemoryTickRepository();
  readonly positions = new InMemoryPositionRepository();

  run<T>(work: (repositories: MarketRepositories) => Promise<T>): Promise<T> {
    return work({ assets: this.assets, ticks: this.ticks, positions: this.positions });
  }

  addAsset(symbol: string, price: string, status: AssetStatus = 'active'): Asset {
    const asset = Asset.create({ id: `id-${symbol}`, symbol, name: symbol, category: 'crypto', status, lastPrice: price, now: new Date() });
    this.assets.items.set(asset.id, asset);
    return asset;
  }
}

export class RecordingPublisher implements TickPublisher {
  readonly published: PriceTick[][] = [];

  publish(ticks: PriceTick[]): void {
    this.published.push(ticks);
  }
}

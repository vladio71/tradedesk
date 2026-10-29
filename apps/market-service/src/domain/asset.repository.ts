import { Page, PageRequest } from '@tradedesk/common';
import { Asset, AssetCategory, AssetStatus } from './asset';

export const ASSET_REPOSITORY = Symbol('ASSET_REPOSITORY');

export type AssetSortField = 'symbol' | 'name' | 'lastPrice' | 'updatedAt';

export interface AssetSearchFilter extends PageRequest {
  q?: string;
  category?: AssetCategory;
  status?: AssetStatus;
  minPrice?: string;
  maxPrice?: string;
  sort: AssetSortField;
  order: 'asc' | 'desc';
}

export interface AssetUpsertRow {
  symbol: string;
  name: string;
  category: AssetCategory;
  status: AssetStatus;
  lastPrice: string;
}

export interface PriceUpdate {
  assetId: string;
  price: string;
}

export interface AssetRepository {
  findBySymbol(symbol: string): Promise<Asset | null>;
  findById(id: string): Promise<Asset | null>;
  search(filter: AssetSearchFilter): Promise<Page<Asset>>;
  /** Active, not deleted. Used by the price simulator. */
  listActive(): Promise<Asset[]>;
  /** Throws SymbolAlreadyExistsError when the symbol is taken. */
  insert(asset: Asset): Promise<void>;
  update(asset: Asset): Promise<void>;
  /** One INSERT ... ON CONFLICT statement. Revives soft deleted rows. */
  bulkUpsert(rows: AssetUpsertRow[], now: Date): Promise<{ created: number; updated: number }>;
  /** Returns the ids that were really updated. */
  bulkSetStatus(ids: string[], status: AssetStatus, now: Date): Promise<string[]>;
  /** Soft delete. Returns the number of rows affected. */
  bulkSoftDelete(ids: string[], now: Date): Promise<number>;
  /** One UPDATE ... FROM (VALUES ...) statement for all prices. */
  applyPrices(updates: PriceUpdate[], now: Date): Promise<void>;
}

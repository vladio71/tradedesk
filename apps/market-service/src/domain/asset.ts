import { Decimal8 } from './decimal8';

export type AssetCategory = 'crypto' | 'stock' | 'forex' | 'commodity';
export type AssetStatus = 'active' | 'halted' | 'delisted';

export const ASSET_CATEGORIES: AssetCategory[] = ['crypto', 'stock', 'forex', 'commodity'];
export const ASSET_STATUSES: AssetStatus[] = ['active', 'halted', 'delisted'];

export interface AssetProps {
  id: string;
  symbol: string;
  name: string;
  category: AssetCategory;
  status: AssetStatus;
  lastPrice: Decimal8;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class Asset {
  readonly id: string;
  readonly symbol: string;
  readonly createdAt: Date;
  name: string;
  category: AssetCategory;
  status: AssetStatus;
  lastPrice: Decimal8;
  updatedAt: Date;
  deletedAt: Date | null;

  constructor(props: AssetProps) {
    this.id = props.id;
    this.symbol = props.symbol;
    this.name = props.name;
    this.category = props.category;
    this.status = props.status;
    this.lastPrice = props.lastPrice;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt;
  }

  static normalizeSymbol(raw: string): string {
    return raw.trim().toUpperCase();
  }

  static create(input: {
    id: string;
    symbol: string;
    name: string;
    category: AssetCategory;
    status?: AssetStatus;
    lastPrice: string;
    now: Date;
  }): Asset {
    return new Asset({
      id: input.id,
      symbol: Asset.normalizeSymbol(input.symbol),
      name: input.name.trim(),
      category: input.category,
      status: input.status ?? 'active',
      lastPrice: Decimal8.positive(input.lastPrice),
      createdAt: input.now,
      updatedAt: input.now,
      deletedAt: null,
    });
  }

  /** Only active assets can be traded. Halted and delisted ones cannot. */
  isTradable(): boolean {
    return this.status === 'active' && this.deletedAt === null;
  }

  applyChanges(changes: { name?: string; category?: AssetCategory; status?: AssetStatus }, now: Date): void {
    if (changes.name !== undefined) {
      this.name = changes.name.trim();
    }
    if (changes.category !== undefined) {
      this.category = changes.category;
    }
    if (changes.status !== undefined) {
      this.status = changes.status;
    }
    this.updatedAt = now;
  }
}

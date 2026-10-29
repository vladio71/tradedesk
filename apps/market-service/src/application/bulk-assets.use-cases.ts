import { Inject, Injectable } from '@nestjs/common';
import { Asset, AssetCategory, AssetStatus } from '../domain/asset';
import { AssetUpsertRow } from '../domain/asset.repository';
import { Decimal8 } from '../domain/decimal8';
import { AssetsMissingError, DuplicateSymbolsInBatchError } from '../domain/errors';
import { UNIT_OF_WORK, UnitOfWork } from '../domain/unit-of-work';

export interface BulkUpsertItem {
  symbol: string;
  name: string;
  category: AssetCategory;
  status?: AssetStatus;
  lastPrice: string;
}

@Injectable()
export class BulkUpsertAssetsUseCase {
  constructor(@Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork) {}

  /** Creates new assets and updates existing ones (matched by symbol) in one statement and one transaction. */
  async execute(items: BulkUpsertItem[]): Promise<{ created: number; updated: number }> {
    const rows: AssetUpsertRow[] = items.map((item) => ({
      symbol: Asset.normalizeSymbol(item.symbol),
      name: item.name.trim(),
      category: item.category,
      status: item.status ?? 'active',
      lastPrice: Decimal8.positive(item.lastPrice).toString(),
    }));

    // Postgres refuses to touch one row twice in a single ON CONFLICT statement, so we check first.
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.symbol)) duplicates.add(row.symbol);
      seen.add(row.symbol);
    }
    if (duplicates.size > 0) {
      throw new DuplicateSymbolsInBatchError([...duplicates]);
    }

    return this.unitOfWork.run((repos) => repos.assets.bulkUpsert(rows, new Date()));
  }
}

@Injectable()
export class BulkSetAssetStatusUseCase {
  constructor(@Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork) {}

  /** All or nothing: if one id does not exist, the transaction rolls back and no asset changes. */
  async execute(ids: string[], status: AssetStatus): Promise<{ affected: number }> {
    const uniqueIds = [...new Set(ids)];
    return this.unitOfWork.run(async (repos) => {
      const updatedIds = await repos.assets.bulkSetStatus(uniqueIds, status, new Date());
      if (updatedIds.length !== uniqueIds.length) {
        const updated = new Set(updatedIds);
        throw new AssetsMissingError(uniqueIds.filter((id) => !updated.has(id)));
      }
      return { affected: updatedIds.length };
    });
  }
}

@Injectable()
export class BulkDeleteAssetsUseCase {
  constructor(@Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork) {}

  async execute(ids: string[]): Promise<{ affected: number }> {
    const affected = await this.unitOfWork.run((repos) => repos.assets.bulkSoftDelete([...new Set(ids)], new Date()));
    return { affected };
  }
}

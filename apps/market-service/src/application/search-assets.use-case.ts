import { Inject, Injectable } from '@nestjs/common';
import { Page } from '@tradedesk/common';
import { Asset } from '../domain/asset';
import { ASSET_REPOSITORY, AssetRepository, AssetSearchFilter } from '../domain/asset.repository';
import { Decimal8 } from '../domain/decimal8';
import { AssetNotFoundError } from '../domain/errors';

@Injectable()
export class SearchAssetsUseCase {
  constructor(@Inject(ASSET_REPOSITORY) private readonly assets: AssetRepository) {}

  execute(filter: AssetSearchFilter): Promise<Page<Asset>> {
    // Validate the price bounds as decimals before they reach SQL.
    if (filter.minPrice !== undefined) Decimal8.of(filter.minPrice);
    if (filter.maxPrice !== undefined) Decimal8.of(filter.maxPrice);
    return this.assets.search(filter);
  }
}

@Injectable()
export class GetAssetUseCase {
  constructor(@Inject(ASSET_REPOSITORY) private readonly assets: AssetRepository) {}

  async execute(symbol: string): Promise<Asset> {
    const asset = await this.assets.findBySymbol(Asset.normalizeSymbol(symbol));
    if (!asset) {
      throw new AssetNotFoundError(symbol);
    }
    return asset;
  }
}

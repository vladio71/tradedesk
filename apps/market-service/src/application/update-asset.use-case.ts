import { Inject, Injectable } from '@nestjs/common';
import { Asset, AssetCategory, AssetStatus } from '../domain/asset';
import { ASSET_REPOSITORY, AssetRepository } from '../domain/asset.repository';
import { AssetNotFoundError } from '../domain/errors';

export interface UpdateAssetCommand {
  id: string;
  name?: string;
  category?: AssetCategory;
  status?: AssetStatus;
}

@Injectable()
export class UpdateAssetUseCase {
  constructor(@Inject(ASSET_REPOSITORY) private readonly assets: AssetRepository) {}

  async execute(command: UpdateAssetCommand): Promise<Asset> {
    const asset = await this.assets.findById(command.id);
    if (!asset) {
      throw new AssetNotFoundError(command.id);
    }
    asset.applyChanges(command, new Date());
    await this.assets.update(asset);
    return asset;
  }
}

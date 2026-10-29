import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Asset, AssetCategory, AssetStatus } from '../domain/asset';
import { ASSET_REPOSITORY, AssetRepository } from '../domain/asset.repository';

export interface CreateAssetCommand {
  symbol: string;
  name: string;
  category: AssetCategory;
  status?: AssetStatus;
  lastPrice: string;
}

@Injectable()
export class CreateAssetUseCase {
  constructor(@Inject(ASSET_REPOSITORY) private readonly assets: AssetRepository) {}

  async execute(command: CreateAssetCommand): Promise<Asset> {
    const asset = Asset.create({ id: randomUUID(), ...command, now: new Date() });
    await this.assets.insert(asset);
    return asset;
  }
}

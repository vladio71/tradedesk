import { Inject, Injectable } from '@nestjs/common';
import { Asset } from '../domain/asset';
import { AssetNotFoundError } from '../domain/errors';
import { Candle, CandleInterval } from '../domain/tick';
import { UNIT_OF_WORK, UnitOfWork } from '../domain/unit-of-work';

export interface GetCandlesQuery {
  symbol: string;
  interval: CandleInterval;
  from?: Date;
  to?: Date;
  limit: number;
}

@Injectable()
export class GetCandlesUseCase {
  constructor(@Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork) {}

  execute(query: GetCandlesQuery): Promise<Candle[]> {
    return this.unitOfWork.run(async (repos) => {
      const asset = await repos.assets.findBySymbol(Asset.normalizeSymbol(query.symbol));
      if (!asset) {
        throw new AssetNotFoundError(query.symbol);
      }
      const to = query.to ?? new Date(Date.now() + 1000);
      const from = query.from ?? new Date(to.getTime() - 24 * 60 * 60 * 1000);
      return repos.ticks.candles({ assetId: asset.id, interval: query.interval, from, to, limit: query.limit });
    });
  }
}

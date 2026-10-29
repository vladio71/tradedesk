import { Inject, Injectable } from '@nestjs/common';
import { nextPrice } from '../domain/price-walk';
import { RANDOM_SOURCE, RandomSource, TICK_PUBLISHER, TickPublisher } from '../domain/ports';
import { PriceTick } from '../domain/tick';
import { UNIT_OF_WORK, UnitOfWork } from '../domain/unit-of-work';

@Injectable()
export class SimulatePricesUseCase {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(TICK_PUBLISHER) private readonly publisher: TickPublisher,
    @Inject(RANDOM_SOURCE) private readonly random: RandomSource,
  ) {}

  /** Moves every active asset one random step, saves the ticks and publishes them. Returns the number of ticks. */
  async execute(): Promise<number> {
    const now = new Date();
    const ticks = await this.unitOfWork.run(async (repos) => {
      const assets = await repos.assets.listActive();
      if (assets.length === 0) {
        return [] as PriceTick[];
      }
      const updated: PriceTick[] = assets.map((asset) => ({
        assetId: asset.id,
        symbol: asset.symbol,
        price: nextPrice(asset.lastPrice, this.random()).toString(),
        ts: now,
      }));
      // ONE statement updates all prices, no matter how many assets there are.
      await repos.assets.applyPrices(
        updated.map((tick) => ({ assetId: tick.assetId, price: tick.price })),
        now,
      );
      await repos.ticks.insertMany(updated);
      return updated;
    });
    if (ticks.length > 0) {
      this.publisher.publish(ticks);
    }
    return ticks.length;
  }
}

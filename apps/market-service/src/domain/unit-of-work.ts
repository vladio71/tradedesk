import { AssetRepository } from './asset.repository';
import { PositionRepository } from './position.repository';
import { TickRepository } from './tick.repository';

export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');

export interface MarketRepositories {
  assets: AssetRepository;
  ticks: TickRepository;
  positions: PositionRepository;
}

/** Runs the work in one database transaction. A thrown error rolls everything back. */
export interface UnitOfWork {
  run<T>(work: (repositories: MarketRepositories) => Promise<T>): Promise<T>;
}

import { DataSource } from 'typeorm';
import { MarketRepositories, UnitOfWork } from '../domain/unit-of-work';
import { TypeOrmAssetRepository } from './repositories/typeorm-asset.repository';
import { TypeOrmPositionRepository } from './repositories/typeorm-position.repository';
import { TypeOrmTickRepository } from './repositories/typeorm-tick.repository';

export class TypeOrmUnitOfWork implements UnitOfWork {
  constructor(private readonly dataSource: DataSource) {}

  run<T>(work: (repositories: MarketRepositories) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (manager) =>
      work({
        assets: new TypeOrmAssetRepository(manager),
        ticks: new TypeOrmTickRepository(manager),
        positions: new TypeOrmPositionRepository(manager),
      }),
    );
  }
}

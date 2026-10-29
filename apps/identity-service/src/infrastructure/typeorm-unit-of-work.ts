import { DataSource } from 'typeorm';
import { IdentityRepositories, UnitOfWork } from '../domain/unit-of-work';
import { TypeOrmRefreshTokenRepository } from './repositories/typeorm-refresh-token.repository';
import { TypeOrmUserRepository } from './repositories/typeorm-user.repository';

export class TypeOrmUnitOfWork implements UnitOfWork {
  constructor(private readonly dataSource: DataSource) {}

  run<T>(work: (repositories: IdentityRepositories) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (manager) =>
      work({
        users: new TypeOrmUserRepository(manager),
        refreshTokens: new TypeOrmRefreshTokenRepository(manager),
      }),
    );
  }
}

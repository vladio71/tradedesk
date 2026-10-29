import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { InitIdentitySchema1700000000000 } from './migrations/1700000000000-init-identity-schema';
import { RefreshTokenOrmEntity } from './orm/refresh-token.orm-entity';
import { UserOrmEntity } from './orm/user.orm-entity';

export function buildTypeOrmOptions(databaseUrl: string): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    entities: [UserOrmEntity, RefreshTokenOrmEntity],
    migrations: [InitIdentitySchema1700000000000],
    migrationsRun: true,
    synchronize: false,
  };
}

import { RefreshTokenRepository } from './refresh-token.repository';
import { UserRepository } from './user.repository';

export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');

export interface IdentityRepositories {
  users: UserRepository;
  refreshTokens: RefreshTokenRepository;
}

/** Runs the work in one database transaction. A thrown error rolls everything back. */
export interface UnitOfWork {
  run<T>(work: (repositories: IdentityRepositories) => Promise<T>): Promise<T>;
}

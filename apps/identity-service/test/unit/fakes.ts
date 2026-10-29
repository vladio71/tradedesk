import { createHash, randomBytes } from 'node:crypto';
import { Page } from '@tradedesk/common';
import { Email } from '../../src/domain/email';
import { EmailAlreadyUsedError } from '../../src/domain/errors';
import { AuthTokens, NewRefreshToken, PasswordHasher, SessionSettings } from '../../src/domain/ports';
import { RefreshToken } from '../../src/domain/refresh-token';
import { RefreshTokenRepository } from '../../src/domain/refresh-token.repository';
import { IdentityRepositories, UnitOfWork } from '../../src/domain/unit-of-work';
import { User } from '../../src/domain/user';
import { ListUsersFilter, UserRepository } from '../../src/domain/user.repository';

export class InMemoryUserRepository implements UserRepository {
  readonly items = new Map<string, User>();

  async findById(id: string): Promise<User | null> {
    return this.items.get(id) ?? null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    return [...this.items.values()].find((user) => user.email.value === email.value) ?? null;
  }

  async insert(user: User): Promise<void> {
    if (await this.findByEmail(user.email)) {
      throw new EmailAlreadyUsedError();
    }
    this.items.set(user.id, user);
  }

  async update(user: User): Promise<void> {
    this.items.set(user.id, user);
  }

  async list(filter: ListUsersFilter): Promise<Page<User>> {
    const all = [...this.items.values()].filter((user) => !filter.role || user.role === filter.role);
    return { items: all, total: all.length, page: filter.page, pageSize: filter.pageSize, totalPages: 1 };
  }
}

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  readonly items = new Map<string, RefreshToken>();

  async insert(token: RefreshToken): Promise<void> {
    this.items.set(token.id, token);
  }

  async findByHashForUpdate(tokenHash: string): Promise<RefreshToken | null> {
    return [...this.items.values()].find((token) => token.tokenHash === tokenHash) ?? null;
  }

  async revoke(id: string, replacedById: string | null, now: Date): Promise<void> {
    const token = this.items.get(id)!;
    this.items.set(id, new RefreshToken({ ...token, revokedAt: now, replacedById }));
  }

  async revokeFamily(familyId: string, now: Date): Promise<void> {
    for (const token of [...this.items.values()]) {
      if (token.familyId === familyId && !token.isRevoked()) {
        await this.revoke(token.id, token.replacedById, now);
      }
    }
  }

  async revokeAllForUser(userId: string, now: Date): Promise<void> {
    for (const token of [...this.items.values()]) {
      if (token.userId === userId && !token.isRevoked()) {
        await this.revoke(token.id, token.replacedById, now);
      }
    }
  }

  activeCount(): number {
    return [...this.items.values()].filter((token) => !token.isRevoked()).length;
  }
}

export class InMemoryUnitOfWork implements UnitOfWork {
  constructor(
    private readonly repositories: IdentityRepositories,
  ) {}

  run<T>(work: (repositories: IdentityRepositories) => Promise<T>): Promise<T> {
    return work(this.repositories);
  }
}

/** Fast fake: "hashing" is a reversible prefix. Real bcrypt is covered by e2e tests. */
export class FakePasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `hashed:${password}`;
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return hash === `hashed:${password}`;
  }
}

export class FakeAuthTokens implements AuthTokens {
  signAccessToken(user: User): string {
    return `access-for-${user.id}`;
  }

  generateRefreshToken(): NewRefreshToken {
    const raw = randomBytes(16).toString('hex');
    return { raw, hash: this.hashRefreshToken(raw) };
  }

  hashRefreshToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}

export const SETTINGS: SessionSettings = { refreshTtlMs: 7 * 24 * 60 * 60 * 1000 };

export function buildFixture() {
  const users = new InMemoryUserRepository();
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const unitOfWork = new InMemoryUnitOfWork({ users, refreshTokens });
  return { users, refreshTokens, unitOfWork, hasher: new FakePasswordHasher(), tokens: new FakeAuthTokens() };
}

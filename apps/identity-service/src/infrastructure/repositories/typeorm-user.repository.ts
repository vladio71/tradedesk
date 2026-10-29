import { buildPage, offsetOf, Page } from '@tradedesk/common';
import { EntityManager } from 'typeorm';
import { Email } from '../../domain/email';
import { EmailAlreadyUsedError } from '../../domain/errors';
import { User } from '../../domain/user';
import { ListUsersFilter, UserRepository } from '../../domain/user.repository';
import { UserOrmEntity } from '../orm/user.orm-entity';

const UNIQUE_VIOLATION = '23505';

export class TypeOrmUserRepository implements UserRepository {
  constructor(private readonly manager: EntityManager) {}

  private get orm() {
    return this.manager.getRepository(UserOrmEntity);
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.orm.findOne({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const row = await this.orm.findOne({ where: { email: email.value } });
    return row ? toDomain(row) : null;
  }

  async insert(user: User): Promise<void> {
    try {
      await this.orm.insert(toRow(user));
    } catch (error) {
      if ((error as { driverError?: { code?: string } }).driverError?.code === UNIQUE_VIOLATION) {
        throw new EmailAlreadyUsedError();
      }
      throw error;
    }
  }

  async update(user: User): Promise<void> {
    await this.orm.update({ id: user.id }, { displayName: user.displayName, passwordHash: user.passwordHash, updatedAt: user.updatedAt });
  }

  async list(filter: ListUsersFilter): Promise<Page<User>> {
    const query = this.orm.createQueryBuilder('u');
    if (filter.q) {
      query.andWhere('(u.email ILIKE :q OR u.displayName ILIKE :q)', { q: `%${escapeLike(filter.q)}%` });
    }
    if (filter.role) {
      query.andWhere('u.role = :role', { role: filter.role });
    }
    const [rows, total] = await query
      .orderBy('u.createdAt', 'DESC')
      .addOrderBy('u.id', 'ASC')
      .skip(offsetOf(filter))
      .take(filter.pageSize)
      .getManyAndCount();
    return buildPage(rows.map(toDomain), total, filter);
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function toDomain(row: UserOrmEntity): User {
  return new User({
    id: row.id,
    email: Email.parse(row.email),
    passwordHash: row.passwordHash,
    displayName: row.displayName,
    role: row.role,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toRow(user: User): UserOrmEntity {
  const row = new UserOrmEntity();
  row.id = user.id;
  row.email = user.email.value;
  row.passwordHash = user.passwordHash;
  row.displayName = user.displayName;
  row.role = user.role;
  row.createdAt = user.createdAt;
  row.updatedAt = user.updatedAt;
  return row;
}

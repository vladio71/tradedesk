import { Page, PageRequest } from '@tradedesk/common';
import { Email } from './email';
import { User, UserRole } from './user';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface ListUsersFilter extends PageRequest {
  q?: string;
  role?: UserRole;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  /** Throws EmailAlreadyUsedError when the email is taken. */
  insert(user: User): Promise<void>;
  update(user: User): Promise<void>;
  list(filter: ListUsersFilter): Promise<Page<User>>;
}

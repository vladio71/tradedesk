import { Inject, Injectable } from '@nestjs/common';
import { Page } from '@tradedesk/common';
import { User } from '../domain/user';
import { ListUsersFilter, USER_REPOSITORY, UserRepository } from '../domain/user.repository';

@Injectable()
export class ListUsersUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  execute(filter: ListUsersFilter): Promise<Page<User>> {
    return this.users.list(filter);
  }
}

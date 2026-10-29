import { Inject, Injectable } from '@nestjs/common';
import { UserNotFoundError } from '../domain/errors';
import { User } from '../domain/user';
import { USER_REPOSITORY, UserRepository } from '../domain/user.repository';

export interface UpdateProfileCommand {
  userId: string;
  displayName: string;
}

@Injectable()
export class UpdateProfileUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(command: UpdateProfileCommand): Promise<User> {
    const user = await this.users.findById(command.userId);
    if (!user) {
      throw new UserNotFoundError();
    }
    user.rename(command.displayName, new Date());
    await this.users.update(user);
    return user;
  }
}

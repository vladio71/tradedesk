import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Email } from '../domain/email';
import { EmailAlreadyUsedError } from '../domain/errors';
import { assertAcceptablePassword } from '../domain/password-policy';
import { PASSWORD_HASHER, PasswordHasher } from '../domain/ports';
import { User } from '../domain/user';
import { USER_REPOSITORY, UserRepository } from '../domain/user.repository';

export interface RegisterUserCommand {
  email: string;
  password: string;
  displayName: string;
}

@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {}

  async execute(command: RegisterUserCommand): Promise<User> {
    const email = Email.parse(command.email);
    assertAcceptablePassword(command.password);

    if (await this.users.findByEmail(email)) {
      throw new EmailAlreadyUsedError();
    }
    const user = User.register({
      id: randomUUID(),
      email,
      passwordHash: await this.hasher.hash(command.password),
      displayName: command.displayName,
      now: new Date(),
    });
    // The unique index is the real guard: a concurrent register with the same email fails here.
    await this.users.insert(user);
    return user;
  }
}
